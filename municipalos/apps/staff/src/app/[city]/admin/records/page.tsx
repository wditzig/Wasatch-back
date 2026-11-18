import type { Metadata } from "next";
import { Archive } from "lucide-react";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  formatDate,
  formatDateTime,
} from "@municipalos/ui";
import { DispositionForm, RetentionForm } from "../forms";
import { adminContext, adminGet } from "../load";
import type { DispositionReview, RetentionPolicy } from "../types";

export const metadata: Metadata = { title: "Records" };

export default async function RecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ dispositioned?: string; skipped?: string }>;
}) {
  const query = await searchParams;
  const done = Number.parseInt(query.dispositioned ?? "", 10);
  const skipped = Number.parseInt(query.skipped ?? "0", 10) || 0;
  const { me, slug } = await adminContext(params);
  const [{ items }, review] = await Promise.all([
    adminGet<{ items: RetentionPolicy[] }>(slug, "/records/retention"),
    adminGet<DispositionReview>(slug, "/records/disposition"),
  ]);
  const policy = items[0]!;
  const tz = me.timezone;
  const dates = Object.fromEntries(review.eligible.map((r) => [r.id, formatDate(r.closedAt, tz)]));

  return (
    <>
      <PageHeader
        title="Records"
        description="How long records are kept, and review of records that have passed their retention period."
      />
      {Number.isFinite(done) ? (
        <Alert tone={done > 0 ? "success" : "warning"} live className="mb-6">
          {done} record{done === 1 ? "" : "s"} dispositioned: personal data redacted.
          {skipped > 0 ? ` ${skipped} skipped because they were no longer eligible.` : ""}
        </Alert>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Ready for review"
          value={review.eligible.length}
          hint="Past retention, not on hold"
        />
        <Stat label="On legal hold" value={review.onHold} hint="Past retention but held" />
        <Stat label="Dispositioned" value={review.dispositioned} hint="Personal data redacted" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Retention schedule"
            description={
              policy.updatedAt
                ? `Last changed ${formatDateTime(policy.updatedAt, tz)}${policy.updatedByName ? ` by ${policy.updatedByName}` : ""}.`
                : "No period set: records are kept permanently."
            }
          />
          <div className="p-5">
            <RetentionForm slug={slug} policy={policy} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Disposition review"
            description="Nothing is removed automatically. An authorized person reviews and confirms each batch."
          />
          {review.eligible.length === 0 ? (
            <EmptyState
              icon={<Archive className="size-8" />}
              title="No records are ready for disposition"
              description={
                review.retentionDays === null
                  ? "Set a retention period to start listing records here."
                  : "Closed requests appear here once their retention period has passed."
              }
            />
          ) : (
            <div className="p-5">
              <DispositionForm slug={slug} review={review} dates={dates} />
            </div>
          )}
        </Card>
      </div>
      <p className="mt-6 max-w-3xl text-sm text-ink-muted">
        To stop a record from being dispositioned — for a claim, audit or records request — open the
        request and place a legal hold. Holds, releases, schedule changes and dispositions are all
        written to the audit log.
      </p>
    </>
  );
}
