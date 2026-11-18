import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ContentBlocks, contentExcerpt, formatDate, type ContentBlockData } from "@municipalos/ui";
import { ApiError, api, getSite } from "@/lib/api";

type Props = { params: Promise<{ city: string; slug: string }> };

interface PublicPage {
  slug: string;
  title: string;
  blocks: ContentBlockData[];
  publishedAt: string;
}

/** Only published pages exist here: drafts and unknown addresses are the same 404. */
const getPage = cache(async (city: string, slug: string): Promise<PublicPage> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  try {
    return await api<PublicPage>(`/v1/public/municipalities/${city}/pages/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, slug } = await params;
  await getSite(city);
  const page = await getPage(city, slug);
  return { title: page.title, description: contentExcerpt(page.blocks) };
}

export default async function WebsitePage({ params }: Props) {
  const { city, slug } = await params;
  const site = await getSite(city);
  const page = await getPage(city, slug);
  const requestsEnabled = site.modules.includes("service_requests");

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{page.title}</h1>
      <ContentBlocks
        className="mt-6"
        blocks={page.blocks}
        servicePaths={
          requestsEnabled ? { report: `/${city}/report`, track: `/${city}/requests` } : undefined
        }
      />
      <p className="mt-10 border-t border-line pt-4 text-sm text-ink-muted">
        Last updated{" "}
        <time dateTime={page.publishedAt}>{formatDate(page.publishedAt, site.timezone)}</time>
      </p>
    </article>
  );
}
