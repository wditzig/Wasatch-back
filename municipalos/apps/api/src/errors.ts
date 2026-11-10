import type { ContentfulStatusCode } from "hono/utils/http-status";

/** An expected failure with a stable machine-readable code. Anything else is a 500. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found.`);
export const unauthorized = () => new AppError(401, "unauthorized", "Sign in to continue.");
export const forbidden = (message = "You do not have permission to do that.") =>
  new AppError(403, "forbidden", message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
