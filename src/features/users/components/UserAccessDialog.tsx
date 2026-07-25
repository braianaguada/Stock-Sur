import { EntityDialog } from "@/components/common/EntityDialog";
import { InfoBadge, MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";
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
  isAccessSnapshotLoading: boolean;
  accessSnapshotError: string | null;
  canSave: boolean;
  onOpenChange: (open: boolean) => void;
  onAccessFormChange: (updater: (current: AccessFormState) => AccessFormState) => void;
  onPermissionOverrideChange: (permissionId: string, value: "ALLOW" | "DENY" | "INHERIT") => void;
  onRetry: () => void;
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
    isAccessSnapshotLoading,
    accessSnapshotError,
    canSave,
    onOpenChange,
    onAccessFormChange,
    onPermissionOverrideChange,
    onRetry,
    onSave,
  } = props;
  const controlsDisabled = isSaving || isAccessSnapshotLoading || Boolean(accessSnapshotError);

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Gestionar acceso por empresa"
      description="Define la empresa, el rol base y el estado de la membresia para este usuario."
      contentClassName="max-w-xl"
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isSaving || !canSave}>
            {isSaving ? "Guardando..." : "Guardar acceso"}
          </Button>
        </>
      )}
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="rounded-2xl border bg-muted/20 px-4 py-3">
          <p className="font-medium">{selectedUser?.full_name?.trim() || "Sin nombre cargado"}</p>
          <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
        </div>

        {isAccessSnapshotLoading ? (
          <div className="rounded-2xl border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            Cargando membresia, rol y permisos actuales...
          </div>
        ) : null}

        {accessSnapshotError ? (
          <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-destructive">No se pudo cargar el acceso actual</p>
              <p className="mt-1 text-sm text-muted-foreground">{accessSnapshotError}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Empresa</Label>
          <Select
            value={accessForm.companyId}
            onValueChange={(value) => onAccessFormChange((current) => ({ ...current, companyId: value }))}
            disabled={controlsDisabled || Boolean(accessForm.companyUserId)}
          >
            <SelectTrigger>
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
              Para cambiar de empresa, crea una membresia nueva en vez de editar la actual.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Rol base</Label>
            <Select
              value={accessForm.roleId}
              onValueChange={(value) => onAccessFormChange((current) => ({ ...current, roleId: value }))}
              disabled={controlsDisabled}
            >
              <SelectTrigger>
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
            <Label>Estado</Label>
            <Select
              value={accessForm.status}
              onValueChange={(value: "ACTIVE" | "INACTIVE") =>
                onAccessFormChange((current) => ({ ...current, status: value }))
              }
              disabled={controlsDisabled}
            >
              <SelectTrigger>
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
            <p className="text-sm font-medium">Permisos adicionales</p>
            <p className="text-sm text-muted-foreground">
              El rol base sigue dando permisos heredados. Aqui solo definis excepciones puntuales.
            </p>
          </div>

          <MetricGrid columns={3}>
            <MetricCard label="Heredados" value={inheritedPermissionCount} format="plain" tone="success" />
            <MetricCard label="Permitir" value={overrideStats.allow} format="plain" tone="info" />
            <MetricCard label="Denegar" value={overrideStats.deny} format="plain" tone="danger" />
          </MetricGrid>

          <div className="max-h-[320px] space-y-4 overflow-y-auto rounded-2xl border bg-muted/10 p-4">
            {Object.entries(permissionOptionsByModule).map(([moduleName, modulePermissions]) => (
              <div key={moduleName} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                        className="grid gap-3 rounded-xl border bg-background px-3 py-3 md:grid-cols-[1.2fr_180px]"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{permission.description ?? permission.code}</p>
                            {inherited ? <InfoBadge>Heredado por rol</InfoBadge> : null}
                            {overrideValue === "ALLOW" ? <StatusBadge tone="success">Permitido</StatusBadge> : null}
                            {overrideValue === "DENY" ? <StatusBadge tone="danger">Denegado</StatusBadge> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{permission.code}</p>
                        </div>
                        <Select
                          value={overrideValue}
                          onValueChange={(value: "ALLOW" | "DENY" | "INHERIT") =>
                            onPermissionOverrideChange(permission.id, value)
                          }
                          disabled={controlsDisabled}
                        >
                          <SelectTrigger>
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
