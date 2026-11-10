/**
 * Lightweight workflow engine: a workflow is plain data (states + permitted transitions).
 * The engine answers two questions and holds no state of its own:
 *   - which transitions are available from a state for a set of permissions?
 *   - is a specific transition authorized?
 * Persistence, events and notifications are the caller's job, so the same engine can back
 * service requests today and permits / approvals later.
 */
export interface WorkflowState {
  label: string;
  /** Open states count as active work. */
  open: boolean;
}

export interface WorkflowTransition<S extends string, P extends string> {
  from: S;
  to: S;
  /** Verb shown on the action button, e.g. "Mark reviewed". */
  label: string;
  permission: P;
  /** A note explaining the change is mandatory (e.g. closing without resolution). */
  requiresNote?: boolean;
  /** The target state needs an assignee; callers must use their assignment operation. */
  requiresAssignee?: boolean;
}

export interface WorkflowDefinition<S extends string, P extends string> {
  key: string;
  initial: S;
  states: Record<S, WorkflowState>;
  transitions: readonly WorkflowTransition<S, P>[];
}

export type TransitionDenial = "no_such_transition" | "forbidden" | "note_required";

export type TransitionCheck<S extends string, P extends string> =
  { ok: true; transition: WorkflowTransition<S, P> } | { ok: false; reason: TransitionDenial };

export function findTransition<S extends string, P extends string>(
  def: WorkflowDefinition<S, P>,
  from: S,
  to: S,
): WorkflowTransition<S, P> | undefined {
  return def.transitions.find((t) => t.from === from && t.to === to);
}

export function checkTransition<S extends string, P extends string>(
  def: WorkflowDefinition<S, P>,
  input: { from: S; to: S; permissions: ReadonlySet<P>; note?: string | null },
): TransitionCheck<S, P> {
  const transition = findTransition(def, input.from, input.to);
  if (!transition) return { ok: false, reason: "no_such_transition" };
  if (!input.permissions.has(transition.permission)) return { ok: false, reason: "forbidden" };
  if (transition.requiresNote && !input.note?.trim()) return { ok: false, reason: "note_required" };
  return { ok: true, transition };
}

export function availableTransitions<S extends string, P extends string>(
  def: WorkflowDefinition<S, P>,
  from: S,
  permissions: ReadonlySet<P>,
): WorkflowTransition<S, P>[] {
  return def.transitions.filter((t) => t.from === from && permissions.has(t.permission));
}

/** Validates a definition at module load so a bad workflow fails fast. */
export function defineWorkflow<S extends string, P extends string>(
  def: WorkflowDefinition<S, P>,
): WorkflowDefinition<S, P> {
  const states = new Set(Object.keys(def.states));
  if (!states.has(def.initial)) throw new Error(`Workflow ${def.key}: unknown initial state`);
  const seen = new Set<string>();
  for (const t of def.transitions) {
    if (!states.has(t.from) || !states.has(t.to)) {
      throw new Error(`Workflow ${def.key}: transition ${t.from} -> ${t.to} uses an unknown state`);
    }
    const key = `${t.from}->${t.to}`;
    if (seen.has(key)) throw new Error(`Workflow ${def.key}: duplicate transition ${key}`);
    seen.add(key);
  }
  return def;
}
