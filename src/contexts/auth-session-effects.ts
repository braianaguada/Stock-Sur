import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseAuth } from "@/integrations/supabase/client";
import { clearStoredImpersonation, type ImpersonationMeta } from "@/contexts/auth-impersonation";

export const CURRENT_COMPANY_STORAGE_KEY = "stock-sur.current-company-id";

export function persistCurrentCompanyId(currentCompanyId: string | null) {
  if (currentCompanyId) {
    localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, currentCompanyId);
  }
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
