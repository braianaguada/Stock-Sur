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

      const globalRolesResult = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      let nextRoles: AppRole[];
      if (globalRolesResult.error) {
        nextRoles = userId ? ["user"] : [];
      } else {
        const roleSet = new Set<AppRole>((globalRolesResult.data ?? []).map((row) => row.role as AppRole));
        roleSet.add("user");

        if (userEmail && SUPERADMIN_EMAILS.includes(userEmail.toLowerCase())) {
          roleSet.add("superadmin");
          roleSet.add("admin");
        }

        nextRoles = Array.from(roleSet);
      }

      setRoles(nextRoles);

      const membershipsResult = await supabase
        .from("company_users")
        .select("id,company_id")
        .eq("user_id", userId)
        .eq("status", "ACTIVE");

      const membershipCompanyIds = (membershipsResult.data ?? []).map((row) => row.company_id);
      const shouldLoadAllCompanies = nextRoles.includes("superadmin");

      const companiesQuery = supabase
        .from("companies")
        .select("id,name,slug,status")
        .eq("status", "ACTIVE")
        .order("name");

      const companiesResult = shouldLoadAllCompanies
        ? await companiesQuery
        : membershipCompanyIds.length
          ? await companiesQuery.in("id", membershipCompanyIds)
          : { data: [], error: null };

      if (companiesResult.error) {
        setCompanies([]);
        setCurrentCompanyIdState(null);
        setCompanyRoleCodes([]);
        setCompanyPermissionCodes([]);
        setLoading(false);
        return;
      }

      const nextCompanies = companiesResult.data ?? [];
      setCompanies(nextCompanies);

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
      const explicitPermissionIds = [...new Set((companyUserPermissionsResult.data ?? []).map((row) => row.permission_id))];

      const [rolesCatalogResult, rolePermissionsResult] = await Promise.all([
        roleIds.length ? supabase.from("roles").select("id,code").in("id", roleIds) : Promise.resolve({ data: [] }),
        roleIds.length
          ? supabase.from("role_permissions").select("role_id, permission_id").in("role_id", roleIds)
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
      const inheritedPermissionIds = new Set((rolePermissionsResult.data ?? []).map((row) => row.permission_id));
      const effectivePermissionIds = new Set(
        [...inheritedPermissionIds, ...allowedPermissionIds].filter((permissionId) => !deniedPermissionIds.has(permissionId)),
      );
      const effectivePermissionIdList = [...effectivePermissionIds];
      const permissionsCatalogResult = effectivePermissionIdList.length
        ? await supabase.from("permissions").select("id,code").in("id", effectivePermissionIdList)
        : { data: [] };

      setCompanyRoleCodes((rolesCatalogResult.data ?? []).map((row) => row.code));
      setCompanyPermissionCodes(
        (permissionsCatalogResult.data ?? [])
          .filter((row) => effectivePermissionIds.has(row.id))
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
