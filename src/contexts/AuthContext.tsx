import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/permissions";
import { canManageSettings } from "@/lib/permissions";

const SUPERADMIN_EMAILS = ["braianaguada@gmail.com"];
const CURRENT_COMPANY_STORAGE_KEY = "stock-sur.current-company-id";

export type CompanySummary = Pick<Tables<"companies">, "id" | "name" | "slug" | "status">;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  companies: CompanySummary[];
  currentCompany: CompanySummary | null;
  companyRoleCodes: string[];
  companyPermissionCodes: string[];
  isAdmin: boolean;
  loading: boolean;
  setCurrentCompanyId: (companyId: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  roles: [],
  companies: [],
  currentCompany: null,
  companyRoleCodes: [],
  companyPermissionCodes: [],
  isAdmin: false,
  loading: true,
  setCurrentCompanyId: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState<string | null>(null);
  const [companyRoleCodes, setCompanyRoleCodes] = useState<string[]>([]);
  const [companyPermissionCodes, setCompanyPermissionCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const setCurrentCompanyId = (companyId: string) => {
    setCurrentCompanyIdState(companyId);
    localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, companyId);
  };

  useEffect(() => {
    const loadAuthState = async (userId: string | null, userEmail: string | null) => {
      if (!userId) {
        setRoles([]);
        setCompanies([]);
        setCurrentCompanyIdState(null);
        setCompanyRoleCodes([]);
        setCompanyPermissionCodes([]);
        setLoading(false);
        return;
      }

      const [
        globalRolesResult,
        companiesResult,
        membershipsResult,
      ] = await Promise.all([
        supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId),
        supabase
          .from("companies")
          .select("id,name,slug,status")
          .order("name"),
        supabase
          .from("company_users")
          .select("id,company_id")
          .eq("user_id", userId)
          .eq("status", "ACTIVE"),
      ]);

      if (globalRolesResult.error) {
        const fallbackRoles: AppRole[] = userId ? ["user"] : [];
        setRoles(fallbackRoles);
      } else {
        const nextRoles = new Set<AppRole>((globalRolesResult.data ?? []).map((row) => row.role as AppRole));
        nextRoles.add("user");

        if (userEmail && SUPERADMIN_EMAILS.includes(userEmail.toLowerCase())) {
          nextRoles.add("superadmin");
          nextRoles.add("admin");
        }

        setRoles(Array.from(nextRoles));
      }

      const nextCompanies = companiesResult.data ?? [];
      setCompanies(nextCompanies);

      const membershipByCompanyId = new Map((membershipsResult.data ?? []).map((row) => [row.company_id, row.id]));
      const storedCompanyId = localStorage.getItem(CURRENT_COMPANY_STORAGE_KEY);
      const resolvedCompanyId =
        (storedCompanyId && nextCompanies.some((company) => company.id === storedCompanyId) ? storedCompanyId : null) ??
        nextCompanies[0]?.id ??
        null;

      setCurrentCompanyIdState(resolvedCompanyId);

      if (!resolvedCompanyId) {
        setCompanyRoleCodes([]);
        setCompanyPermissionCodes([]);
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setLoading(true);
        await loadAuthState(session?.user.id ?? null, session?.user.email ?? null);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await loadAuthState(session?.user.id ?? null, session?.user.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadCompanyAccess = async () => {
      const userId = session?.user?.id ?? null;

      if (!userId || !currentCompanyId) {
        setCompanyRoleCodes([]);
        setCompanyPermissionCodes([]);
        return;
      }

      const { data: companyUser } = await supabase
        .from("company_users")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", currentCompanyId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!companyUser?.id) {
        setCompanyRoleCodes([]);
        setCompanyPermissionCodes([]);
        return;
      }

      const [companyUserRolesResult, companyUserPermissionsResult] = await Promise.all([
        supabase
          .from("company_user_roles")
          .select("role_id")
          .eq("company_user_id", companyUser.id),
        supabase
          .from("company_user_permissions")
          .select("permission_id,effect")
          .eq("company_user_id", companyUser.id),
      ]);

      const roleIds = [...new Set((companyUserRolesResult.data ?? []).map((row) => row.role_id))];
      const permissionIds = [...new Set((companyUserPermissionsResult.data ?? []).map((row) => row.permission_id))];

      const [rolesCatalogResult, permissionsCatalogResult] = await Promise.all([
        roleIds.length ? supabase.from("roles").select("id,code").in("id", roleIds) : Promise.resolve({ data: [] }),
        permissionIds.length
          ? supabase.from("permissions").select("id,code").in("id", permissionIds)
          : Promise.resolve({ data: [] }),
      ]);

      const allowedPermissionIds = new Set(
        (companyUserPermissionsResult.data ?? [])
          .filter((row) => row.effect === "ALLOW")
          .map((row) => row.permission_id),
      );
      const deniedPermissionIds = new Set(
        (companyUserPermissionsResult.data ?? [])
          .filter((row) => row.effect === "DENY")
          .map((row) => row.permission_id),
      );

      setCompanyRoleCodes((rolesCatalogResult.data ?? []).map((row) => row.code));
      setCompanyPermissionCodes(
        (permissionsCatalogResult.data ?? [])
          .filter((row) => !deniedPermissionIds.has(row.id) && allowedPermissionIds.has(row.id))
          .map((row) => row.code),
      );
    };

    void loadCompanyAccess();
  }, [currentCompanyId, session?.user?.id]);

  useEffect(() => {
    if (currentCompanyId) {
      localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, currentCompanyId);
    }
  }, [currentCompanyId]);

  const signOut = async () => {
    localStorage.removeItem(CURRENT_COMPANY_STORAGE_KEY);
    await supabase.auth.signOut();
  };

  const currentCompany = companies.find((company) => company.id === currentCompanyId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        companies,
        currentCompany,
        companyRoleCodes,
        companyPermissionCodes,
        isAdmin: canManageSettings(roles),
        loading,
        setCurrentCompanyId,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
