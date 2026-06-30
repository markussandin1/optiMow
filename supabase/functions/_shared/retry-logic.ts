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

  // No confirmable error. If we were mid-error, the mower recovered.
  if (state.needs_manual_help || state.attempts_this_error > 0) {
    return { kind: "recovered" };
  }
  return { kind: "skip" };
}
