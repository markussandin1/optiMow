import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSessionToken, verifySessionToken } from "./session.ts";

const SECRET = "test-secret-please-change";

Deno.test("round-trips the user id", async () => {
  const token = await createSessionToken("user-123", SECRET);
  assertEquals(await verifySessionToken(token, SECRET), "user-123");
});

Deno.test("rejects a token signed with a different secret", async () => {
  const token = await createSessionToken("user-123", SECRET);
  assertEquals(await verifySessionToken(token, "other-secret"), null);
});

Deno.test("rejects garbage", async () => {
  assertEquals(await verifySessionToken("not-a-jwt", SECRET), null);
});
