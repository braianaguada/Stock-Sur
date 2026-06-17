import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabaseAuth } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";
import { canManageSettings } from "@/lib/permissions";
import {
  clearStoredImpersonation,
  ImpersonationMeta,
  isImpersonationExpired,
  persistImpersonation,
  readStoredImpersonationMeta,
  requestImpersonationStart,
  requestImpersonationStop,
} from "@/contexts/auth-impersonation";
import {
  loadAuthStateSnapshot,
  loadCompanyAccessSnapshot,
} from "@/contexts/auth-access-state";
import {
  clearAuthSessionArtifacts,
  clearLegacyCurrentCompanyId,
  clearPersistedCurrentCompanyId,
  CURRENT_COMPANY_STORAGE_KEY,
  getCurrentCompanyStorageKey,
  persistCurrentCompanyId,
  subscribeToAuthSession,
  syncActorSession,
} from "@/contexts/auth-session-effects";
import type { Tables } from "@/integrations/supabase/types";

export type CompanySummary = Pick<Tables<"companies">, "id" | "name" | "slug" | "status">;

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
  switchingCompany: boolean;
  switchCompany: (companyId: string) => Promise<CompanySummary>;
  refreshCompanies: () => Promise<void>;
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
  switchingCompany: false,
  switchCompany: async () => {
    throw new Error("No hay una sesion activa.");
  },
  refreshCompanies: async () => {},
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
  signOut: async () => {},
});

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
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const lastIdentityKeyRef = useRef<string | null>(null);

  const isImpersonating = Boolean(impersonationMeta);

  const clearAuthState = useCallback(() => {
    setEffectiveUser(null);
    setRoles([]);
    setCompanies([]);
    setCurrentCompanyIdState(null);
    setCompanyRoleCodes([]);
    setCompanyPermissionCodes([]);
  }, []);

  const syncCurrentActorSession = useCallback(async () => {
    const refreshedSession = await syncActorSession(setSession);
    setEffectiveUser(refreshedSession?.user ?? null);
  }, []);

  const clearImpersonationState = useCallback(async () => {
    clearStoredImpersonation();
    setImpersonationMeta(null);
    setLoading(true);
    await syncCurrentActorSession();
  }, [syncCurrentActorSession]);

  const loadAuthState = useCallback(async (actorSession: Session | null, nextImpersonationMeta: ImpersonationMeta | null) => {
    try {
      const nextUserId = nextImpersonationMeta?.targetUserId ?? actorSession?.user?.id ?? null;
      const nextState = await loadAuthStateSnapshot({
        actorSession,
        currentCompanyStorageKey: nextUserId
          ? getCurrentCompanyStorageKey(nextUserId)
          : CURRENT_COMPANY_STORAGE_KEY,
        impersonationMeta: nextImpersonationMeta,
      });

      if (!nextState) {
        clearAuthState();
        return;
      }

      setEffectiveUser(nextState.effectiveUser);
      setRoles(nextState.roles);
      setCompanies(nextState.companies);
      setCurrentCompanyIdState(nextState.currentCompanyId);
      persistCurrentCompanyId(nextState.effectiveUser.id, nextState.currentCompanyId);
      clearLegacyCurrentCompanyId();

      if (!nextState.currentCompanyId) {
        setCompanyRoleCodes([]);
        setCompanyPermissionCodes([]);
      }
    } catch {
      clearAuthState();
    } finally {
      setLoading(false);
    }
  }, [clearAuthState]);

  const applyAuthSnapshot = useCallback((nextState: NonNullable<Awaited<ReturnType<typeof loadAuthStateSnapshot>>>) => {
    setEffectiveUser(nextState.effectiveUser);
    setRoles(nextState.roles);
    setCompanies(nextState.companies);
    setCurrentCompanyIdState(nextState.currentCompanyId);
    persistCurrentCompanyId(nextState.effectiveUser.id, nextState.currentCompanyId);
    clearLegacyCurrentCompanyId();
  }, []);

  const switchCompany = useCallback(async (companyId: string) => {
    if (!effectiveUser?.id || !session) {
      throw new Error("Necesitas una sesion activa para cambiar de empresa.");
    }

    setSwitchingCompany(true);
    try {
      const nextState = await loadAuthStateSnapshot({
        actorSession: session,
        currentCompanyStorageKey: getCurrentCompanyStorageKey(effectiveUser.id),
        impersonationMeta,
      });

      if (!nextState) {
        clearAuthState();
        throw new Error("No se pudo validar tu acceso a empresas.");
      }

      const nextCompany = nextState.companies.find((company) => company.id === companyId) ?? null;
      if (!nextCompany) {
        applyAuthSnapshot(nextState);
        const nextAccess = await loadCompanyAccessSnapshot({
          companyId: nextState.currentCompanyId,
          userId: nextState.effectiveUser.id,
        });
        setCompanyRoleCodes(nextAccess.companyRoleCodes);
        setCompanyPermissionCodes(nextAccess.companyPermissionCodes);
        throw new Error("Tu acceso a esa empresa ya no esta disponible.");
      }

      const nextAccess = await loadCompanyAccessSnapshot({
        companyId,
        userId: nextState.effectiveUser.id,
      });

      setEffectiveUser(nextState.effectiveUser);
      setRoles(nextState.roles);
      setCompanies(nextState.companies);
      setCurrentCompanyIdState(companyId);
      setCompanyRoleCodes(nextAccess.companyRoleCodes);
      setCompanyPermissionCodes(nextAccess.companyPermissionCodes);
      persistCurrentCompanyId(nextState.effectiveUser.id, companyId);
      clearLegacyCurrentCompanyId();

      return nextCompany;
    } finally {
      setSwitchingCompany(false);
    }
  }, [applyAuthSnapshot, clearAuthState, effectiveUser?.id, impersonationMeta, session]);

  const refreshCompanies = useCallback(async () => {
    await loadAuthState(session, impersonationMeta);
  }, [impersonationMeta, loadAuthState, session]);

  useEffect(() => {
    const subscription = subscribeToAuthSession({
      setAuthHydrated,
      setSession,
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authHydrated) {
      setLoading(true);
      return;
    }

    const nextIdentityKey = `${session?.user?.id ?? "anonymous"}:${impersonationMeta?.targetUserId ?? "self"}`;
    const shouldBlockNavigation =
      lastIdentityKeyRef.current === null ||
      lastIdentityKeyRef.current !== nextIdentityKey;

    if (shouldBlockNavigation) {
      setLoading(true);
    }

    lastIdentityKeyRef.current = nextIdentityKey;
    void loadAuthState(session, impersonationMeta);
  }, [authHydrated, impersonationMeta, loadAuthState, session]);

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
      const nextAccess = await loadCompanyAccessSnapshot({
        companyId: currentCompanyId,
        userId: effectiveUser?.id ?? null,
      });

      setCompanyRoleCodes(nextAccess.companyRoleCodes);
      setCompanyPermissionCodes(nextAccess.companyPermissionCodes);
    };

    void loadCompanyAccess();
  }, [currentCompanyId, effectiveUser?.id]);

  useEffect(() => {
    persistCurrentCompanyId(effectiveUser?.id, currentCompanyId);
  }, [currentCompanyId, effectiveUser?.id]);

  useEffect(() => {
    if (authHydrated && !session) {
      clearAuthSessionArtifacts({ setImpersonationMeta });
    }
  }, [authHydrated, session]);

  const startImpersonation = async (params: { targetUserId: string; targetEmail?: string | null; reason?: string }) => {
    const { targetUserId, targetEmail, reason } = params;

    if (!session?.access_token || !session.user) {
      throw new Error("Necesitás una sesión activa para impersonar.");
    }

    const {
      accessToken,
      impersonationId,
      expiresAt,
      targetUserId: resolvedTargetUserId,
      targetEmail: resolvedJwtTargetEmail,
    } = await requestImpersonationStart({
      actorAccessToken: session.access_token,
      targetUserId,
      reason,
    });
    const resolvedTargetEmail = resolvedJwtTargetEmail ?? targetEmail ?? null;

    const nextImpersonationMeta: ImpersonationMeta = {
      impersonationId,
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      targetUserId: resolvedTargetUserId,
      targetEmail: resolvedTargetEmail,
      expiresAt,
    };

    persistImpersonation(nextImpersonationMeta, accessToken);
    setImpersonationMeta(nextImpersonationMeta);
    setLoading(true);

    const refreshedSession = await syncActorSession(setSession);
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
    if (!impersonationMeta) {
      await clearImpersonationState();
      return;
    }

    const { data: refreshData, error: refreshError } = await supabaseAuth.auth.refreshSession();
    if (refreshError) {
      throw refreshError;
    }

    const actorSession = refreshData.session ?? (await supabaseAuth.auth.getSession()).data.session;

    if (!actorSession?.access_token) {
      await clearImpersonationState();
      return;
    }

    await requestImpersonationStop(actorSession.access_token, impersonationMeta.impersonationId);
    await clearImpersonationState();
  };

  const signOut = async () => {
    clearPersistedCurrentCompanyId(effectiveUser?.id);
    clearPersistedCurrentCompanyId(session?.user?.id);
    clearLegacyCurrentCompanyId();
    clearAuthSessionArtifacts({ setImpersonationMeta });
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
        switchingCompany,
        switchCompany,
        refreshCompanies,
        startImpersonation,
        stopImpersonation,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
