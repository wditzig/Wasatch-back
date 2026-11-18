import { Alert } from "@municipalos/ui";
import type { ContentActionState } from "./types";

/** Announces the outcome of a server action next to the form that triggered it. */
export function Result({ state }: { state: ContentActionState }) {
  if (state.error) {
    return (
      <Alert tone="error" live title={state.problems?.length ? state.error : undefined}>
        {state.problems?.length ? (
          <ul className="list-disc space-y-0.5 pl-5">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          state.error
        )}
      </Alert>
    );
  }
  if (state.success) {
    return (
      <Alert tone="success" live>
        {state.success}
      </Alert>
    );
  }
  return null;
}
