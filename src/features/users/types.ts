export interface UserCompanyAccess {
  companyUserId: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  status: string;
  roles: string[];
}

export interface UserAccessRow {
  user_id: string;
  email: string;
  full_name: string | null;
  global_roles: string[];
  companies: UserCompanyAccess[];
}

export interface CompanyOption {
  id: string;
  name: string;
  slug: string;
}

export interface CompanyRoleOption {
  id: string;
  code: string;
  name: string;
}

export interface AccessFormState {
  companyUserId: string | null;
  companyId: string;
  roleId: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface PermissionOption {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export type PermissionOverrideState = Record<string, "ALLOW" | "DENY" | "INHERIT">;
