import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isExpired } from "./husqvarna.ts";

const now = 1_000_000_000_000; // fixed "now" in ms

Deno.test("token already past expiry is expired", () => {
  const past = new Date(now - 60_000).toISOString();
  assertEquals(isExpired(past, now), true);
});

Deno.test("token far in the future is not expired", () => {
  const future = new Date(now + 3_600_000).toISOString();
  assertEquals(isExpired(future, now), false);
});

Deno.test("token within skew window is treated as expired", () => {
  const soon = new Date(now + 30_000).toISOString(); // 30s left
  assertEquals(isExpired(soon, now, 60), true);       // 60s skew
});
