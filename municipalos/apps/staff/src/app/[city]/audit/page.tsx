import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { Card, EmptyState, PageHeader, Table, Td, Th, formatDateTime } from "@municipalos/ui";
import { Pagination } from "@/components/pagination";
import { ApiError, api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import type { AuditEvent, Pagination as PaginationData } from "@/lib/types";

export const metadata: Metadata = { title: "Audit log" };

function summarize(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

const ACTOR_KINDS: Record<string, string> = {
  resident: "Resident",
  anonymous: "Anonymous resident",
  system: "System",
  staff: "Staff",
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { city } = await params;
  const me = await getStaffMe(city);
  const slug = me.municipality.slug;
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);

  let data: { items: AuditEvent[]; pagination: PaginationData };
  try {
    data = await api(`${base(slug)}/audit-events?page=${page}&pageSize=50`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of sign-in denials and every change to municipal records."
      />
      <Card>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-8" />}
            title="No audit events on this page"
          />
        ) : (
          <>
            <Table>
              <caption className="sr-only">Audit events, newest first</caption>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Record</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {formatDateTime(e.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {e.actorName ?? ACTOR_KINDS[e.actorKind] ?? e.actorKind}
                    </Td>
                    <Td>
                      <code className="text-xs">{e.action}</code>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {e.entityType === "service_request" && e.entityId ? (
                        <Link
                          href={`/${slug}/requests/${e.entityId}`}
                          className="text-brand-700 underline underline-offset-2"
                        >
                          {typeof e.metadata.reference === "string"
                            ? e.metadata.reference
                            : "Service request"}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td className="min-w-56 break-words text-xs text-ink-muted">
                      {summarize(e.metadata) || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              pagination={data.pagination}
              hrefFor={(p) => `/${slug}/audit${p > 1 ? `?page=${p}` : ""}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
