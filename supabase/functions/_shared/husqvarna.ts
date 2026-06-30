import type { MowerState } from "./types.ts";

const AMC_BASE = "https://api.amc.husqvarna.dev/v1";
const AUTH_BASE = "https://api.authentication.husqvarnagroup.dev/v1";

export function isExpired(expiresAt: string, nowMs: number, skewSec = 60): boolean {
  return new Date(expiresAt).getTime() - skewSec * 1000 <= nowMs;
}

export function amcHeaders(token: string, apiKey: string): HeadersInit {
  return {
    "Authorization": `Bearer ${token}`,
    "Authorization-Provider": "husqvarna",
    "X-Api-Key": apiKey,
    "Content-Type": "application/vnd.api+json",
  };
}

export async function getMowerStatus(
  token: string, apiKey: string, mowerId: string,
): Promise<MowerState | null> {
  const res = await fetch(`${AMC_BASE}/mowers/${mowerId}`, { headers: amcHeaders(token, apiKey) });
  if (!res.ok) return null;
  const body = await res.json();
  const m = body?.data?.attributes?.mower;
  if (!m) return null;
  return {
    state: m.state ?? "",
    errorCode: m.errorCode ?? 0,
    isErrorConfirmable: m.isErrorConfirmable === true,
  };
}

export async function confirmError(token: string, apiKey: string, mowerId: string): Promise<boolean> {
  const res = await fetch(`${AMC_BASE}/mowers/${mowerId}/errors/confirm`, {
    method: "POST", headers: amcHeaders(token, apiKey),
  });
  return res.ok;
}

export async function resumeSchedule(token: string, apiKey: string, mowerId: string): Promise<boolean> {
  const res = await fetch(`${AMC_BASE}/mowers/${mowerId}/actions`, {
    method: "POST", headers: amcHeaders(token, apiKey),
    body: JSON.stringify({ data: { type: "ResumeSchedule" } }),
  });
  return res.ok;
}

export async function listMowers(
  token: string, apiKey: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${AMC_BASE}/mowers`, { headers: amcHeaders(token, apiKey) });
  if (!res.ok) return [];
  const body = await res.json();
  const data = Array.isArray(body?.data) ? body.data : [];
  return data.map((d: { id: string; attributes?: { system?: { name?: string } } }) => ({
    id: d.id,
    name: d.attributes?.system?.name ?? d.id,
  }));
}

export async function refreshAccessToken(
  clientId: string, clientSecret: string, refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? refreshToken,
    expires_in: t.expires_in,
  };
}
