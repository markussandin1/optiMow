import type { MowerState, RetryState, Decision } from "./types.ts";

function hasActiveError(m: MowerState): boolean {
  return m.errorCode > 0 || m.state === "ERROR" || m.state === "FATAL_ERROR" ||
    m.state === "ERROR_AT_POWER_UP";
}

export function decideRetryAction(
  m: MowerState,
  state: RetryState,
  maxAttempts: number,
): Decision {
  // Fatal errors always require a human.
  if (m.state === "FATAL_ERROR") {
    return state.needs_manual_help ? { kind: "skip" } : { kind: "give_up" };
  }

  const confirmable = hasActiveError(m) && m.isErrorConfirmable;
  if (confirmable) {
    if (state.needs_manual_help) return { kind: "skip" };
    if (state.attempts_this_error >= maxAttempts) return { kind: "give_up" };
    return { kind: "retry" };
  }

  // Non-confirmable, non-fatal but STILL in an error state: wait it out,
  // preserving the per-episode attempt budget (do not treat as recovery).
  if (hasActiveError(m)) return { kind: "skip" };

  // Mower is genuinely out of error. If we were mid-episode, it recovered.
  if (state.needs_manual_help || state.attempts_this_error > 0) {
    return { kind: "recovered" };
  }
  return { kind: "skip" };
}
