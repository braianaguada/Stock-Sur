import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { escapeHtml, escapeHtmlWithLineBreaks, openPrintWindow } from "@/lib/print";
import type { QuoteFormState, QuoteLine, QuoteLineRow, QuoteListRow } from "@/features/quotes/types";

type ToastFn = (params: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

interface QuoteCustomerOption {
  id: string;
  name: string;
}

const EMPTY_CUSTOMERS: QuoteCustomerOption[] = [];
const EMPTY_QUOTES: QuoteListRow[] = [];
const EMPTY_QUOTE_LINES: QuoteLineRow[] = [];
const EMPTY_QUOTE_FORM: QuoteFormState = { customer_id: "", customer_name: "", notes: "" };
const EMPTY_QUOTE_LINE: QuoteLine = { description: "", quantity: 1, unit_price: 0, item_id: null };

export function useQuotesFlow(params: {
  appName: string;
  currentCompanyId: string | null;
  userId: string | null;
  toast: ToastFn;
}) {
  const { appName, currentCompanyId, userId, toast } = params;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteListRow | null>(null);
  const [form, setForm] = useState<QuoteFormState>(EMPTY_QUOTE_FORM);
  const [lines, setLines] = useState<QuoteLine[]>([EMPTY_QUOTE_LINE]);
  const deferredSearch = useDeferredValue(search);

  const customersQuery = useQuery({
    queryKey: ["customers-list", currentCompanyId ?? "no-company"],
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const customers = customersQuery.data ?? EMPTY_CUSTOMERS;

  const quotesQuery = useQuery({
    queryKey: ["quotes", currentCompanyId ?? "no-company", deferredSearch],
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      let query = supabase
        .from("quotes")
        .select("*, customers(name)")
        .eq("company_id", currentCompanyId!)
        .order("created_at", { ascending: false });
      if (deferredSearch) {
        query = query.or(`customer_name.ilike.%${deferredSearch}%,quote_number.eq.${parseInt(deferredSearch, 10) || 0}`);
      }
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []) as QuoteListRow[];
    },
  });
  const quotes = quotesQuery.data ?? EMPTY_QUOTES;

  const quoteLinesQuery = useQuery({
    queryKey: ["quote-lines", currentCompanyId ?? "no-company", selectedQuoteId],
    enabled: Boolean(currentCompanyId && selectedQuoteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_lines")
        .select("*, items(name, sku)")
        .eq("company_id", currentCompanyId!)
        .eq("quote_id", selectedQuoteId!);
      if (error) throw error;
      return (data ?? []) as QuoteLineRow[];
    },
  });
  const quoteLines = quoteLinesQuery.data ?? EMPTY_QUOTE_LINES;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Seleccioná una empresa antes de crear un presupuesto");

      const validLines = lines.filter((line) => line.description.trim());
      if (validLines.length === 0) throw new Error("Agregá al menos una línea");

      const total = validLines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      const customerName = form.customer_id
        ? customers.find((customer) => customer.id === form.customer_id)?.name ?? form.customer_name
        : form.customer_name || "Cliente ocasional";

      const { data: quote, error } = await supabase
        .from("quotes")
        .insert({
          company_id: currentCompanyId,
          customer_id: form.customer_id || null,
          customer_name: customerName,
          notes: form.notes || null,
          total,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const lineInserts = validLines.map((line) => ({
        company_id: currentCompanyId,
        quote_id: quote.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.quantity * line.unit_price,
        item_id: line.item_id,
      }));
      const { error: linesError } = await supabase.from("quote_lines").insert(lineInserts);
      if (linesError) throw linesError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes", currentCompanyId ?? "no-company"] });
      setDialogOpen(false);
      toast({ title: "Presupuesto creado" });
    },
    onError: (error: unknown) => toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Error desconocido",
      variant: "destructive",
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: linesError } = await supabase
        .from("quote_lines")
        .delete()
        .eq("company_id", currentCompanyId!)
        .eq("quote_id", id);
      if (linesError) throw linesError;
      await deleteByStrategy({ table: "quotes", id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes", currentCompanyId ?? "no-company"] });
      toast({ title: "Presupuesto eliminado" });
    },
  });

  const addLine = () => setLines([...lines, EMPTY_QUOTE_LINE]);
  const removeLine = (index: number) => setLines(lines.filter((_, currentIndex) => currentIndex !== index));
  const updateLine = (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const exportPDF = (quote: QuoteListRow) => {
    if (!currentCompanyId) return;

    supabase
      .from("quote_lines")
      .select("*")
      .eq("company_id", currentCompanyId)
      .eq("quote_id", quote.id)
      .then(({ data }) => {
        const linesHtml = ((data ?? []) as QuoteLineRow[]).map((line) =>
          `<tr><td>${escapeHtml(line.description)}</td><td style="text-align:right">${line.quantity}</td><td style="text-align:right">$${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td><td style="text-align:right">$${Number(line.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td></tr>`,
        ).join("");

        const windowRef = openPrintWindow(`<!DOCTYPE html><html><head><title>Presupuesto #${quote.quote_number}</title>
          <style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto}
          h1{color:#1e293b;border-bottom:3px solid #d97706;padding-bottom:10px}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}
          th{background:#f1f5f9}
          .total{font-size:1.2em;font-weight:bold;text-align:right;margin-top:20px}
          .meta{color:#64748b;margin:5px 0}
          @media print{button{display:none}}</style></head><body>
          <h1>${escapeHtml(appName)} - Presupuesto #${quote.quote_number}</h1>
          <p class="meta">Cliente: <strong>${escapeHtml(quote.customer_name ?? "-")}</strong></p>
          <p class="meta">Fecha: ${new Date(quote.created_at).toLocaleDateString("es-AR")}</p>
          ${quote.notes ? `<p class="meta">Notas: ${escapeHtmlWithLineBreaks(quote.notes)}</p>` : ""}
          <table><thead><tr><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">P. Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
          <tbody>${linesHtml}</tbody></table>
          <p class="total">Total: $${Number(quote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
          <button onclick="window.print()" style="margin-top:20px;padding:8px 16px;cursor:pointer">Imprimir / Guardar PDF</button>
          </body></html>`);
        if (!windowRef) return;
      });
  };

  const openCreate = () => {
    setForm(EMPTY_QUOTE_FORM);
    setLines([EMPTY_QUOTE_LINE]);
    setDialogOpen(true);
  };

  return {
    addLine,
    currentCompanyId,
    customers,
    deleteMutation,
    detailDialogOpen,
    dialogOpen,
    exportPDF,
    form,
    isLoading: quotesQuery.isLoading,
    lines,
    openCreate,
    quoteLines,
    quoteToDelete,
    quotes,
    removeLine,
    saveMutation,
    search,
    selectedQuoteId,
    setDetailDialogOpen,
    setDialogOpen,
    setForm,
    setQuoteToDelete,
    setSearch,
    setSelectedQuoteId,
    updateLine,
  };
}
