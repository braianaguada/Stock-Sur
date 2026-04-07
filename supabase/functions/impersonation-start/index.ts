import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@5.9.6";

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

function base64UrlToUint8Array(value: string) {
  return new TextEncoder().encode(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !jwtSecret) {
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

    const { data: actorIsSuperadmin, error: actorRoleError } = await serviceClient.rpc("is_superadmin", {
      _user_id: actorUser.id,
    });

    if (actorRoleError || !actorIsSuperadmin) {
      return json({ error: "Solo un superadmin puede impersonar usuarios." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!targetUserId) {
      return json({ error: "Debés indicar el usuario destino." }, 400);
    }

    if (targetUserId === actorUser.id) {
      return json({ error: "No podés impersonarte a vos mismo." }, 400);
    }

    const {
      data: { user: targetUser },
      error: targetError,
    } = await serviceClient.auth.admin.getUserById(targetUserId);

    if (targetError || !targetUser) {
      return json({ error: "No se encontró el usuario destino." }, 404);
    }

    const { data: targetIsSuperadmin, error: targetRoleError } = await serviceClient.rpc("is_superadmin", {
      _user_id: targetUser.id,
    });

    if (targetRoleError) {
      return json({ error: "No se pudo validar el rol del usuario destino." }, 500);
    }

    if (targetIsSuperadmin) {
      return json({ error: "No se permite impersonar otro superadmin." }, 400);
    }

    await serviceClient
      .from("impersonation_sessions")
      .update({
        status: "ENDED",
        ended_at: new Date().toISOString(),
        ended_by_user_id: actorUser.id,
        metadata: { endedBy: "new_start" },
      })
      .eq("actor_user_id", actorUser.id)
      .eq("status", "ACTIVE");

    const { data: sessionRow, error: sessionError } = await serviceClient
      .from("impersonation_sessions")
      .insert({
        actor_user_id: actorUser.id,
        target_user_id: targetUser.id,
        reason: reason || null,
        metadata: {
          actorEmail: actorUser.email ?? null,
          targetEmail: targetUser.email ?? null,
        },
      })
      .select("id, started_at")
      .single();

    if (sessionError || !sessionRow) {
      return json({ error: "No se pudo registrar la sesión de impersonación." }, 500);
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = 60 * 30;

    const accessToken = await new SignJWT({
      aud: "authenticated",
      role: "authenticated",
      email: targetUser.email ?? null,
      is_impersonation: true,
      impersonated_by: actorUser.id,
      impersonation_id: sessionRow.id,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("supabase")
      .setSubject(targetUser.id)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresInSeconds)
      .sign(base64UrlToUint8Array(jwtSecret));

    return json({
      accessToken,
      expiresAt: now + expiresInSeconds,
      impersonationId: sessionRow.id,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return json({ error: message }, 500);
  }
});
