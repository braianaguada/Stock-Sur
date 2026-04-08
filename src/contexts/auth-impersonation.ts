import { getErrorMessage } from "@/lib/errors";
import { IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY } from "@/integrations/supabase/client";

export const IMPERSONATION_META_STORAGE_KEY = "stock-sur.impersonation-meta";

export type ImpersonationMeta = {
  impersonationId: string;
  actorUserId: string;
  actorEmail: string | null;
  targetUserId: string;
  targetEmail: string | null;
  expiresAt: number | null;
};

export function parseJwtPayload(token: string): Record<string, unknown> | null {
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

export function isImpersonationExpired(meta: ImpersonationMeta | null) {
  if (!meta?.expiresAt) return false;
  return meta.expiresAt <= Math.floor(Date.now() / 1000);
}

export function clearStoredImpersonation() {
  sessionStorage.removeItem(IMPERSONATION_META_STORAGE_KEY);
  sessionStorage.removeItem(IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY);
}

export function readStoredImpersonationMeta() {
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

type StartImpersonationParams = {
  actorAccessToken: string;
  targetUserId: string;
  reason?: string;
};

type StartImpersonationResult = {
  accessToken: string;
  impersonationId: string;
  expiresAt: number | null;
  targetUserId: string;
  targetEmail: string | null;
};

export async function requestImpersonationStart({
  actorAccessToken,
  targetUserId,
  reason,
}: StartImpersonationParams): Promise<StartImpersonationResult> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonation-start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${actorAccessToken}`,
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

  return {
    accessToken,
    impersonationId,
    expiresAt,
    targetUserId: (typeof jwtPayload?.sub === "string" ? jwtPayload.sub : null) ?? targetUserId,
    targetEmail: (typeof jwtPayload?.email === "string" ? jwtPayload.email : null) ?? null,
  };
}

export async function requestImpersonationStop(actorAccessToken: string, impersonationId: string) {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonation-stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${actorAccessToken}`,
    },
    body: JSON.stringify({ impersonationId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "No se pudo finalizar la impersonación."));
  }
}

export function persistImpersonation(meta: ImpersonationMeta, accessToken: string) {
  sessionStorage.setItem(IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY, accessToken);
  sessionStorage.setItem(IMPERSONATION_META_STORAGE_KEY, JSON.stringify(meta));
}
