import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  supabaseAuth,
  IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY,
} from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/permissions";
import { canManageSettings } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";

const CURRENT_COMPANY_STORAGE_KEY = "stock-sur.current-company-id";
const IMPERSONATION_META_STORAGE_KEY = "stock-sur.impersonation-meta";

export type CompanySummary = Pick<Tables<"companies">, "id" | "name" | "slug" | "status">;

type ImpersonationMeta = {
  impersonationId: string;
  actorUserId: string;
  actorEmail: string | null;
  targetUserId: string;
  targetEmail: string | null;
  expiresAt: number | null;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  actorUser: User | null;
  roles: AppRole[];
  companies: CompanySummary[];
  currentCompany: CompanySummary | null;
  companyRoleCodes: string[];
  companyPermissionCodes: string[];
  isAdmin: boolean;
  isImpersonating: boolean;
  impersonationMeta: ImpersonationMeta | null;
  loading: boolean;
  setCurrentCompanyId: (companyId: string) => void;
  startImpersonation: (params: { targetUserId: string; targetEmail?: string | null; reason?: string }) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  actorUser: null,
  roles: [],
  companies: [],
  currentCompany: null,
  companyRoleCodes: [],
  companyPermissionCodes: [],
  isAdmin: false,
  isImpersonating: false,
  impersonationMeta: null,
  loading: true,
  setCurrentCompanyId: () => {},
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
  signOut: async () => {},
});

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isImpersonationExpired(meta: ImpersonationMeta | null) {
  if (!meta?.expiresAt) return false;
  return meta.expiresAt <= Math.floor(Date.now() / 1000);
}

function readStoredImpersonationMeta() {
  const raw = sessionStorage.getItem(IMPERSONATION_META_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ImpersonationMeta;
    if (isImpersonationExpired(parsed)) {
      clearStoredImpersonation();
      return null;
    }

    return parsed;
  } catch {
    sessionStorage.removeItem(IMPERSONATION_META_STORAGE_KEY);
    return null;
  }
}

