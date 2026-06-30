import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decideRetryAction } from "../_shared/retry-logic.ts";
import {
  confirmError, getMowerStatus, isExpired, refreshAccessToken, resumeSchedule,
} from "../_shared/husqvarna.ts";

const MAX_ATTEMPTS = 3;
const cors = { "Access-Control-Allow-Origin": "*" };
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return json({ error: "forbidden" }, 403);
  }

  const apiKey = Deno.env.get("HUSQVARNA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("HUSQVARNA_CLIENT_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Mowers with auto_retry on, joined with their account + retry_state.
  const { data: mowers, error } = await supabase
    .from("mowers")
    .select("id, user_id, husqvarna_accounts!inner(access_token, refresh_token, expires_at), retry_state(attempts_this_error, needs_manual_help)")
    .eq("auto_retry", true);
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ mower: string; decision: string }> = [];

  for (const m of mowers ?? []) {
    try {
      const account = (m as unknown as { husqvarna_accounts: { access_token: string; refresh_token: string; expires_at: string } }).husqvarna_accounts;
      const rsRow = (m as { retry_state: { attempts_this_error: number; needs_manual_help: boolean } | { attempts_this_error: number; needs_manual_help: boolean }[] | null }).retry_state;
      const rs = Array.isArray(rsRow) ? rsRow[0] : rsRow;
      const state = { attempts_this_error: rs?.attempts_this_error ?? 0, needs_manual_help: rs?.needs_manual_help ?? false };

      // Refresh token if needed.
      let token = account.access_token;
      if (isExpired(account.expires_at, Date.now())) {
        const refreshed = await refreshAccessToken(apiKey, clientSecret, account.refresh_token);
        if (!refreshed) {
          results.push({ mower: m.id, decision: "auth_failed" });
          continue;
        }
        token = refreshed.access_token;
        await supabase.from("husqvarna_accounts").update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", m.user_id);
      }

      const status = await getMowerStatus(token, apiKey, m.id);
      if (!status) { results.push({ mower: m.id, decision: "status_unavailable" }); continue; }

      const decision = decideRetryAction(status, state, MAX_ATTEMPTS);
      results.push({ mower: m.id, decision: decision.kind });

      if (decision.kind === "skip") continue;

      if (decision.kind === "recovered") {
        await supabase.from("retry_state").upsert({
          mower_id: m.id, attempts_this_error: 0, needs_manual_help: false,
          resolved_at: new Date().toISOString(), last_error_code: null,
        });
        await supabase.from("retry_log").insert({ mower_id: m.id, error_code: 0, outcome: "recovered" });
        continue;
      }

      if (decision.kind === "give_up") {
        await supabase.from("retry_state").upsert({
          mower_id: m.id, needs_manual_help: true,
          attempts_this_error: state.attempts_this_error, last_error_code: status.errorCode,
        });
        await supabase.from("retry_log").insert({ mower_id: m.id, error_code: status.errorCode, outcome: "gave_up" });
        continue;
      }

      // decision.kind === "retry"
      const confirmed = await confirmError(token, apiKey, m.id);
      if (!confirmed) {
        await supabase.from("retry_log").insert({ mower_id: m.id, error_code: status.errorCode, outcome: "confirm_failed" });
        continue;
      }
      const resumed = await resumeSchedule(token, apiKey, m.id);
      await supabase.from("retry_state").upsert({
        mower_id: m.id,
        attempts_this_error: state.attempts_this_error + 1,
        needs_manual_help: false,
        last_error_code: status.errorCode,
        last_attempt_at: new Date().toISOString(),
        resolved_at: null,
      });
      await supabase.from("retry_log").insert({ mower_id: m.id, error_code: status.errorCode, outcome: resumed ? "confirmed_and_resumed" : "resume_failed" });
    } catch (e) {
      console.error(`mower ${m.id} failed`, e);
      results.push({ mower: m.id, decision: "exception" });
    }
  }

  return json({ processed: results.length, results });
});
