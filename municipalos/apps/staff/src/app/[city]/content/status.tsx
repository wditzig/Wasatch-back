import { Badge, type BadgeTone } from "@municipalos/ui";
import type { PageListItem, RevisionDisplayStatus } from "./types";

const REVISION: Record<RevisionDisplayStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  in_review: { label: "In review", tone: "amber" },
  live: { label: "Live", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  superseded: { label: "Replaced", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
};

export function RevisionBadge({ status }: { status: RevisionDisplayStatus }) {
  return <Badge tone={REVISION[status].tone}>{REVISION[status].label}</Badge>;
}

/** A page can be live and have a newer draft at the same time, so it may show two badges. */
export function PageBadges({
  page,
}: {
  page: Pick<PageListItem, "isLive" | "scheduledFor" | "workingStatus" | "isArchived">;
}) {
  const none = !page.isLive && !page.scheduledFor && !page.workingStatus && !page.isArchived;
  return (
    <span className="flex flex-wrap gap-1.5">
      {page.isLive ? <RevisionBadge status="live" /> : null}
      {page.scheduledFor ? <RevisionBadge status="scheduled" /> : null}
      {page.workingStatus ? <RevisionBadge status={page.workingStatus} /> : null}
      {page.isArchived ? <RevisionBadge status="archived" /> : null}
      {none ? <Badge>Empty</Badge> : null}
    </span>
  );
}
