import { useEffect } from "react";

type UseSessionDraftParams<TDraft> = {
  enabled: boolean;
  storageKey: string | null;
  value: TDraft;
  read: (draft: TDraft) => void;
};

export function useSessionDraft<TDraft>({
  enabled,
  storageKey,
  value,
  read,
}: UseSessionDraftParams<TDraft>) {
  useEffect(() => {
    if (!enabled || !storageKey || typeof window === "undefined") return;

    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;

    try {
      read(JSON.parse(raw) as TDraft);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [enabled, read, storageKey]);

  useEffect(() => {
    if (!enabled || !storageKey || typeof window === "undefined") return;
    sessionStorage.setItem(storageKey, JSON.stringify(value));
  }, [enabled, storageKey, value]);
}

export function clearSessionDraft(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey);
}
