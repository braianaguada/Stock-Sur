import { BadgeCheck, Building2, Pencil, Plus, Shield, User2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      description="Vista previa de membresías, roles globales y acceso por empresa."
      contentClassName="max-w-4xl overflow-visible"
    >
      {selectedUser ? (
        <div className="max-h-[74vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid items-start gap-3 lg:grid-cols-[1.5fr_0.5fr]">
            <section className="self-start rounded-2xl border border-border/60 bg-card/82 p-4 shadow-[var(--shadow-xs)]">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Identidad</div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{selectedUser.full_name?.trim() || "Sin nombre cargado"}</p>
                  <p className="break-all text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUser.global_roles?.length ? (
                  selectedUser.global_roles.map((role) => (
                    <Badge key={role} variant={role === "superadmin" ? "default" : "secondary"} className="h-5 rounded-full px-2 text-[10px]">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Sin roles globales asignados.</span>
                )}
              </div>
            </section>

            <section className="self-start rounded-2xl border border-border/60 bg-card/82 p-4 shadow-[var(--shadow-xs)]">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resumen operativo</div>
              <div className="space-y-2">
                {[
                  { label: "Empresas", value: selectedUser.companies?.length ?? 0, icon: Building2 },
                  { label: "Roles globales", value: selectedUser.global_roles?.length ?? 0, icon: Shield },
                  { label: "Membresías activas", value: selectedUser.companies?.filter((company) => company.status === "ACTIVE").length ?? 0, icon: BadgeCheck },
                  { label: "Roles empresa", value: selectedUser.companies?.reduce((sum, company) => sum + (company.roles?.length ?? 0), 0) ?? 0, icon: Shield },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[hsl(var(--panel))]/44 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span className="text-2xl font-bold leading-none">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border/60 bg-card/82 p-4 shadow-[var(--shadow-xs)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Acceso por empresa</div>
                <p className="mt-1 text-sm text-muted-foreground">Membresías, estado y rol base por compañía.</p>
              </div>
              <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => onOpenAccessDialog(selectedUser)}>
                <Plus className="mr-2 h-4 w-4" />
                Asignar empresa
              </Button>
            </div>

            <div className="space-y-2">
              {selectedUser.companies?.length ? (
                selectedUser.companies.map((company) => (
                  <div
                    key={company.companyUserId}
                    className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/42 px-3.5 py-3 shadow-[var(--shadow-xs)]"
                  >
                    <div className="flex flex-wrap items-center gap-2.5 md:flex-nowrap">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background/92 text-muted-foreground shadow-[var(--shadow-xs)]">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{company.companyName}</p>
                            <Badge variant={company.status === "ACTIVE" ? "outline" : "destructive"} className="h-5 rounded-full px-2 text-[10px]">
                              {company.status === "ACTIVE" ? "Activa" : "Inactiva"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            <span>{company.companySlug}</span>
                            <span>-</span>
                            <span>{company.roles?.length ?? 0} roles</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {company.roles?.length ? (
                            company.roles.map((role) => (
                              <Badge key={`${company.companyUserId}-${role}`} variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Sin rol base asignado</span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => onOpenAccessDialog(selectedUser, company)}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar acceso
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  Este usuario todavía no tiene empresas asignadas.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </EntityDialog>
  );
}
