import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY = "stock-sur.impersonation-access-token";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Faltan variables de entorno de Supabase. Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.",
  );
}

const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

async function getEffectiveAccessToken() {
  const impersonationToken = sessionStorage.getItem(IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY);
  if (impersonationToken) {
    return impersonationToken;
  }

  const { data } = await authClient.auth.getSession();
  return data.session?.access_token ?? null;
}

const dataClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  accessToken: getEffectiveAccessToken,
});

// `supabase` should represent the effective app identity for data access.
// Use `supabaseAuth` only when a flow must act as the real signed-in actor.
export const supabase = {
  auth: authClient.auth,
  functions: dataClient.functions,
  storage: dataClient.storage,
  realtime: dataClient.realtime,
  from: dataClient.from.bind(dataClient),
  rpc: dataClient.rpc.bind(dataClient),
  schema: dataClient.schema.bind(dataClient),
  channel: dataClient.channel.bind(dataClient),
  getChannels: dataClient.getChannels.bind(dataClient),
  removeChannel: dataClient.removeChannel.bind(dataClient),
  removeAllChannels: dataClient.removeAllChannels.bind(dataClient),
} as typeof authClient;

export {
  authClient as supabaseAuth,
  dataClient as supabaseData,
  IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY,
};
