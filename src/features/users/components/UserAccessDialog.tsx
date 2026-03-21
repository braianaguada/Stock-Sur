import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Gestionar acceso por empresa</DialogTitle>
          <DialogDescription>
            Define la empresa, el rol base y el estado de la membresia para este usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="font-medium">{selectedUser?.full_name?.trim() || "Sin nombre cargado"}</p>
            <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select
              value={accessForm.companyId}
              onValueChange={(value) => onAccessFormChange((current) => ({ ...current, companyId: value }))}
              disabled={Boolean(accessForm.companyUserId)}
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

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-emerald-200/70 bg-emerald-50/60 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-900">Heredados</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-emerald-950">{inheritedPermissionCount}</CardContent>
              </Card>
              <Card className="border-sky-200/70 bg-sky-50/60 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-sky-900">Permitir</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-sky-950">{overrideStats.allow}</CardContent>
              </Card>
              <Card className="border-rose-200/70 bg-rose-50/60 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-rose-900">Denegar</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-rose-950">{overrideStats.deny}</CardContent>
              </Card>
            </div>

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
                              {inherited ? <Badge variant="outline">Heredado por rol</Badge> : null}
                              {overrideValue === "ALLOW" ? <Badge className="bg-sky-600 hover:bg-sky-600">Permitido</Badge> : null}
                              {overrideValue === "DENY" ? <Badge variant="destructive">Denegado</Badge> : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{permission.code}</p>
                          </div>
                          <Select
                            value={overrideValue}
                            onValueChange={(value: "ALLOW" | "DENY" | "INHERIT") =>
                              onPermissionOverrideChange(permission.id, value)
                            }
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar acceso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
