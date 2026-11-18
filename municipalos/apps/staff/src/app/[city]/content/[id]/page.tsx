import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert, Card, CardHeader, ContentBlocks, formatDateTime } from "@municipalos/ui";
import { ApiError, api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import { PageBadges, RevisionBadge } from "../status";
import type { PageDetail, RevisionWithBlocks } from "../types";
import { PageEditor } from "./editor";
import {
  ArchiveForm,
  NavigationForm,
  PublishForm,
  RequestChangesForm,
  RestoreForm,
} from "./review-forms";

type Props = { params: Promise<{ city: string; id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getPage = cache(async (slug: string, id: string): Promise<PageDetail> => {
  if (!UUID.test(id)) notFound();
  try {
    return await api<PageDetail>(`${base(slug)}/content/pages/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, id } = await params;
  const me = await getStaffMe(city);
  return { title: (await getPage(me.municipality.slug, id)).title };
}

function ReadOnlyContent({ revision }: { revision: RevisionWithBlocks }) {
  return (
    <div className="px-5 py-6">
      <p className="text-3xl font-semibold tracking-tight text-ink">{revision.title}</p>
      {revision.blocks.length > 0 ? (
        <ContentBlocks className="mt-6" blocks={revision.blocks} interactive={false} />
      ) : (
        <p className="mt-4 text-sm text-ink-muted">This revision has no content.</p>
      )}
    </div>
  );
}

export default async function ContentPageDetail({ params }: Props) {
  const { city, id } = await params;
  const me = await getStaffMe(city);
  const slug = me.municipality.slug;
  const page = await getPage(slug, id);
  const tz = me.timezone;
  const { working, live, scheduled, actions } = page;
  const inReview = working?.status === "in_review";
  const shown = working ?? live ?? scheduled;
  const target = { slug, pageId: page.id };

  return (
    <>
      <Link
        href={`/${slug}/content`}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Website
      </Link>
      <div className="mb-6">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight text-ink">
          {page.title}
          <PageBadges
            page={{
              isLive: live !== null,
              scheduledFor: scheduled?.publishAt ?? null,
              workingStatus: working ? (working.status as "draft" | "in_review") : null,
              isArchived: !live && !scheduled && !working && page.revisions.length > 0,
            }}
          />
        </h1>
        <p className="mt-1 font-mono text-sm text-ink-muted">/p/{page.slug}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {inReview && working ? (
            <>
              <Alert tone="info" title="Waiting for review">
                Submitted by {working.authorName ?? "staff"}
                {working.submittedAt ? ` on ${formatDateTime(working.submittedAt, tz)}` : ""}. It
                cannot be edited until a reviewer approves it or requests changes.
              </Alert>
              <Card>
                <CardHeader
                  title="Submitted version"
                  description="Exactly what will be published if approved. Links are not clickable here."
                />
                <ReadOnlyContent revision={working} />
              </Card>
              {actions.canPublish || actions.canRequestChanges ? (
                <Card>
                  <CardHeader title="Review" description="Approve this version or send it back." />
                  <div className="grid gap-8 px-5 py-5 md:grid-cols-2">
                    {actions.canPublish ? <PublishForm {...target} timezone={tz} /> : null}
                    {actions.canRequestChanges ? <RequestChangesForm {...target} /> : null}
                  </div>
                </Card>
              ) : null}
            </>
          ) : actions.canSaveDraft ? (
            <>
              {working?.reviewNote ? (
                <Alert
                  tone="warning"
                  title={`Changes requested by ${working.reviewerName ?? "the reviewer"}`}
                >
                  <p className="whitespace-pre-wrap">{working.reviewNote}</p>
                </Alert>
              ) : null}
              {!working && live ? (
                <Alert tone="info">
                  You are editing a copy of the published page. The live page stays as it is until
                  your changes are reviewed and published.
                </Alert>
              ) : null}
              <PageEditor
                slug={slug}
                pageId={page.id}
                initial={page.editorContent}
                canSubmit={actions.canSubmit}
              />
            </>
          ) : shown ? (
            <Card>
              <CardHeader
                title={working ? "Current draft" : live ? "Published version" : "Scheduled version"}
                description="You have read-only access to website content."
              />
              <ReadOnlyContent revision={shown} />
            </Card>
          ) : (
            <Card className="px-5 py-8 text-center text-sm text-ink-muted">
              This page is archived. Its content is kept in the history.
            </Card>
          )}
        </div>

        <aside aria-label="Publication" className="space-y-6">
          <Card>
            <CardHeader title="Publication" />
            <div className="space-y-4 px-5 py-4 text-sm">
              <p>
                {live ? (
                  <>
                    <span className="font-medium text-ink">Live</span> since{" "}
                    {formatDateTime(live.publishAt ?? live.publishedAt ?? live.updatedAt, tz)}.
                  </>
                ) : (
                  <span className="text-ink-muted">Not on the public website.</span>
                )}
              </p>
              {scheduled?.publishAt ? (
                <p>
                  <span className="font-medium text-ink">Scheduled:</span> a new version goes live{" "}
                  {formatDateTime(scheduled.publishAt, tz)}.
                </p>
              ) : null}
              {actions.canArchive ? <ArchiveForm {...target} /> : null}
              {actions.canRestore ? <RestoreForm {...target} /> : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Website menu" />
            <div className="px-5 py-4">
              {actions.canEditNavigation ? (
                <NavigationForm {...target} showInNav={page.showInNav} navOrder={page.navOrder} />
              ) : (
                <p className="text-sm text-ink-muted">
                  {page.showInNav ? "Shown in the website menu." : "Not shown in the website menu."}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="History" description="Every version is kept." />
            <ol className="divide-y divide-line">
              {page.revisions.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    Version {r.revisionNumber}
                    <RevisionBadge status={r.displayStatus} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {r.authorName ? `By ${r.authorName} · ` : ""}
                    {formatDateTime(r.updatedAt, tz)}
                  </p>
                  {r.reviewerName && r.status !== "draft" ? (
                    <p className="text-xs text-ink-muted">Reviewed by {r.reviewerName}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
