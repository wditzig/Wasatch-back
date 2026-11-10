import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { Alert, Badge, Card, CardHeader, StatusBadge, formatDateTime } from "@municipalos/ui";
import { serviceRequestStatusLabel } from "@municipalos/workflows";
import { ApiError, api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import type { AssignableStaff, RequestDetail, RequestEvent } from "@/lib/types";
import { AssignForm, CommentForm, StatusForm } from "./action-forms";

type Props = { params: Promise<{ city: string; id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN = ["new", "reviewed", "assigned", "in_progress"];

async function load(slug: string, id: string): Promise<RequestDetail> {
  if (!UUID.test(id)) notFound();
  try {
    return await api<RequestDetail>(`${base(slug)}/service-requests/${id}`);
  } catch (err) {
    // 404 also covers requests outside the caller's department; 403 means no request access at all.
    if (err instanceof ApiError && (err.status === 404 || err.status === 403 || err.status === 422))
      notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, id } = await params;
  const request = await load(city, id);
  return { title: `${request.reference} ${request.categoryName}` };
}

function describe(e: RequestEvent): { title: string; by: string } {
  const who =
    e.actorKind === "resident"
      ? "Resident"
      : e.actorKind === "system"
        ? "System"
        : (e.actorName ?? "City staff");
  switch (e.type) {
    case "created":
      return { title: "Request submitted", by: who };
    case "status_changed":
      return {
        title:
          e.fromStatus && e.toStatus
            ? `Status changed from ${serviceRequestStatusLabel(e.fromStatus)} to ${serviceRequestStatusLabel(e.toStatus)}`
            : "Status changed",
        by: who,
      };
    case "assigned":
      return { title: `Assigned to ${e.subjectName ?? "a staff member"}`, by: who };
    case "staff_note":
      return { title: "Internal note", by: who };
    case "staff_message":
      return { title: "Message to resident", by: who };
    case "resident_message":
      return { title: "Message from resident", by: who };
    default:
      return { title: e.type, by: who };
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-5 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function RequestDetailPage({ params }: Props) {
  const { city, id } = await params;
  const me = await getStaffMe(city);
  const slug = me.municipality.slug;
  const request = await load(slug, id);

  const isOpen = OPEN.includes(request.status);
  const canAssign = me.permissions.includes("service_requests.assign") && isOpen;
  const canComment = me.permissions.includes("service_requests.comment");
  const assignable = canAssign
    ? (
        await api<{ items: AssignableStaff[] }>(
          `${base(slug)}/service-requests/${id}/assignable-staff`,
        )
      ).items
    : [];
  const hasActions = request.availableTransitions.length > 0 || canAssign || canComment;
  const { reporter } = request;
  const hasReporter = Boolean(reporter.name || reporter.email || reporter.phone);

  return (
    <>
      <Link
        href={`/${slug}/requests`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All requests
      </Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {request.categoryName}{" "}
          <span className="font-normal text-ink-muted">· {request.reference}</span>
        </h1>
        <StatusBadge status={request.status} />
      </div>

      {request.possibleDuplicates.length > 0 ? (
        <Alert tone="warning" title="Possible duplicates" className="mb-6">
          <p>
            Other open requests in this category were reported at or near this location. Review
            before dispatching.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {request.possibleDuplicates.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/${slug}/requests/${d.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {d.reference}
                </Link>{" "}
                — {d.locationText} ({serviceRequestStatusLabel(d.status)}, received{" "}
                {formatDateTime(d.createdAt)})
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line">
              <Row label="Description">
                <p className="whitespace-pre-wrap">{request.description}</p>
              </Row>
              <Row label="Location">
                {request.locationText}
                {request.latitude !== null && request.longitude !== null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${request.latitude}&mlon=${request.longitude}#map=18/${request.latitude}/${request.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 font-medium text-brand-700 underline underline-offset-2"
                  >
                    {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)} on OpenStreetMap
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : null}
              </Row>
              <Row label="Department">{request.departmentName}</Row>
              <Row label="Assigned to">
                {request.assignee?.name ?? <span className="text-ink-muted">Unassigned</span>}
              </Row>
              <Row label="Reported by">
                {hasReporter ? (
                  <>
                    {reporter.name ? <span className="block">{reporter.name}</span> : null}
                    {reporter.email ? (
                      <a
                        href={`mailto:${reporter.email}`}
                        className="block text-brand-700 underline underline-offset-2"
                      >
                        {reporter.email}
                      </a>
                    ) : null}
                    {reporter.phone ? <span className="block">{reporter.phone}</span> : null}
                  </>
                ) : (
                  <span className="text-ink-muted">Anonymous — no contact details provided</span>
                )}
              </Row>
              <Row label="Received">{formatDateTime(request.createdAt)}</Row>
              <Row label="Last updated">{formatDateTime(request.updatedAt)}</Row>
              {request.resolvedAt ? (
                <Row label="Resolved">{formatDateTime(request.resolvedAt)}</Row>
              ) : null}
              {request.closedAt ? (
                <Row label="Closed">{formatDateTime(request.closedAt)}</Row>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Activity"
              description="Complete history. Items marked Internal are never shown to the resident."
            />
            <ol className="divide-y divide-line">
              {request.events.map((e) => {
                const d = describe(e);
                return (
                  <li
                    key={e.id}
                    className={
                      e.visibility === "internal" ? "bg-amber-50/60 px-5 py-3.5" : "px-5 py-3.5"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium text-ink">{d.title}</p>
                      {e.visibility === "internal" ? (
                        <Badge tone="amber">
                          <Lock className="size-3" aria-hidden="true" />
                          Internal
                        </Badge>
                      ) : null}
                    </div>
                    {e.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{e.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-muted">
                      {d.by} · <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                    </p>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <aside aria-label="Actions" className="space-y-6">
          {!hasActions ? (
            <Card className="px-5 py-4">
              <h2 className="text-base font-semibold">Actions</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Your role has read-only access to this request.
              </p>
            </Card>
          ) : null}
          {request.availableTransitions.length > 0 ? (
            <Card>
              <CardHeader title="Update status" />
              <div className="p-5">
                <StatusForm
                  slug={slug}
                  id={request.id}
                  transitions={request.availableTransitions}
                />
              </div>
            </Card>
          ) : null}
          {canAssign ? (
            <Card>
              <CardHeader title="Assignment" />
              <div className="p-5">
                {assignable.length > 0 ? (
                  <AssignForm
                    slug={slug}
                    id={request.id}
                    staff={assignable}
                    currentAssigneeId={request.assignee?.id ?? null}
                  />
                ) : (
                  <p className="text-sm text-ink-muted">
                    No staff in {request.departmentName} can be assigned yet.
                  </p>
                )}
              </div>
            </Card>
          ) : null}
          {canComment ? (
            <Card>
              <CardHeader title="Add a note or message" />
              <div className="p-5">
                <CommentForm
                  slug={slug}
                  id={request.id}
                  hasReporterEmail={Boolean(reporter.email)}
                />
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
