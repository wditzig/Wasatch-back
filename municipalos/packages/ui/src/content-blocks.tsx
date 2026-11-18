import type { ReactNode } from "react";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Alert, buttonClass } from "./components";
import { cn } from "./cn";

/**
 * Renders CMS content blocks. The same component draws the public page and the staff preview,
 * so what a reviewer approves is what residents get.
 *
 * Safety: every value is rendered as text (React escapes it); there is no HTML or Markdown
 * path. Link targets are validated when content is saved and checked again here, so an unsafe
 * URL that somehow reached storage is shown as plain text rather than as a link.
 */
export type ContentBlockData =
  | { type: "heading"; id: string; text: string; level: 2 | 3 }
  | { type: "text"; id: string; text: string }
  | { type: "callout"; id: string; tone: "info" | "warning"; title?: string; text: string }
  | { type: "links"; id: string; title?: string; items: { label: string; url: string }[] }
  | {
      type: "contact";
      id: string;
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      hours?: string;
    }
  | { type: "service_links"; id: string };

export interface ContentBlocksProps {
  blocks: readonly ContentBlockData[];
  /** Where the "service links" block points on the public site. */
  servicePaths?: { report: string; track: string };
  /**
   * `false` draws links as inert text. Used for the staff preview, where site-relative links
   * would otherwise resolve inside the staff application.
   */
  interactive?: boolean;
  className?: string;
}

export function isSafeHref(url: string): boolean {
  if (/[\s\\]/.test(url)) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  return /^(https:\/\/|mailto:|tel:)/i.test(url);
}

const linkClass = "font-medium text-ink underline underline-offset-2";

function SafeLink({
  href,
  interactive,
  className = linkClass,
  children,
}: {
  href: string;
  interactive: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!interactive || !isSafeHref(href)) return <span className={className}>{children}</span>;
  const external = href.startsWith("https://");
  return (
    <a href={href} className={className} rel={external ? "noopener noreferrer" : undefined}>
      {children}
    </a>
  );
}

export function ContentBlocks({
  blocks,
  servicePaths,
  interactive = true,
  className,
}: ContentBlocksProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={block.id} className="pt-2 text-2xl font-semibold tracking-tight text-ink">
                {block.text}
              </h2>
            ) : (
              <h3 key={block.id} className="text-lg font-semibold text-ink">
                {block.text}
              </h3>
            );
          case "text":
            return (
              <p
                key={block.id}
                className="max-w-prose whitespace-pre-wrap text-base leading-7 text-ink"
              >
                {block.text}
              </p>
            );
          case "callout":
            return (
              <Alert key={block.id} tone={block.tone} title={block.title} className="max-w-prose">
                <p className="whitespace-pre-wrap">{block.text}</p>
              </Alert>
            );
          case "links":
            return (
              <div key={block.id}>
                {block.title ? <p className="font-semibold text-ink">{block.title}</p> : null}
                <ul className={cn("list-disc space-y-1.5 pl-5", block.title && "mt-2")}>
                  {block.items.map((item, i) => (
                    <li key={i}>
                      <SafeLink href={item.url} interactive={interactive}>
                        {item.label}
                      </SafeLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "contact":
            return (
              <div
                key={block.id}
                className="max-w-md rounded-card border border-line bg-surface p-5 shadow-xs"
              >
                <p className="font-semibold text-ink">{block.name}</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink">
                  {block.address ? (
                    <li className="flex gap-2">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-ink-muted"
                        aria-hidden="true"
                      />
                      <span className="whitespace-pre-wrap">{block.address}</span>
                    </li>
                  ) : null}
                  {block.phone ? (
                    <li className="flex gap-2">
                      <Phone className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <SafeLink
                        href={`tel:${block.phone.replace(/[^0-9+]/g, "")}`}
                        interactive={interactive}
                        className="underline"
                      >
                        {block.phone}
                      </SafeLink>
                    </li>
                  ) : null}
                  {block.email ? (
                    <li className="flex gap-2">
                      <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <SafeLink
                        href={`mailto:${block.email}`}
                        interactive={interactive}
                        className="underline"
                      >
                        {block.email}
                      </SafeLink>
                    </li>
                  ) : null}
                  {block.hours ? (
                    <li className="flex gap-2">
                      <Clock className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      {block.hours}
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          case "service_links":
            return (
              <div key={block.id} className="flex flex-wrap gap-3">
                <SafeLink
                  href={servicePaths?.report ?? "/"}
                  interactive={interactive && Boolean(servicePaths)}
                  className={buttonClass("city", "md")}
                >
                  Report a problem <ArrowRight className="size-4" aria-hidden="true" />
                </SafeLink>
                <SafeLink
                  href={servicePaths?.track ?? "/"}
                  interactive={interactive && Boolean(servicePaths)}
                  className={buttonClass("secondary", "md")}
                >
                  Track a request
                </SafeLink>
              </div>
            );
        }
      })}
    </div>
  );
}

/** First paragraph of text in a page, for search-engine descriptions. */
export function contentExcerpt(blocks: readonly ContentBlockData[], max = 155): string | undefined {
  const first = blocks.find((b) => b.type === "text" || b.type === "callout");
  if (!first || !("text" in first)) return undefined;
  const flat = first.text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
