import Link from "next/link";
import { buttonClass } from "@municipalos/ui";
import type { Pagination as PaginationData } from "@/lib/types";

export function Pagination({
  pagination,
  hrefFor,
}: {
  pagination: PaginationData;
  hrefFor: (page: number) => string;
}) {
  const { page, pageSize, total } = pagination;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
    >
      <p className="text-sm text-ink-muted">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={buttonClass("secondary", "sm")} rel="prev">
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={buttonClass("secondary", "sm")} rel="next">
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
