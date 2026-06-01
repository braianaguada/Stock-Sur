import { useMemo, useState } from "react";
import { Bot, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { serviceQuoteAiSchema } from "../aiAssistant";
import type { ServiceDocumentCurrency, ServiceDocumentLine } from "../types";
import type { ServiceQuoteAiApplyMode, ServiceQuoteAiResponse, ServiceQuoteAiSuggestion } from "../aiAssistant";

type CustomerOption = {
  id: string;
  name: string;
};

type AssistantForm = {
  description: string;
  customerId: string;
  equipmentType: string;
  businessArea: string;
  location: string;
  urgency: "LOW" | "NORMAL" | "HIGH";
  complexity: "LOW" | "MEDIUM" | "HIGH";
  preferredCurrency: ServiceDocumentCurrency;
  knownMaterials: string;
  includesLabor: boolean;
  includesTravel: boolean;
  priceStyle: "ECONOMY" | "NORMAL" | "PREMIUM";
};

const initialForm: AssistantForm = {
  description: "",
  customerId: "",
  equipmentType: "",
  businessArea: "",
  location: "",
  urgency: "NORMAL",
  complexity: "MEDIUM",
  preferredCurrency: "ARS",
  knownMaterials: "",
  includesLabor: true,
  includesTravel: false,
  priceStyle: "NORMAL",
};

function confidenceLabel(value: string) {
  if (value === "HIGH") return "Alta";
  if (value === "LOW") return "Baja";
  return "Media";
}

function errorDescription(error: unknown) {
  const message = getErrorMessage(error);
  if (message.includes("configurado") || message.includes("GEMINI_API_KEY")) {
    return "El asistente IA no esta configurado todavia.";
  }
  if (
    message.includes("proveedor IA") ||
    message.includes("cuota") ||
    message.includes("temporalmente limitado") ||
    message.includes("limite gratuito") ||
    message.includes("límite gratuito")
  ) {
    return message;
  }
  if (message.includes("no devolvio una propuesta valida") || message.includes("descripcion mas concreta")) {
    return message;
  }
  return "No se pudo generar la propuesta IA. Podes seguir armando el presupuesto manualmente.";
}

async function readFunctionError(error: unknown) {
  const context = typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: unknown }).context
    : null;
  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return new Error(payload.error);
    }
  }
  return error;
}

export function ServiceQuoteAiAssistantDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  customers: CustomerOption[];
  currentLines: ServiceDocumentLine[];
  currentNotes: string;
  selectedCustomerId?: string;
  onApply: (params: {
    suggestion: ServiceQuoteAiSuggestion;
    suggestionId: string | null;
    mode: ServiceQuoteAiApplyMode;
    customerId: string;
  }) => void;
}) {
  const [form, setForm] = useState<AssistantForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<ServiceQuoteAiResponse | null>(null);

  const activeCustomerId = form.customerId || props.selectedCustomerId || "";
  const selectedCustomer = useMemo(
    () => props.customers.find((customer) => customer.id === activeCustomerId) ?? null,
    [activeCustomerId, props.customers],
  );

  const reset = () => {
    setForm({ ...initialForm, customerId: props.selectedCustomerId ?? "" });
    setError("");
    setResponse(null);
    setLoading(false);
  };

  const generate = async () => {
    const description = form.description.trim();
    if (description.length < 10) {
      setError("Describi el servicio con un poco mas de detalle.");
      return;
    }
    if (!props.companyId) {
      setError("Selecciona una empresa antes de usar el asistente IA.");
      return;
    }

    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const { data, error } = await supabase.functions.invoke("service-quote-ai-assistant", {
        body: {
          companyId: props.companyId,
          description,
          customerId: activeCustomerId || null,
          customerName: selectedCustomer?.name ?? null,
          equipmentType: form.equipmentType.trim() || null,
          businessArea: form.businessArea.trim() || null,
          location: form.location.trim() || null,
          urgency: form.urgency,
          complexity: form.complexity,
          preferredCurrency: form.preferredCurrency,
          knownMaterials: form.knownMaterials.trim() || null,
          includesLabor: form.includesLabor,
          includesTravel: form.includesTravel,
          priceStyle: form.priceStyle,
          currentLines: props.currentLines.filter((line) => line.description.trim()).slice(0, 12),
          currentNotes: props.currentNotes || null,
        },
      });
      if (error) throw await readFunctionError(error);
      const payload = data as ServiceQuoteAiResponse;
      const suggestion = serviceQuoteAiSchema.parse(payload.suggestion);
      setResponse({ ...payload, suggestion });
    } catch (caught) {
      setError(errorDescription(caught));
    } finally {
      setLoading(false);
    }
  };

  const apply = (mode: ServiceQuoteAiApplyMode) => {
    if (!response) return;
    props.onApply({
      suggestion: response.suggestion,
      suggestionId: response.suggestionId ?? null,
      mode,
      customerId: activeCustomerId,
    });
    props.onOpenChange(false);
  };

  const suggestion = response?.suggestion ?? null;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange(open);
        if (!open) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Asistente IA para presupuestar servicios
          </DialogTitle>
          <DialogDescription>
            La IA sugiere una propuesta editable. El presupuesto final sigue siendo un documento normal en borrador.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
          <section className="grid gap-3 rounded-lg border bg-muted/10 p-3">
            <div className="space-y-1">
              <Label>Describi el servicio</Label>
              <Textarea
                rows={7}
                className="resize-none"
                placeholder="Ej: Cambio de motocompresor de heladera comercial, limpieza del condensador, carga de gas, revision de fuga y prueba final."
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Select value={activeCustomerId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, customerId: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cliente todavia</SelectItem>
                    {props.customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo de equipo</Label>
                <Input value={form.equipmentType} onChange={(event) => setForm((current) => ({ ...current, equipmentType: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Rubro</Label>
                <Input value={form.businessArea} onChange={(event) => setForm((current) => ({ ...current, businessArea: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Ciudad / zona</Label>
                <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Urgencia</Label>
                <Select value={form.urgency} onValueChange={(value) => setForm((current) => ({ ...current, urgency: value as AssistantForm["urgency"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Complejidad</Label>
                <Select value={form.complexity} onValueChange={(value) => setForm((current) => ({ ...current, complexity: value as AssistantForm["complexity"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Moneda preferida</Label>
                <Select value={form.preferredCurrency} onValueChange={(value) => setForm((current) => ({ ...current, preferredCurrency: value as ServiceDocumentCurrency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estilo de precio</Label>
                <Select value={form.priceStyle} onValueChange={(value) => setForm((current) => ({ ...current, priceStyle: value as AssistantForm["priceStyle"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ECONOMY">Economico</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="PREMIUM">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Materiales conocidos</Label>
              <Textarea rows={3} className="resize-none" value={form.knownMaterials} onChange={(event) => setForm((current) => ({ ...current, knownMaterials: event.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.includesLabor} onChange={(event) => setForm((current) => ({ ...current, includesLabor: event.target.checked }))} />
                Incluye mano de obra
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.includesTravel} onChange={(event) => setForm((current) => ({ ...current, includesTravel: event.target.checked }))} />
                Incluye traslado
              </label>
            </div>

            {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
            <Button type="button" onClick={() => void generate()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? "Generando..." : "Generar propuesta"}
            </Button>
          </section>

          <section className="grid gap-3 rounded-lg border bg-card p-3">
            {!suggestion ? (
              <div className="grid min-h-80 place-items-center rounded-lg border border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                La vista previa aparece aca cuando generes una propuesta.
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen</p>
                  <p className="text-sm">{suggestion.summary}</p>
                </div>

                <div className="grid gap-2 rounded-md border p-3">
                  <p className="text-sm font-semibold">Rango sugerido</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Price label="Minimo" value={suggestion.priceSuggestion.min} currency={suggestion.priceSuggestion.currency} />
                    <Price label="Recomendado" value={suggestion.priceSuggestion.recommended} currency={suggestion.priceSuggestion.currency} />
                    <Price label="Alto" value={suggestion.priceSuggestion.max} currency={suggestion.priceSuggestion.currency} />
                  </div>
                  <p className="text-xs text-muted-foreground">Confianza: {confidenceLabel(suggestion.priceSuggestion.confidence)}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.priceSuggestion.explanation}</p>
                </div>

                <div className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">Base de estimacion</p>
                  <div className="mt-2 grid gap-1 text-muted-foreground">
                    <p>Historico interno: {suggestion.pricingSources.internalHistoryUsed ? `usado (${suggestion.pricingSources.internalHistoryCount})` : "no usado"}</p>
                    <p>Referencias externas: {suggestion.pricingSources.externalReferencesUsed ? "usadas como orientacion" : "no disponibles"}</p>
                    <p>Confianza: {confidenceLabel(suggestion.priceSuggestion.confidence)}</p>
                    {suggestion.pricingSources.externalReferenceSummary ? <p>{suggestion.pricingSources.externalReferenceSummary}</p> : null}
                  </div>
                  {suggestion.pricingSources.limitations.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-muted-foreground">
                      {suggestion.pricingSources.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                    </ul>
                  ) : null}
                  {suggestion.confidenceReasons.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-muted-foreground">
                      {suggestion.confidenceReasons.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                    </ul>
                  ) : null}
                </div>

                <PreviewList title="Lineas sugeridas" items={suggestion.suggestedLines.map((line) => `${line.description} (${line.quantity} ${line.unit})`)} />
                <PreviewList title="Materiales posibles" items={suggestion.possibleMaterials.map((material) => `${material.name}${material.needsConfirmation ? " - confirmar" : ""}`)} empty="Sin materiales sugeridos." />
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">Mano de obra estimada</p>
                  <p className="text-muted-foreground">
                    {suggestion.laborEstimate.hoursMin}h - {suggestion.laborEstimate.hoursRecommended}h - {suggestion.laborEstimate.hoursMax}h
                  </p>
                  {suggestion.laborEstimate.notes ? <p className="text-muted-foreground">{suggestion.laborEstimate.notes}</p> : null}
                </div>
                <PreviewList title="Advertencias" items={suggestion.warnings} empty="Sin advertencias." />
                <PreviewList title="Datos faltantes" items={suggestion.missingInfoQuestions} empty="Sin preguntas pendientes." />
                {suggestion.commercialNotes ? (
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-semibold">Notas comerciales</p>
                    <p className="text-muted-foreground">{suggestion.commercialNotes}</p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="flex-row flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Descartar
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!suggestion} onClick={() => apply("lines")}>Aplicar solo lineas</Button>
            <Button type="button" variant="outline" disabled={!suggestion} onClick={() => apply("price")}>Aplicar solo precio</Button>
            <Button type="button" disabled={!suggestion} onClick={() => apply("all")}>
              <Check className="mr-2 h-4 w-4" /> Aplicar todo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Price(props: { label: string; value: number; currency: ServiceDocumentCurrency }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="text-base font-bold">{formatMoney(props.value, props.currency)}</p>
    </div>
  );
}

function PreviewList(props: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-semibold">{props.title}</p>
      {props.items.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-muted-foreground">
          {props.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground">{props.empty ?? "Sin datos."}</p>
      )}
    </div>
  );
}