function clearStoredImpersonation() {
  sessionStorage.removeItem(IMPERSONATION_META_STORAGE_KEY);
  sessionStorage.removeItem(IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY);
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [effectiveUser, setEffectiveUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState<string | null>(null);
  const [companyRoleCodes, setCompanyRoleCodes] = useState<string[]>([]);
  const [companyPermissionCodes, setCompanyPermissionCodes] = useState<string[]>([]);
  const [impersonationMeta, setImpersonationMeta] = useState<ImpersonationMeta | null>(readStoredImpersonationMeta);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  const isImpersonating = Boolean(impersonationMeta);

  const clearAuthState = useCallback(() => {
    setEffectiveUser(null);
    setRoles([]);
    setCompanies([]);
    setCurrentCompanyIdState(null);
    setCompanyRoleCodes([]);
    setCompanyPermissionCodes([]);
  }, []);

  const syncActorSession = useCallback(async () => {
    const { data: { session: refreshedSession } } = await supabaseAuth.auth.getSession();
    setSession(refreshedSession);
    setEffectiveUser(refreshedSession?.user ?? null);
  }, []);

  const clearImpersonationState = useCallback(async () => {
    clearStoredImpersonation();
    setImpersonationMeta(null);
    setLoading(true);
    await syncActorSession();
  }, [syncActorSession]);

  const loadAuthState = useCallback(async (actorSession: Session | null, nextImpersonationMeta: ImpersonationMeta | null) => {
    try {
      const actorUser = actorSession?.user ?? null;
      const userId = nextImpersonationMeta?.targetUserId ?? actorUser?.id ?? null;
      const userEmail = nextImpersonationMeta?.targetEmail ?? actorUser?.email ?? null;

      if (!userId) {
        clearAuthState();
        return;
      }

      setEffectiveUser({
        ...(actorUser ?? { id: userId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" }),
        id: userId,
        email: userEmail ?? undefined,
      } as User);

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
        clearAuthState();
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
      }
    } catch {
      clearAuthState();
    } finally {
      setLoading(false);
    }
  }, [clearAuthState]);

  const setCurrentCompanyId = (companyId: string) => {
    setCurrentCompanyIdState(companyId);
    localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, companyId);
  };

  useEffect(() => {
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setAuthHydrated(true);
      },
    );

    supabaseAuth.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setAuthHydrated(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadAuthState(session, impersonationMeta);
  }, [impersonationMeta, loadAuthState, session]);

  useEffect(() => {
    if (!impersonationMeta) return;

    if (isImpersonationExpired(impersonationMeta)) {
      void clearImpersonationState();
      return;
    }

    if (!impersonationMeta.expiresAt) return;

    const timeoutMs = Math.max((impersonationMeta.expiresAt - Math.floor(Date.now() / 1000)) * 1000, 0);
    const timer = window.setTimeout(() => {
      void clearImpersonationState();
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [clearImpersonationState, impersonationMeta]);

  useEffect(() => {
    const loadCompanyAccess = async () => {
      const userId = effectiveUser?.id ?? null;

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
  }, [currentCompanyId, effectiveUser?.id]);

  useEffect(() => {
    if (currentCompanyId) {
      localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, currentCompanyId);
    }
  }, [currentCompanyId]);

  useEffect(() => {
    if (authHydrated && !session) {
      clearStoredImpersonation();
      setImpersonationMeta(null);
    }
  }, [authHydrated, session]);

  const startImpersonation = async (params: { targetUserId: string; targetEmail?: string | null; reason?: string }) => {
    const { targetUserId, targetEmail, reason } = params;

    if (!session?.access_token || !session.user) {
      throw new Error("Necesitás una sesión activa para impersonar.");
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonation-start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ targetUserId, reason }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, "No se pudo iniciar la impersonación."));
    }

    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : "";
    const impersonationId = typeof payload.impersonationId === "string" ? payload.impersonationId : "";
    const expiresAt = typeof payload.expiresAt === "number" ? payload.expiresAt : null;

    if (!accessToken || !impersonationId) {
      throw new Error("La respuesta de impersonación no fue válida.");
    }

    const jwtPayload = parseJwtPayload(accessToken);
    const resolvedTargetUserId =
      (typeof jwtPayload?.sub === "string" ? jwtPayload.sub : null) ?? targetUserId;
    const resolvedTargetEmail =
      (typeof jwtPayload?.email === "string" ? jwtPayload.email : null) ?? targetEmail ?? null;

    const nextImpersonationMeta: ImpersonationMeta = {
      impersonationId,
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      targetUserId: resolvedTargetUserId,
      targetEmail: resolvedTargetEmail,
      expiresAt,
    };

    sessionStorage.setItem(IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY, accessToken);
    sessionStorage.setItem(IMPERSONATION_META_STORAGE_KEY, JSON.stringify(nextImpersonationMeta));
    setImpersonationMeta(nextImpersonationMeta);
    setLoading(true);

    const { data: { session: refreshedSession } } = await supabaseAuth.auth.getSession();
    setSession(refreshedSession);
    const userEmail = nextImpersonationMeta.targetEmail ?? session.user.email ?? null;
    const actorUser = refreshedSession?.user ?? session.user;
    const effective = {
      ...(actorUser ?? { id: nextImpersonationMeta.targetUserId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" }),
      id: nextImpersonationMeta.targetUserId,
      email: userEmail ?? undefined,
    } as User;
    setEffectiveUser(effective);
  };

  const stopImpersonation = async () => {
    if (!impersonationMeta || !session?.access_token) {
      await clearImpersonationState();
      return;
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonation-stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ impersonationId: impersonationMeta.impersonationId }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, "No se pudo finalizar la impersonación."));
    }

    await clearImpersonationState();
  };

  const signOut = async () => {
    localStorage.removeItem(CURRENT_COMPANY_STORAGE_KEY);
    clearStoredImpersonation();
    setImpersonationMeta(null);
    await supabaseAuth.auth.signOut();
  };

  const currentCompany = companies.find((company) => company.id === currentCompanyId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: effectiveUser,
        actorUser: session?.user ?? null,
        roles,
        companies,
        currentCompany,
        companyRoleCodes,
        companyPermissionCodes,
        isAdmin: canManageSettings(roles),
        isImpersonating,
        impersonationMeta,
        loading,
        setCurrentCompanyId,
        startImpersonation,
        stopImpersonation,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
