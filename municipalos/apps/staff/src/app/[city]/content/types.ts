import type { ContentBlock } from "@municipalos/validation";

export type RevisionDisplayStatus =
  "draft" | "in_review" | "live" | "scheduled" | "superseded" | "archived";

export interface PageListItem {
  id: string;
  slug: string;
  title: string;
  showInNav: boolean;
  navOrder: number;
  isLive: boolean;
  scheduledFor: string | null;
  workingStatus: "draft" | "in_review" | null;
  isArchived: boolean;
  updatedAt: string;
}

export interface Revision {
  id: string;
  revisionNumber: number;
  title: string;
  status: "draft" | "in_review" | "published" | "archived";
  displayStatus: RevisionDisplayStatus;
  version: number;
  authorName: string | null;
  reviewerName: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RevisionWithBlocks = Revision & { blocks: ContentBlock[] };

export interface PageDetail {
  id: string;
  slug: string;
  title: string;
  showInNav: boolean;
  navOrder: number;
  createdAt: string;
  updatedAt: string;
  live: RevisionWithBlocks | null;
  scheduled: RevisionWithBlocks | null;
  working: RevisionWithBlocks | null;
  editorContent: { title: string; blocks: ContentBlock[]; expectedVersion: number | null };
  revisions: Revision[];
  actions: {
    canSaveDraft: boolean;
    canSubmit: boolean;
    canPublish: boolean;
    canRequestChanges: boolean;
    canArchive: boolean;
    canRestore: boolean;
    canEditNavigation: boolean;
  };
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published" | "expired";
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Result of a content server action, rendered inline by the form that invoked it. */
export interface ContentActionState {
  error?: string;
  success?: string;
  /** Specific problems to list under the error (e.g. one per invalid block). */
  problems?: string[];
  /** New draft version after a successful save. */
  version?: number;
}
