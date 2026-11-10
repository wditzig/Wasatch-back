import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  checkTransition,
  defineWorkflow,
  serviceRequestWorkflow as wf,
  type ServiceRequestWorkflowPermission as P,
} from "./index";

const perms = (...p: P[]) => new Set<P>(p);
const all = perms(
  "service_requests.update_status",
  "service_requests.assign",
  "service_requests.close",
  "service_requests.reopen",
);

describe("service request workflow", () => {
  it("permits the happy path in order", () => {
    const path = ["new", "reviewed", "assigned", "in_progress", "resolved", "closed"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      const r = checkTransition(wf, { from: path[i]!, to: path[i + 1]!, permissions: all });
      expect(r.ok, `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it("rejects skipping states", () => {
    expect(checkTransition(wf, { from: "new", to: "resolved", permissions: all })).toEqual({
      ok: false,
      reason: "no_such_transition",
    });
    expect(checkTransition(wf, { from: "reviewed", to: "in_progress", permissions: all })).toEqual({
      ok: false,
      reason: "no_such_transition",
    });
  });

  it("rejects transitions the actor lacks permission for", () => {
    const employee = perms("service_requests.update_status");
    expect(checkTransition(wf, { from: "resolved", to: "closed", permissions: employee })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(
      checkTransition(wf, { from: "closed", to: "in_progress", permissions: employee, note: "x" }),
    ).toEqual({ ok: false, reason: "forbidden" });
  });

  it("requires a note to reopen or close without action", () => {
    expect(checkTransition(wf, { from: "closed", to: "in_progress", permissions: all })).toEqual({
      ok: false,
      reason: "note_required",
    });
    expect(
      checkTransition(wf, { from: "new", to: "closed", permissions: all, note: "   " }),
    ).toEqual({ ok: false, reason: "note_required" });
    expect(
      checkTransition(wf, { from: "closed", to: "in_progress", permissions: all, note: "Recurred" })
        .ok,
    ).toBe(true);
  });

  it("lists only transitions the actor may perform", () => {
    const employee = perms("service_requests.update_status");
    expect(availableTransitions(wf, "new", employee).map((t) => t.to)).toEqual(["reviewed"]);
    expect(availableTransitions(wf, "closed", employee)).toEqual([]);
    expect(availableTransitions(wf, "new", all).map((t) => t.to)).toEqual([
      "reviewed",
      "assigned",
      "closed",
    ]);
  });
});

describe("defineWorkflow", () => {
  it("rejects transitions that reference unknown states", () => {
    expect(() =>
      defineWorkflow({
        key: "bad",
        initial: "a",
        states: { a: { label: "A", open: true } },
        transitions: [{ from: "a", to: "b" as "a", label: "x", permission: "p" }],
      }),
    ).toThrow(/unknown state/);
  });
});
