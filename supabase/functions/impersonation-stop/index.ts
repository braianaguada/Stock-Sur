import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ error: "Faltan secretos requeridos en la Edge Function." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Falta el header Authorization." }, 401);
    }

    const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: actorUser },
      error: actorError,
    } = await actorClient.auth.getUser();

    if (actorError || !actorUser) {
      return json({ error: "No se pudo validar la sesión actual." }, 401);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const impersonationId = typeof body.impersonationId === "string" ? body.impersonationId : "";

    if (!impersonationId) {
      return json({ error: "Debés indicar la sesión de impersonación." }, 400);
    }

    const { data: actorIsSuperadmin, error: actorRoleError } = await serviceClient.rpc("is_superadmin", {
      _user_id: actorUser.id,
    });

    if (actorRoleError || !actorIsSuperadmin) {
      return json({ error: "Solo un superadmin puede cerrar impersonaciones." }, 403);
    }

    const { error: updateError } = await serviceClient
      .from("impersonation_sessions")
      .update({
        status: "ENDED",
        ended_at: new Date().toISOString(),
        ended_by_user_id: actorUser.id,
      })
      .eq("id", impersonationId)
      .eq("actor_user_id", actorUser.id)
      .eq("status", "ACTIVE");

    if (updateError) {
      return json({ error: "No se pudo cerrar la sesión de impersonación." }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return json({ error: message }, 500);
  }
});
