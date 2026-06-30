const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function callAppApi(op: string, args: Record<string, unknown> = {}) {
  const token = localStorage.getItem("optimow_session");
  const res = await fetch(`${FUNCTIONS_URL}/app-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ op, ...args }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? `app-api ${op} failed`);
  return res.json();
}

export async function exchangeOAuthCode(code: string): Promise<{ session_token: string; user_id: string }> {
  const res = await fetch(`${FUNCTIONS_URL}/husqvarna-oauth-exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ code, redirect_uri: import.meta.env.VITE_HUSQVARNA_REDIRECT_URI }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "oauth exchange failed");
  return res.json();
}
