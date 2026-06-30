import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

async function key(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function createSessionToken(
  userId: string, secret: string, ttlSec = 60 * 60 * 24 * 7,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return await create({ alg: "HS256", typ: "JWT" }, { sub: userId, exp }, await key(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  try {
    const payload = await verify(token, await key(secret));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
