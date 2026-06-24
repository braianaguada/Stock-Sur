import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseAuth } from "@/integrations/supabase/client";
import { clearStoredImpersonation, type ImpersonationMeta } from "@/contexts/auth-impersonation";

export const CURRENT_COMPANY_STORAGE_KEY = "stock-sur.current-company-id";

export function getCurrentCompanyStorageKey(userId: string) {
  return `${CURRENT_COMPANY_STORAGE_KEY}.${userId}`;
}

export function persistCurrentCompanyId(userId: string | null | undefined, currentCompanyId: string | null) {
  if (!userId) return;
  const storageKey = getCurrentCompanyStorageKey(userId);
  if (currentCompanyId) {
    localStorage.setItem(storageKey, currentCompanyId);
  } else {
    localStorage.removeItem(storageKey);
  }
}

export function clearPersistedCurrentCompanyId(userId: string | null | undefined) {
  if (!userId) return;
  localStorage.removeItem(getCurrentCompanyStorageKey(userId));
}

export function clearLegacyCurrentCompanyId() {
  localStorage.removeItem(CURRENT_COMPANY_STORAGE_KEY);
}

export function clearAuthSessionArtifacts(params: {
  setImpersonationMeta: Dispatch<SetStateAction<ImpersonationMeta | null>>;
}) {
  clearStoredImpersonation();
  params.setImpersonationMeta(null);
}

export async function syncActorSession(setSession: Dispatch<SetStateAction<Session | null>>) {
  const { data: { session: refreshedSession } } = await supabaseAuth.auth.getSession();
  setSession(refreshedSession);
  return refreshedSession;
}

export function subscribeToAuthSession(params: {
  setAuthHydrated: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
}) {
  const { setAuthHydrated, setSession } = params;

  const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(
    (_event, nextSession) => {
      setSession(nextSession);
      setAuthHydrated(true);
    },
  );

  void supabaseAuth.auth.getSession().then(({ data: { session: nextSession } }) => {
    setSession(nextSession);
    setAuthHydrated(true);
  });

  return subscription;
}
