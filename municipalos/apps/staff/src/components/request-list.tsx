import Link from "next/link";
import { StatusBadge, formatRelative } from "@municipalos/ui";
import type { RequestListItem } from "@/lib/types";

/** Compact list of requests used on the dashboard. */
export function RequestList({ slug, items }: { slug: string; items: RequestListItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={`/${slug}/requests/${r.id}`}
            className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {r.categoryName} <span className="font-normal text-ink-muted">· {r.reference}</span>
              </span>
              <span className="block truncate text-sm text-ink-muted">{r.locationText}</span>
              <span className="block text-xs text-ink-muted">
                Received {formatRelative(r.createdAt)}
                {r.assignee ? ` · ${r.assignee.name}` : " · Unassigned"}
              </span>
            </span>
            <StatusBadge status={r.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
