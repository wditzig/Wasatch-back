import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Alert, Card, CardHeader, StatusBadge, cn, formatDateTime } from "@municipalos/ui";
import { referenceSchema } from "@municipalos/validation";
import { SERVICE_REQUEST_STATUSES, serviceRequestStatusLabel } from "@municipalos/workflows";
import { ApiError, api } from "@/lib/api";
import { requireServiceRequests } from "@/lib/services";
import type { PublicServiceRequest } from "@/lib/types";
import { MessageForm } from "./message-form";

type Props = {
  params: Promise<{ city: string; reference: string }>;
  searchParams: Promise<{ submitted?: string }>;
};

// Tracking pages are personal; keep them out of search engines.
export const metadata: Metadata = {
  title: "Request status",
  robots: { index: false, follow: false },
};

const STATUS_HELP: Record<PublicServiceRequest["status"], string> = {
  new: "We received your request. City staff will review it soon.",
  reviewed: "City staff have reviewed your request and it is waiting to be assigned.",
  assigned: "Your request has been assigned to city staff.",
  in_progress: "Work on your request is under way.",
  resolved: "City staff have marked this request as resolved.",
  closed: "This request is closed.",
};

function eventTitle(e: PublicServiceRequest["timeline"][number]): string {
  switch (e.type) {
    case "created":
      return "Request submitted";
    case "status_changed":
      return e.toStatus
        ? `Status changed to ${serviceRequestStatusLabel(e.toStatus)}`
        : "Status updated";
    case "staff_message":
      return "Message from city staff";
    case "resident_message":
      return "Information added by you";
  }
}

export default async function RequestStatusPage({ params, searchParams }: Props) {
  const { city, reference: raw } = await params;
  const site = await requireServiceRequests(city);
  const parsed = referenceSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) notFound();

  let request: PublicServiceRequest;
  try {
    request = await api<PublicServiceRequest>(
      `/v1/public/municipalities/${city}/service-requests/${parsed.data}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const justSubmitted = (await searchParams).submitted === "1";
  const currentIndex = SERVICE_REQUEST_STATUSES.indexOf(request.status);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {justSubmitted ? (
        <Alert tone="success" live title="Thank you. Your request was sent.">
          Your tracking number is <strong className="font-mono">{request.reference}</strong>. Save
          it to check progress later — this page&rsquo;s address works too.
        </Alert>
      ) : null}

      <div>
        <p className="text-sm text-ink-muted">
          Request <span className="font-mono font-medium text-ink">{request.reference}</span>
        </p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight text-ink">
          {request.categoryName}
          <StatusBadge status={request.status} />
        </h1>
        <p className="mt-2 text-ink-muted">{STATUS_HELP[request.status]}</p>
      </div>

      <Card className="p-5">
        <h2 className="sr-only">Progress</h2>
        <ol className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-6">
          {SERVICE_REQUEST_STATUSES.map((s, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={s}
                aria-current={current ? "step" : undefined}
                className="flex items-center gap-2 sm:flex-col sm:items-start"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    done && "border-city bg-city text-on-city",
                    current && "border-city text-ink",
                    !done && !current && "border-slate-300 text-ink-muted",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={cn("text-sm", current ? "font-semibold text-ink" : "text-ink-muted")}
                >
                  {serviceRequestStatusLabel(s)}
                  <span className="sr-only">
                    {done ? " (completed)" : current ? " (current)" : " (not yet reached)"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader title="What you reported" />
        <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">Description</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-ink">{request.description}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Location</dt>
            <dd className="mt-0.5 text-ink">{request.locationText}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Handled by</dt>
            <dd className="mt-0.5 text-ink">{request.departmentName}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Updates" />
        <ol className="divide-y divide-line">
          {[...request.timeline].reverse().map((e) => (
            <li key={e.id} className="px-5 py-4">
              <p className="font-medium text-ink">{eventTitle(e)}</p>
              {e.body ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{e.body}</p>
              ) : null}
              <p className="mt-1 text-xs text-ink-muted">
                <time dateTime={e.createdAt}>{formatDateTime(e.createdAt, site.timezone)}</time>
              </p>
            </li>
          ))}
        </ol>
      </Card>

      {request.status !== "closed" ? (
        <Card className="p-5">
          <MessageForm city={city} reference={request.reference} />
        </Card>
      ) : (
        <p className="text-sm text-ink-muted">
          This request is closed. If the problem is back,{" "}
          <Link href={`/${city}/report`} className="font-medium text-ink underline">
            report it again
          </Link>
          .
        </p>
      )}
    </div>
  );
}
