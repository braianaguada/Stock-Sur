import { BadgeCheck, Building2, Pencil, Plus, Shield, User2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { CategoryBadge, MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserAccessRow, UserCompanyAccess } from "@/features/users/types";

export function UserDetailDialog(props: {
  open: boolean;
  selectedUser: UserAccessRow | null;
  onOpenChange: (open: boolean) => void;
  onOpenAccessDialog: (user: UserAccessRow, company?: UserCompanyAccess) => void;
}) {
  const { open, selectedUser, onOpenChange, onOpenAccessDialog } = props;

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle de usuario"
      description="Vista previa de membresias, roles globales y acceso por empresa."
      contentClassName="max-w-4xl"
    >
      {selectedUser ? (
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/60 bg-card/86 shadow-[var(--shadow-xs)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Identidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <User2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedUser.full_name?.trim() || "Sin nombre cargado"}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.global_roles?.length ? (
                    selectedUser.global_roles.map((role) => (
                      <CategoryBadge key={role}>
                        {role}
                      </CategoryBadge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin roles globales asignados.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <MetricGrid columns={2}>
              <MetricCard
                label="Empresas"
                value={selectedUser.companies?.length ?? 0}
                format="plain"
                icon={<Building2 className="h-4 w-4" />}
              />
              <MetricCard
                label="Roles globales"
                value={selectedUser.global_roles?.length ?? 0}
                format="plain"
                icon={<Shield className="h-4 w-4" />}
                tone="info"
              />
              <MetricCard
                label="Membresías activas"
                value={selectedUser.companies?.filter((company) => company.status === "ACTIVE").length ?? 0}
                format="plain"
                icon={<BadgeCheck className="h-4 w-4" />}
                tone="success"
              />
              <MetricCard
                label="Roles empresa"
                value={selectedUser.companies?.reduce((sum, company) => sum + (company.roles?.length ?? 0), 0) ?? 0}
                format="plain"
                icon={<Shield className="h-4 w-4" />}
              />
            </MetricGrid>
          </div>

          <Card className="border-border/60 bg-card/86 shadow-[var(--shadow-xs)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Acceso por empresa</CardTitle>
                <Button size="sm" className="rounded-full" onClick={() => onOpenAccessDialog(selectedUser)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Asignar empresa
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedUser.companies?.length ? (
                selectedUser.companies.map((company) => (
                  <div
                    key={company.companyUserId}
                    className="rounded-[calc(var(--radius)+0.05rem)] border border-border/65 bg-[hsl(var(--panel))]/46 p-4 shadow-[var(--shadow-xs)]"
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background/92 text-muted-foreground shadow-[var(--shadow-xs)]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{company.companyName}</p>
                            <StatusBadge tone={company.status === "ACTIVE" ? "success" : "danger"}>
                              {company.status === "ACTIVE" ? "Membresia activa" : "Membresia inactiva"}
                            </StatusBadge>
                          </div>
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {company.companySlug}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => onOpenAccessDialog(selectedUser, company)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar acceso
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {company.roles?.length ? (
                        company.roles.map((role) => (
                          <CategoryBadge key={`${company.companyUserId}-${role}`}>
                            {role}
                          </CategoryBadge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin rol base asignado en esta empresa.</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  Este usuario todavia no tiene empresas asignadas.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </EntityDialog>
  );
}
