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
  CURRENT_COMPANY_STORAGE_KEY,
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
      const nextState = await loadAuthStateSnapshot({
        actorSession,
        currentCompanyStorageKey: CURRENT_COMPANY_STORAGE_KEY,
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

  const setCurrentCompanyId = (companyId: string) => {
    setCurrentCompanyIdState(companyId);
    persistCurrentCompanyId(companyId);
  };

  useEffect(() => {
    const subscription = subscribeToAuthSession({
      setAuthHydrated,
      setSession,
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const nextIdentityKey = `${session?.user?.id ?? "anonymous"}:${impersonationMeta?.targetUserId ?? "self"}`;
    const shouldBlockNavigation =
      !authHydrated ||
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
    persistCurrentCompanyId(currentCompanyId);
  }, [currentCompanyId]);

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
    if (!impersonationMeta || !session?.access_token) {
      await clearImpersonationState();
      return;
    }

    await requestImpersonationStop(session.access_token, impersonationMeta.impersonationId);
    await clearImpersonationState();
  };

  const signOut = async () => {
    localStorage.removeItem(CURRENT_COMPANY_STORAGE_KEY);
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
