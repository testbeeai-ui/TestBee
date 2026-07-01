export type AppErrorCode =
  | "NETWORK"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "SERVER"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, code: AppErrorCode = "UNKNOWN", status?: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
