import { AppError, type AppErrorCode } from "./AppError";

type ApiErrorBody = {
  error?: string;
  code?: string;
  message?: string;
};

export function mapApiError(status: number, body: unknown): AppError {
  const parsed = (body && typeof body === "object" ? body : {}) as ApiErrorBody;
  const message =
    parsed.error?.trim() ||
    parsed.message?.trim() ||
    `Request failed (${status})`;

  let code: AppErrorCode = "UNKNOWN";
  if (status === 401) code = "UNAUTHORIZED";
  else if (status === 403) code = "FORBIDDEN";
  else if (status === 404) code = "NOT_FOUND";
  else if (status === 429) code = "RATE_LIMITED";
  else if (status >= 400 && status < 500) code = "VALIDATION";
  else if (status >= 500) code = "SERVER";

  return new AppError(message, code, status, body);
}
