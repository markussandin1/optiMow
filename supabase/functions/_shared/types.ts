// Subset of Husqvarna AMC mower status we care about
export interface MowerState {
  state: string;            // PAUSED | RESTRICTED | STOPPED | ERROR | FATAL_ERROR | ...
  errorCode: number;        // 0 when no error
  isErrorConfirmable: boolean;
}

export interface RetryState {
  attempts_this_error: number;
  needs_manual_help: boolean;
}

export type Decision =
  | { kind: "retry" }       // confirm error + ResumeSchedule, then increment attempts
  | { kind: "give_up" }     // max attempts reached -> set needs_manual_help
  | { kind: "recovered" }   // mower left the error state -> reset retry_state
  | { kind: "skip" };       // do nothing this cycle
