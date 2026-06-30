import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySessionToken } from "../_shared/session.ts";
import { isExpired, listMowers, refreshAccessToken } from "../_shared/husqvarna.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sessionSecret = Deno.env.get("APP_SESSION_SECRET")!;
  const apiKey = Deno.env.get("HUSQVARNA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("HUSQVARNA_CLIENT_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = req.headers.get("Authorization") ?? "";
  const userId = await verifySessionToken(auth.replace(/^Bearer\s+/i, ""), sessionSecret);
  if (!userId) return json({ error: "unauthorized" }, 401);

  // Get a valid Husqvarna access token for this user (refresh if needed).
  async function validToken(): Promise<string | null> {
    const { data: acc } = await supabase.from("husqvarna_accounts")
      .select("access_token, refresh_token, expires_at").eq("user_id", userId).single();
    if (!acc) return null;
    if (!isExpired(acc.expires_at, Date.now())) return acc.access_token;
    const r = await refreshAccessToken(apiKey, clientSecret, acc.refresh_token);
    if (!r) return null;
    await supabase.from("husqvarna_accounts").update({
      access_token: r.access_token, refresh_token: r.refresh_token,
      expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    return r.access_token;
  }

  try {
    const { op, id, name, auto_retry } = await req.json();

    if (op === "list") {
      const { data: rows } = await supabase.from("mowers")
        .select("id, name, auto_retry, retry_state(needs_manual_help, attempts_this_error)")
        .eq("user_id", userId);
      const mowers = [];
      for (const r of rows ?? []) {
        const { data: log } = await supabase.from("retry_log")
          .select("occurred_at, error_code, outcome")
          .eq("mower_id", r.id).order("occurred_at", { ascending: false }).limit(10);
        const rs = Array.isArray(r.retry_state) ? r.retry_state[0] : r.retry_state;
        mowers.push({
          id: r.id, name: r.name, auto_retry: r.auto_retry,
          needs_manual_help: rs?.needs_manual_help ?? false,
          attempts: rs?.attempts_this_error ?? 0,
          log: log ?? [],
        });
      }
      return json({ mowers });
    }

    if (op === "discover") {
      const token = await validToken();
      if (!token) return json({ error: "no valid husqvarna token" }, 400);
      const all = await listMowers(token, apiKey);
      const { data: existing } = await supabase.from("mowers").select("id").eq("user_id", userId);
      const taken = new Set((existing ?? []).map((e) => e.id));
      return json({ available: all.filter((m) => !taken.has(m.id)) });
    }

    if (op === "register") {
      if (!id || !name) return json({ error: "missing id/name" }, 400);
      const { error } = await supabase.from("mowers").insert({ id, user_id: userId, name, auto_retry: true });
      if (error) return json({ error: error.message }, 400);
      await supabase.from("retry_state").insert({ mower_id: id });
      return json({ ok: true });
    }

    if (op === "toggle") {
      if (!id || typeof auto_retry !== "boolean") return json({ error: "missing id/auto_retry" }, 400);
      const { error } = await supabase.from("mowers")
        .update({ auto_retry }).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown op" }, 400);
  } catch (e) {
    console.error("app-api error", e);
    return json({ error: "internal error" }, 500);
  }
});
