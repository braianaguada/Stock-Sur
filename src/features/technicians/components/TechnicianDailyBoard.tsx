import { BriefcaseBusiness, CalendarDays, GripVertical, MapPin, Pencil, UserRound } from "lucide-react";
import { useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CountBadge } from "@/components/common/VisualSystem";
import {
  DAILY_STATUS_CONFIG,
  DAILY_TECHNICIAN_STATUSES,
  type DailyTechnicianStatus,
  type TechnicianDailyCard,
} from "../dailyBoard";
import { getLocalBusinessDate, useTechnicianDailyBoard, type DailyBoardUpdate } from "../hooks/useTechnicianDailyBoard";

type EditForm = DailyBoardUpdate;

export function TechnicianDailyBoard({
  companyId,
  userId,
  toast,
  onOpenService,
}: {
  companyId: string | null | undefined;
  userId: string | null | undefined;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onOpenService: (serviceId: string) => void;
}) {
  const today = getLocalBusinessDate();
  const [businessDate, setBusinessDate] = useState(today);
  const [draggedTechnicianId, setDraggedTechnicianId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<TechnicianDailyCard | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const board = useTechnicianDailyBoard({ companyId, userId, businessDate, toast });

  const openEdit = (card: TechnicianDailyCard) => {
    setEditingCard(card);
    setForm({
      technician_id: card.technician_id,
      status: card.status,
      service_id: card.service_id,
      activity: card.activity,
      location: card.location,
      notes: card.notes,
      position: card.position,
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, status: DailyTechnicianStatus) => {
    event.preventDefault();
    const technicianId = event.dataTransfer.getData("text/technician-id") || draggedTechnicianId;
    const card = board.cards.find((item) => item.technician_id === technicianId);
    setDraggedTechnicianId(null);
    if (!card || card.status === status) return;
    board.moveTechnician(card, status, board.cards.filter((item) => item.status === status).length);
  };

  return (
    <div className="grid gap-4">
      <Card className="border-border/70 shadow-none">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Jornada de tecnicos</CardTitle>
            <CardDescription>Arrastra cada tecnico para reflejar donde esta y que esta haciendo durante el dia.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Fecha del tablero"
                type="date"
                className="w-44 pl-9"
                value={businessDate}
                onChange={(event) => setBusinessDate(event.target.value)}
              />
            </div>
            {businessDate !== today ? <Button variant="outline" onClick={() => setBusinessDate(today)}>Volver a hoy</Button> : null}
            <CountBadge>{board.cards.length} tecnicos activos</CountBadge>
          </div>
        </CardHeader>
      </Card>

      {board.isLoading ? (
        <Card className="border-border/70 p-8 text-center text-sm text-muted-foreground shadow-none">Cargando jornada...</Card>
      ) : board.cards.length === 0 ? (
        <Card className="border-dashed p-8 text-center shadow-none">
          <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No hay tecnicos activos</p>
          <p className="text-sm text-muted-foreground">Activa o crea un tecnico para comenzar a organizar la jornada.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-2" role="region" aria-label="Tablero diario de tecnicos" tabIndex={0}>
          <div className="grid min-w-[1960px] grid-cols-7 gap-3">
            {DAILY_TECHNICIAN_STATUSES.map((status) => {
              const cards = board.cards.filter((card) => card.status === status);
              const config = DAILY_STATUS_CONFIG[status];
              return (
                <section
                  key={status}
                  className={`min-h-[420px] rounded-xl border p-3 ${config.tone}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, status)}
                >
                  <header className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{config.label}</h3>
                    <CountBadge>{cards.length}</CountBadge>
                  </header>
                  <div className="grid gap-2">
                    {cards.map((card) => (
                      <article
                        key={card.technician_id}
                        draggable={!board.isUpdating}
                        onDragStart={(event) => {
                          setDraggedTechnicianId(card.technician_id);
                          event.dataTransfer.setData("text/technician-id", card.technician_id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggedTechnicianId(null)}
                        className="rounded-lg border bg-background p-3 shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{card.technician.name}</p>
                            {card.service ? (
                              <button type="button" className="mt-2 block w-full text-left text-xs hover:underline" onClick={() => onOpenService(card.service!.id)}>
                                <span className="flex items-start gap-1.5"><BriefcaseBusiness className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong>{card.service.jobTitle}</strong><br />{card.service.title}</span></span>
                              </button>
                            ) : null}
                            {card.activity ? <p className="mt-2 text-xs text-muted-foreground">{card.activity}</p> : null}
                            {card.location ? <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{card.location}</p> : null}
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Editar jornada de ${card.technician.name}`} onClick={() => openEdit(card)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Select value={card.status} onValueChange={(value) => board.moveTechnician(card, value as DailyTechnicianStatus)} disabled={board.isUpdating}>
                          <SelectTrigger className="mt-3 h-8 text-xs" aria-label={`Estado de ${card.technician.name}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{DAILY_TECHNICIAN_STATUSES.map((value) => <SelectItem key={value} value={value}>{DAILY_STATUS_CONFIG[value].label}</SelectItem>)}</SelectContent>
                        </Select>
                      </article>
                    ))}
                    {cards.length === 0 ? <p className="rounded-lg border border-dashed bg-background/40 px-3 py-6 text-center text-xs text-muted-foreground">Arrastra un tecnico aqui</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={Boolean(editingCard)} onOpenChange={(open) => { if (!open) { setEditingCard(null); setForm(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? `Jornada de ${editingCard.technician.name}` : "Detalle de jornada"}</DialogTitle>
            <DialogDescription>Completa solo la informacion util para ubicar y coordinar al tecnico.</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Estado</Label><Select value={form.status} onValueChange={(status) => setForm((current) => current ? { ...current, status: status as DailyTechnicianStatus } : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAILY_TECHNICIAN_STATUSES.map((status) => <SelectItem key={status} value={status}>{DAILY_STATUS_CONFIG[status].label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label>Trabajo / servicio</Label><Select value={form.service_id ?? "NONE"} onValueChange={(serviceId) => setForm((current) => current ? { ...current, service_id: serviceId === "NONE" ? null : serviceId } : current)}><SelectTrigger><SelectValue placeholder="Sin trabajo vinculado" /></SelectTrigger><SelectContent><SelectItem value="NONE">Sin trabajo vinculado</SelectItem>{board.services.map((service) => <SelectItem key={service.id} value={service.id}>{service.jobTitle} / {service.title}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label htmlFor="daily-activity">Que esta haciendo</Label><Input id="daily-activity" value={form.activity ?? ""} onChange={(event) => setForm((current) => current ? { ...current, activity: event.target.value } : current)} placeholder="Ej. Instalacion, diagnostico, esperando repuesto" /></div>
              <div className="grid gap-2"><Label htmlFor="daily-location">Ubicacion</Label><Input id="daily-location" value={form.location ?? ""} onChange={(event) => setForm((current) => current ? { ...current, location: event.target.value } : current)} placeholder="Ej. Taller, cliente o localidad" /></div>
              <div className="grid gap-2"><Label htmlFor="daily-notes">Notas</Label><Textarea id="daily-notes" rows={3} value={form.notes ?? ""} onChange={(event) => setForm((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Dato breve para el seguimiento interno" /></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingCard(null); setForm(null); }}>Cancelar</Button>
            <Button disabled={!form || board.isUpdating} onClick={() => {
              if (!form) return;
              board.updateTechnician(form, () => { setEditingCard(null); setForm(null); });
            }}>Guardar jornada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
