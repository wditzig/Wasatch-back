import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  checkTransition,
  contentWorkflow as wf,
  type ContentWorkflowPermission as P,
} from "./index";

const editor = new Set<P>(["content.edit"]);
const publisher = new Set<P>(["content.edit", "content.publish"]);

describe("website content workflow", () => {
  it("lets an editor submit but never publish", () => {
    expect(checkTransition(wf, { from: "draft", to: "in_review", permissions: editor }).ok).toBe(
      true,
    );
    expect(
      checkTransition(wf, { from: "in_review", to: "published", permissions: editor }),
    ).toEqual({ ok: false, reason: "forbidden" });
    expect(availableTransitions(wf, "in_review", editor)).toEqual([]);
  });

  it("has no shortcut from draft to published, even for a publisher", () => {
    expect(checkTransition(wf, { from: "draft", to: "published", permissions: publisher })).toEqual(
      { ok: false, reason: "no_such_transition" },
    );
  });

  it("requires a note to send work back", () => {
    expect(checkTransition(wf, { from: "in_review", to: "draft", permissions: publisher })).toEqual(
      { ok: false, reason: "note_required" },
    );
    expect(
      checkTransition(wf, {
        from: "in_review",
        to: "draft",
        permissions: publisher,
        note: "Fix the hours",
      }).ok,
    ).toBe(true);
  });

  it("archives and restores; restored content must be reviewed again", () => {
    expect(
      checkTransition(wf, { from: "published", to: "archived", permissions: publisher }).ok,
    ).toBe(true);
    expect(checkTransition(wf, { from: "published", to: "archived", permissions: editor })).toEqual(
      { ok: false, reason: "forbidden" },
    );
    expect(checkTransition(wf, { from: "archived", to: "draft", permissions: editor }).ok).toBe(
      true,
    );
    expect(
      checkTransition(wf, { from: "archived", to: "published", permissions: publisher }),
    ).toEqual({ ok: false, reason: "no_such_transition" });
  });
});
