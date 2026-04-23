import { AppErrorCode } from "./types.js";

const EXIT_CODES: Record<AppErrorCode, number> = {
  INVALID_JIRA_KEY: 2,
  JIRA_FETCH_FAILED: 3,
  GIT_DIRTY_WORKTREE: 4,
  BRANCH_ALREADY_EXISTS: 4,
  PLAN_NOT_FOUND: 4,
  STEP_NOT_FOUND: 4,
  STEP_ALREADY_COMMITTED: 4,
  VERIFY_FAILED: 5,
  DIFF_OUT_OF_SCOPE: 5,
  STATE_CORRUPTED: 4,
  CAPABILITY_UNAVAILABLE: 3,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly exitCode: number;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.exitCode = EXIT_CODES[code];
    this.cause = options?.cause;
  }
}

export class CapabilityUnavailableError extends AppError {
  constructor(message: string) {
    super("CAPABILITY_UNAVAILABLE", message);
    this.name = "CapabilityUnavailableError";
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new AppError("STATE_CORRUPTED", message, { cause: error });
}
