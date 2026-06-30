import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSessionToken } from "../_shared/session.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const clientId = Deno.env.get("HUSQVARNA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("HUSQVARNA_CLIENT_SECRET")!;
  const envRedirectUri = Deno.env.get("HUSQVARNA_REDIRECT_URI");
  const sessionSecret = Deno.env.get("APP_SESSION_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { code, redirect_uri } = await req.json();
    if (!code) return json({ error: "missing code" }, 400);
    // Use the redirect_uri the frontend actually authorized with (so local dev
    // and prod both work); fall back to the env value if not provided.
    const redirectUri = redirect_uri ?? envRedirectUri;
    if (!redirectUri) return json({ error: "missing redirect_uri" }, 400);

    const tokenRes = await fetch(
      "https://api.authentication.husqvarnagroup.dev/v1/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );
    if (!tokenRes.ok) {
      console.error("token exchange failed", tokenRes.status, await tokenRes.text());
      return json({ error: "token exchange failed" }, 400);
    }
    const t = await tokenRes.json();
    const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();

    const { error } = await supabase.from("husqvarna_accounts").upsert({
      user_id: t.user_id,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("db upsert failed", error);
      return json({ error: "failed to store account" }, 500);
    }

    const sessionToken = await createSessionToken(t.user_id, sessionSecret);
    return json({ session_token: sessionToken, user_id: t.user_id });
  } catch (e) {
    console.error("oauth exchange error", e);
    return json({ error: "internal error" }, 500);
  }
});
