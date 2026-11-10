import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchX } from "lucide-react";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
  buttonClass,
  formatDateTime,
} from "@municipalos/ui";
import { SERVICE_REQUEST_STATUSES, serviceRequestStatusLabel } from "@municipalos/workflows";
import { Pagination } from "@/components/pagination";
import { ApiError, api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import type { Pagination as PaginationData, RequestListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Requests" };

const STATUS_OPTIONS = [
  { value: "open", label: "All open" },
  ...SERVICE_REQUEST_STATUSES.map((s) => ({
    value: s as string,
    label: serviceRequestStatusLabel(s),
  })),
  { value: "all", label: "All, including closed" },
];
const ASSIGNEE_OPTIONS = [
  { value: "anyone", label: "Anyone" },
  { value: "me", label: "Me" },
  { value: "unassigned", label: "Unassigned" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated", label: "Recently updated" },
];

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = (v: string | undefined, options: { value: string }[], fallback: string) =>
  v && options.some((o) => o.value === v) ? v : fallback;

const selectClass =
  "block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm text-ink";

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<Search>;
}) {
  const { city } = await params;
  const sp = await searchParams;
  const me = await getStaffMe(city);
  const slug = me.municipality.slug;

  let departments: { id: string; name: string }[];
  try {
    departments = (
      await api<{ items: { id: string; name: string }[] }>(`${base(slug)}/departments`)
    ).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }

  // Unknown filter values fall back to defaults rather than producing an error page.
  const filters = {
    status: pick(one(sp.status), STATUS_OPTIONS, "open"),
    assignee: pick(one(sp.assignee), ASSIGNEE_OPTIONS, "anyone"),
    sort: pick(one(sp.sort), SORT_OPTIONS, "newest"),
    departmentId: pick(
      one(sp.departmentId),
      departments.map((d) => ({ value: d.id })),
      "",
    ),
    q: (one(sp.q) ?? "").trim().slice(0, 100),
  };
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const query = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    return qs.toString();
  };

  let data: { items: RequestListItem[]; pagination: PaginationData };
  try {
    data = await api(`${base(slug)}/service-requests?${query(page)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }
  const filtered =
    filters.status !== "open" ||
    filters.assignee !== "anyone" ||
    Boolean(filters.departmentId || filters.q);

  return (
    <>
      <PageHeader title="Service requests" description="Requests your role allows you to see." />

      <Card className="mb-6 p-5">
        <form
          method="get"
          role="search"
          aria-label="Filter requests"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="sm:col-span-2">
            <label htmlFor="q" className="block text-sm font-medium">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Tracking number, location or description"
              className={`mt-1.5 ${selectClass}`}
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status}
              className={`mt-1.5 ${selectClass}`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium">
              Department
            </label>
            <select
              id="departmentId"
              name="departmentId"
              defaultValue={filters.departmentId}
              className={`mt-1.5 ${selectClass}`}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="assignee" className="block text-sm font-medium">
              Assigned to
            </label>
            <select
              id="assignee"
              name="assignee"
              defaultValue={filters.assignee}
              className={`mt-1.5 ${selectClass}`}
            >
              {ASSIGNEE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="block text-sm font-medium">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={filters.sort}
              className={`mt-1.5 ${selectClass}`}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button type="submit" className={buttonClass("primary")}>
              Apply filters
            </button>
            {filtered ? (
              <Link href={`/${slug}/requests`} className={buttonClass("ghost")}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-8" />}
            title={filtered ? "No requests match these filters" : "No open requests"}
            description={
              filtered
                ? "Try a different status or clear the filters."
                : "New requests from residents will appear here."
            }
            action={
              filtered ? (
                <Link href={`/${slug}/requests`} className={buttonClass("secondary")}>
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <caption className="sr-only">Service requests, {data.pagination.total} total</caption>
              <thead>
                <tr>
                  <Th>Request</Th>
                  <Th>Location</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Assigned to</Th>
                  <Th>Received</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/${slug}/requests/${r.id}`}
                        className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                      >
                        {r.reference}
                      </Link>
                      <span className="block text-ink-muted">{r.categoryName}</span>
                    </Td>
                    <Td className="min-w-48 max-w-xs">{r.locationText}</Td>
                    <Td className="whitespace-nowrap">{r.departmentName}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.assignee?.name ?? <span className="text-ink-muted">Unassigned</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {formatDateTime(r.createdAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              pagination={data.pagination}
              hrefFor={(p) => `/${slug}/requests?${query(p)}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
