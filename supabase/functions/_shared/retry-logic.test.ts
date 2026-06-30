import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideRetryAction } from "./retry-logic.ts";
import type { MowerState, RetryState } from "./types.ts";

const MAX = 3;
const healthy: MowerState = { state: "RESTRICTED", errorCode: 0, isErrorConfirmable: false };
const confirmable: MowerState = { state: "ERROR", errorCode: 1, isErrorConfirmable: true };
const fatal: MowerState = { state: "FATAL_ERROR", errorCode: 2, isErrorConfirmable: false };
const fresh: RetryState = { attempts_this_error: 0, needs_manual_help: false };

Deno.test("confirmable error with attempts left -> retry", () => {
  assertEquals(decideRetryAction(confirmable, fresh, MAX), { kind: "retry" });
});

Deno.test("confirmable error at max attempts -> give_up", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: false };
  assertEquals(decideRetryAction(confirmable, s, MAX), { kind: "give_up" });
});

Deno.test("confirmable error but already needs manual help -> skip", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: true };
  assertEquals(decideRetryAction(confirmable, s, MAX), { kind: "skip" });
});

Deno.test("fatal error -> give_up (needs human)", () => {
  assertEquals(decideRetryAction(fatal, fresh, MAX), { kind: "give_up" });
});

Deno.test("healthy mower after a prior error -> recovered", () => {
  const s: RetryState = { attempts_this_error: 2, needs_manual_help: false };
  assertEquals(decideRetryAction(healthy, s, MAX), { kind: "recovered" });
});

Deno.test("healthy mower needing manual help -> recovered (clears flag)", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: true };
  assertEquals(decideRetryAction(healthy, s, MAX), { kind: "recovered" });
});

Deno.test("healthy mower with clean state -> skip", () => {
  assertEquals(decideRetryAction(healthy, fresh, MAX), { kind: "skip" });
});

Deno.test("error present but not confirmable and not fatal -> skip", () => {
  const m: MowerState = { state: "ERROR", errorCode: 5, isErrorConfirmable: false };
  assertEquals(decideRetryAction(m, fresh, MAX), { kind: "skip" });
});

Deno.test("non-confirmable error mid-episode -> skip (preserve counter)", () => {
  const m: MowerState = { state: "ERROR", errorCode: 5, isErrorConfirmable: false };
  const s: RetryState = { attempts_this_error: 2, needs_manual_help: false };
  assertEquals(decideRetryAction(m, s, MAX), { kind: "skip" });
});

Deno.test("fatal error already needing manual help -> skip", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: true };
  assertEquals(decideRetryAction(fatal, s, MAX), { kind: "skip" });
});
