const AUTH_BASE = "https://api.authentication.husqvarnagroup.dev/v1";

export function buildAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_HUSQVARNA_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_HUSQVARNA_REDIRECT_URI,
    response_type: "code",
    scope: "iam:read amc:api",
    state: JSON.stringify({ timestamp: Date.now() }),
  });
  return `${AUTH_BASE}/oauth2/authorize?${params.toString()}`;
}
