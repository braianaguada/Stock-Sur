import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildBillingPrintHtml } from "@/features/billing/print";
import { buildFiscalQrUrl } from "@/features/billing/lib/authorization";
import type { BillingDocumentLineRow, BillingDocumentRow, BillingRemitoReference } from "@/features/billing/types";

type SupabaseQueryResult = { data: unknown; error: Error | null };
type SupabaseSingleQueryBuilder = PromiseLike<SupabaseQueryResult> & {
  select: (columns: string) => SupabaseSingleQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseSingleQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseSingleQueryBuilder;
  single: () => Promise<SupabaseQueryResult>;
};
type SupabaseQueryBuilder = PromiseLike<SupabaseQueryResult> & {
  select: (columns: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
};
const billingDb = supabase as unknown as {
  from: (table: string) => SupabaseSingleQueryBuilder & SupabaseQueryBuilder;
};

export default function PrintBillingPage() {
  const { id } = useParams();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const documentQuery = useQuery({
    queryKey: ["billing-print-document", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_documents")
        .select("id, company_id, source_type, source_id, source_remito_id, related_billing_document_id, document_kind, invoice_type, fiscal_status, provider, environment, issuer_tax_id, issuer_name, issuer_tax_condition, receiver_name, receiver_doc_type, receiver_doc_number, receiver_tax_condition, currency, currency_rate, subtotal, discount_total, tax_total, total, point_of_sale, voucher_number, voucher_full_number, voucher_date, cae, cae_expires_at, authorized_at, authorized_by, provider_errors, provider_observations, error_message, created_at, updated_at")
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as BillingDocumentRow;
    },
  });

  const linesQuery = useQuery({
    queryKey: ["billing-print-lines", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_document_lines")
        .select("id, billing_document_id, source_document_line_id, line_order, description, unit, quantity, unit_price, discount_pct, discount_total, vat_rate, net_amount, vat_amount, total")
        .eq("billing_document_id", id!)
        .order("line_order", { ascending: true });

      if (error) throw error;
      return ((data as BillingDocumentLineRow[] | null) ?? []);
    },
  });

  const remitoQuery = useQuery({
    queryKey: ["billing-print-remito", documentQuery.data?.source_remito_id],
    enabled: Boolean(documentQuery.data?.source_remito_id),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("documents")
        .select("id, point_of_sale, document_number, customer_name")
        .eq("id", documentQuery.data!.source_remito_id!)
        .single();

      if (error) throw error;
      return data as BillingRemitoReference;
    },
  });

  const relatedDocumentQuery = useQuery({
    queryKey: ["billing-print-related-document", documentQuery.data?.related_billing_document_id],
    enabled: Boolean(documentQuery.data?.related_billing_document_id),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_documents")
        .select("id, company_id, source_type, source_id, source_remito_id, related_billing_document_id, document_kind, invoice_type, fiscal_status, provider, environment, issuer_tax_id, issuer_name, issuer_tax_condition, receiver_name, receiver_doc_type, receiver_doc_number, receiver_tax_condition, currency, currency_rate, subtotal, discount_total, tax_total, total, point_of_sale, voucher_number, voucher_full_number, voucher_date, cae, cae_expires_at, authorized_at, authorized_by, provider_errors, provider_observations, error_message, created_at, updated_at")
        .eq("id", documentQuery.data!.related_billing_document_id!)
        .single();

      if (error) throw error;
      return data as BillingDocumentRow;
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function generateQr() {
      if (!documentQuery.data || documentQuery.data.fiscal_status !== "AUTHORIZED" || !documentQuery.data.cae) {
        setQrDataUrl(null);
        return;
      }
      const dataUrl = await QRCode.toDataURL(buildFiscalQrUrl(documentQuery.data), {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 224,
      });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    void generateQr();
    return () => {
      cancelled = true;
    };
  }, [documentQuery.data]);

  const html = useMemo(() => {
    if (!documentQuery.data || !linesQuery.data) return "";
    if (documentQuery.data.source_remito_id && remitoQuery.isLoading) return "";
    if (documentQuery.data.related_billing_document_id && relatedDocumentQuery.isLoading) return "";
    return buildBillingPrintHtml({
      document: documentQuery.data,
      lines: linesQuery.data,
      remito: remitoQuery.data,
      relatedDocument: relatedDocumentQuery.data,
      qrDataUrl,
    });
  }, [documentQuery.data, linesQuery.data, remitoQuery.data, remitoQuery.isLoading, relatedDocumentQuery.data, relatedDocumentQuery.isLoading, qrDataUrl]);

  useEffect(() => {
    if (html && (!documentQuery.data?.cae || qrDataUrl)) {
      window.setTimeout(() => window.print(), 250);
    }
  }, [documentQuery.data?.cae, html, qrDataUrl]);

  if (!id) return <div className="p-8">Comprobante fiscal no encontrado.</div>;
  if (documentQuery.isLoading || linesQuery.isLoading) return <div className="p-8">Cargando factura...</div>;
  if (documentQuery.error) return <div className="p-8">No se pudo cargar la factura.</div>;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
