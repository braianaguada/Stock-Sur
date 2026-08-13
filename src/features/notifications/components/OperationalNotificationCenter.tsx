import { useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { CountBadge, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";
import {
  buildOperationalNotifications,
  countOperationalPendings,
} from "@/features/notifications/operational-notifications";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
  default: "border-border bg-muted/35 text-foreground",
};

export function OperationalNotificationCenter() {
  const [open, setOpen] = useState(false);
  const { currentCompany, roles, companyRoleCodes, companyPermissionCodes, loading } = useAuth();
  const { dashboard, error, isLoading, isFetching, refetch } = useDashboardStats({
    companyId: currentCompany?.id,
  });
  const notifications = buildOperationalNotifications(dashboard.actions, {
    roles,
    companyRoleCodes,
    companyPermissionCodes,
  });
  const pendingCount = countOperationalPendings(notifications);
  const badge = pendingCount > 99 ? "99+" : String(pendingCount);

  if (!currentCompany || loading) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative rounded-full bg-background/90"
          aria-label={pendingCount > 0 ? `Alertas operativas: ${pendingCount} pendientes` : "Alertas operativas: sin pendientes"}
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 ? (
            <div className="absolute -right-2 -top-2">
              <StatusBadge tone="danger">{badge}</StatusBadge>
            </div>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent variant="form">
        <DialogHeader>
          <DialogTitle>Centro de alertas</DialogTitle>
          <DialogDescription>
            Pendientes accionables de {currentCompany.name}. Se muestran según tus permisos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 border-y py-3">
          <div>
            <p className="text-sm font-semibold">{pendingCount} pendientes en {notifications.length} categorías</p>
            <p className="text-xs text-muted-foreground">Los avisos sin acción concreta no aparecen acá.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Actualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Revisando pendientes…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            No se pudieron actualizar las alertas. Podés reintentar sin perder ningún dato.
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
            <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600" />
            <p className="font-semibold">No hay pendientes accionables</p>
            <p className="mt-1 text-sm text-muted-foreground">La campana se actualizará cuando aparezca algo que requiera atención.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Link
                key={notification.key}
                to={notification.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-xl border p-4 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  TONE_STYLES[notification.tone],
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{notification.label}</p>
                      <CountBadge>{notification.count}</CountBadge>
                    </div>
                    <p className="mt-1 text-sm opacity-80">{notification.detail}</p>
                    <p className="mt-2 text-xs font-semibold">Abrir y resolver</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
