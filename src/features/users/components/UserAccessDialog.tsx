import { EntityDialog } from "@/components/common/EntityDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  AccessFormState,
  CompanyOption,
  CompanyRoleOption,
  PermissionOption,
  PermissionOverrideState,
  UserAccessRow,
} from "@/features/users/types";

export function UserAccessDialog(props: {
  open: boolean;
  selectedUser: UserAccessRow | null;
  accessForm: AccessFormState;
  companyOptions: CompanyOption[];
  companyRoleOptions: CompanyRoleOption[];
  permissionOptionsByModule: Record<string, PermissionOption[]>;
  permissionOverrides: PermissionOverrideState;
  inheritedRolePermissionIds: string[];
  inheritedPermissionCount: number;
  overrideStats: { allow: number; deny: number };
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onAccessFormChange: (updater: (current: AccessFormState) => AccessFormState) => void;
  onPermissionOverrideChange: (permissionId: string, value: "ALLOW" | "DENY" | "INHERIT") => void;
  onSave: () => void;
}) {
  const {
    open,
    selectedUser,
    accessForm,
    companyOptions,
    companyRoleOptions,
    permissionOptionsByModule,
    permissionOverrides,
    inheritedRolePermissionIds,
    inheritedPermissionCount,
    overrideStats,
    isSaving,
    onOpenChange,
    onAccessFormChange,
    onPermissionOverrideChange,
    onSave,
  } = props;

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Gestionar acceso por empresa"
      description="Define la empresa, el rol base y el estado de la membresía para este usuario."
      contentClassName="max-w-4xl overflow-visible"
      footer={(
        <>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar acceso"}
          </Button>
        </>
      )}
    >
      <div className="max-h-[74vh] space-y-3 overflow-y-auto pr-1">
        <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/40 px-4 py-2.5">
          <p className="text-sm font-semibold">{selectedUser?.full_name?.trim() || "Sin nombre cargado"}</p>
          <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Empresa</Label>
          <Select
            value={accessForm.companyId}
            onValueChange={(value) => onAccessFormChange((current) => ({ ...current, companyId: value }))}
            disabled={Boolean(accessForm.companyUserId)}
          >
            <SelectTrigger className="h-10 focus:ring-0 focus:ring-offset-0 focus:shadow-[0_0_0_1px_hsl(var(--focus-ring)),0_0_0_3px_hsl(var(--focus-ring)/0.24)]">
              <SelectValue placeholder="Seleccionar empresa" />
            </SelectTrigger>
            <SelectContent>
              {companyOptions.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accessForm.companyUserId ? (
            <p className="text-xs text-muted-foreground">
              Para cambiar de empresa, crea una membresía nueva en vez de editar la actual.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Rol base</Label>
            <Select
              value={accessForm.roleId}
              onValueChange={(value) => onAccessFormChange((current) => ({ ...current, roleId: value }))}
            >
              <SelectTrigger className="h-10 focus:ring-0 focus:ring-offset-0 focus:shadow-[0_0_0_1px_hsl(var(--focus-ring)),0_0_0_3px_hsl(var(--focus-ring)/0.24)]">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {companyRoleOptions.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Estado</Label>
            <Select
              value={accessForm.status}
              onValueChange={(value: "ACTIVE" | "INACTIVE") =>
                onAccessFormChange((current) => ({ ...current, status: value }))
              }
            >
              <SelectTrigger className="h-10 focus:ring-0 focus:ring-offset-0 focus:shadow-[0_0_0_1px_hsl(var(--focus-ring)),0_0_0_3px_hsl(var(--focus-ring)/0.24)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Activa</SelectItem>
                <SelectItem value="INACTIVE">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Permisos adicionales</p>
            <p className="text-sm text-muted-foreground">
              El rol base sigue dando permisos heredados. Aquí solo definís excepciones puntuales.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2.5 shadow-none">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">Heredados</div>
              <div className="mt-2 text-[32px] font-bold leading-none text-emerald-950">{inheritedPermissionCount}</div>
            </div>
            <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 px-3 py-2.5 shadow-none">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-900">Permitir</div>
              <div className="mt-2 text-[32px] font-bold leading-none text-sky-950">{overrideStats.allow}</div>
            </div>
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 px-3 py-2.5 shadow-none">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-900">Denegar</div>
              <div className="mt-2 text-[32px] font-bold leading-none text-rose-950">{overrideStats.deny}</div>
            </div>
          </div>

          <div className="max-h-[430px] space-y-2 overflow-y-auto rounded-2xl border border-border/60 bg-muted/10 p-2.5">
            {Object.entries(permissionOptionsByModule).map(([moduleName, modulePermissions]) => (
              <div key={moduleName} className="space-y-2">
                <div className="sticky top-0 z-10 -mx-2.5 border-b border-border/60 bg-[hsl(var(--panel))]/96 px-2.5 py-1.5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {moduleName}
                  </p>
                </div>
                <div className="space-y-2">
                  {modulePermissions.map((permission) => {
                    const overrideValue = permissionOverrides[permission.id] ?? "INHERIT";
                    const inherited = inheritedRolePermissionIds.includes(permission.id);

                    return (
                      <div
                        key={permission.id}
                        className="grid items-start gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 md:grid-cols-[minmax(0,1fr)_148px]"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-medium leading-tight">{permission.description ?? permission.code}</p>
                            {inherited ? <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">Heredado por rol</Badge> : null}
                            {overrideValue === "ALLOW" ? <Badge className="h-5 rounded-full bg-sky-600 px-2 text-[10px] hover:bg-sky-600">Permitido</Badge> : null}
                            {overrideValue === "DENY" ? <Badge variant="destructive" className="h-5 rounded-full px-2 text-[10px]">Denegado</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{permission.code}</p>
                        </div>
                        <Select
                          value={overrideValue}
                          onValueChange={(value: "ALLOW" | "DENY" | "INHERIT") =>
                            onPermissionOverrideChange(permission.id, value)
                          }
                        >
                          <SelectTrigger className="h-8 focus:ring-0 focus:ring-offset-0 focus:shadow-[0_0_0_1px_hsl(var(--focus-ring)),0_0_0_3px_hsl(var(--focus-ring)/0.24)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INHERIT">Heredar</SelectItem>
                            <SelectItem value="ALLOW">Permitir</SelectItem>
                            <SelectItem value="DENY">Denegar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </EntityDialog>
  );
}
