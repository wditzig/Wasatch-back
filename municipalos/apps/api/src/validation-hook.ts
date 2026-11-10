import type { Hook } from "@hono/zod-openapi";
import type { AppEnv } from "./context";
import { AppError } from "./errors";

/** Converts schema validation failures into the standard error envelope. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validationHook: Hook<any, AppEnv, any, any> = (result) => {
  if (!result.success) {
    throw new AppError(422, "validation_failed", "Some of the information provided is not valid.", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
};
