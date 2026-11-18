import { defineWorkflow } from "./engine";

export const CONTENT_REVISION_STATUSES = ["draft", "in_review", "published", "archived"] as const;

export type ContentRevisionStatus = (typeof CONTENT_REVISION_STATUSES)[number];

export type ContentWorkflowPermission = "content.edit" | "content.publish";

/**
 * Draft -> In review -> Published, with:
 *  - a reviewer sending work back to draft (note required),
 *  - archiving published content,
 *  - restoring archived content as a draft, which must go through review again.
 * Publishing always needs `content.publish`, so an editor without it cannot publish their own
 * work. "Scheduled" is not a state: it is a published revision whose `publish_at` is in the
 * future.
 */
export const contentWorkflow = defineWorkflow<ContentRevisionStatus, ContentWorkflowPermission>({
  key: "website_content",
  initial: "draft",
  states: {
    draft: { label: "Draft", open: true },
    in_review: { label: "In review", open: true },
    published: { label: "Published", open: false },
    archived: { label: "Archived", open: false },
  },
  transitions: [
    { from: "draft", to: "in_review", label: "Submit for review", permission: "content.edit" },
    {
      from: "in_review",
      to: "published",
      label: "Approve and publish",
      permission: "content.publish",
    },
    {
      from: "in_review",
      to: "draft",
      label: "Request changes",
      permission: "content.publish",
      requiresNote: true,
    },
    { from: "published", to: "archived", label: "Archive", permission: "content.publish" },
    { from: "archived", to: "draft", label: "Restore as draft", permission: "content.edit" },
  ],
});

export function contentStatusLabel(status: ContentRevisionStatus): string {
  return contentWorkflow.states[status].label;
}
