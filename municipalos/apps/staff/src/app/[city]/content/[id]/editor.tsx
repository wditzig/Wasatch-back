"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, ContentBlocks, Field } from "@municipalos/ui";
import {
  CONTENT_BLOCK_TYPES,
  type ContentBlock,
  type ContentBlockType,
} from "@municipalos/validation";
import { saveDraftAction, submitAction } from "../actions";
import { BLOCK_HELP, BLOCK_LABELS, newBlock } from "../block-labels";
import { Result } from "../result";
import type { ContentActionState } from "../types";

interface Props {
  slug: string;
  pageId: string;
  initial: { title: string; blocks: ContentBlock[]; expectedVersion: number | null };
  canSubmit: boolean;
}

const snapshot = (title: string, blocks: ContentBlock[]) => JSON.stringify({ title, blocks });
const shortId = () => crypto.randomUUID().slice(0, 8);

export function PageEditor({ slug, pageId, initial, canSubmit }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initial.blocks);
  const [saved, setSaved] = useState(() => snapshot(initial.title, initial.blocks));
  const [newType, setNewType] = useState<ContentBlockType>("text");
  const [announcement, setAnnouncement] = useState("");
  const focusNext = useRef<string | null>(null);

  const [saveState, saveAction, saving] = useActionState<ContentActionState, FormData>(
    async (prev, form) => {
      const result = await saveDraftAction(slug, pageId, prev, form);
      if (result.version) setSaved(String(form.get("snapshot")));
      return result.version ? result : { ...result, version: prev.version };
    },
    {},
  );
  const [submitState, submitFormAction, submitting] = useActionState<ContentActionState>(
    submitAction.bind(null, slug, pageId),
    {},
  );

  const version = saveState.version ?? initial.expectedVersion;
  const current = snapshot(title, blocks);
  const dirty = current !== saved;
  const hasDraft = version !== null;

  // Keep keyboard focus on the control the user just operated after blocks are reordered.
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const describe = (index: number, list = blocks) =>
    `${BLOCK_LABELS[list[index]!.type]} block ${index + 1} of ${list.length}`;

  function update(id: string, patch: Partial<ContentBlock>) {
    setBlocks((list) => list.map((b) => (b.id === id ? ({ ...b, ...patch } as ContentBlock) : b)));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setBlocks(next);
    const atEdge = target === 0 || target === next.length - 1;
    const direction = delta === -1 ? (atEdge ? "down" : "up") : atEdge ? "up" : "down";
    focusNext.current = `${item!.id}-${direction}`;
    setAnnouncement(
      `${BLOCK_LABELS[item!.type]} moved to position ${target + 1} of ${next.length}.`,
    );
  }

  function remove(index: number) {
    const removed = blocks[index]!;
    const next = blocks.filter((_, i) => i !== index);
    setBlocks(next);
    const neighbour = next[Math.min(index, next.length - 1)];
    focusNext.current = neighbour ? `${neighbour.id}-title` : "add-block-type";
    setAnnouncement(`${BLOCK_LABELS[removed.type]} removed.`);
  }

  function add() {
    const block = newBlock(newType, shortId());
    setBlocks((list) => [...list, block]);
    focusNext.current = `${block.id}-title`;
    setAnnouncement(`${BLOCK_LABELS[newType]} added at the end of the page.`);
  }

  return (
    <div className="space-y-6">
      <form action={saveAction} noValidate className="space-y-6">
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <input type="hidden" name="snapshot" value={current} />
        <input type="hidden" name="expectedVersion" value={version ?? ""} />

        <Card className="p-5">
          <Field id="page-title" label="Page title">
            {(p) => (
              <input
                {...p}
                name="title"
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
        </Card>

        <section aria-labelledby="blocks-heading" className="space-y-4">
          <h2 id="blocks-heading" className="text-base font-semibold text-ink">
            Content
          </h2>
          {blocks.length === 0 ? (
            <p className="rounded-card border border-dashed border-slate-400 bg-surface px-5 py-8 text-center text-sm text-ink-muted">
              This page has no content yet. Add a block below to get started.
            </p>
          ) : (
            <ol className="space-y-4">
              {blocks.map((block, index) => (
                <li key={block.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                      <h3
                        id={`${block.id}-title`}
                        tabIndex={-1}
                        className="text-sm font-semibold text-ink"
                      >
                        {index + 1}. {BLOCK_LABELS[block.type]}
                      </h3>
                      <div className="flex gap-1">
                        <Button
                          id={`${block.id}-up`}
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          aria-label={`Move ${describe(index)} up`}
                        >
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          id={`${block.id}-down`}
                          variant="ghost"
                          size="sm"
                          disabled={index === blocks.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label={`Move ${describe(index)} down`}
                        >
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          aria-label={`Remove ${describe(index)}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4 px-5 py-4">
                      <BlockFields block={block} update={update} />
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <Card className="flex flex-wrap items-end gap-3 p-5">
            <div className="min-w-56 flex-1">
              <Field id="add-block-type" label="Add a block" hint={BLOCK_HELP[newType]}>
                {(p) => (
                  <select
                    {...p}
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ContentBlockType)}
                  >
                    {CONTENT_BLOCK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {BLOCK_LABELS[type]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Button variant="secondary" onClick={add} disabled={blocks.length >= 40}>
              <Plus className="size-4" aria-hidden="true" />
              Add block
            </Button>
          </Card>
          <p role="status" className="sr-only">
            {announcement}
          </p>
        </section>

        <div className="space-y-3">
          <Result state={saveState} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              <Save className="size-4" aria-hidden="true" />
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <p className="text-sm text-ink-muted">
              {dirty
                ? "You have unsaved changes."
                : hasDraft
                  ? "All changes saved."
                  : "Nothing to save yet."}
            </p>
          </div>
        </div>
      </form>

      {canSubmit || hasDraft ? (
        <Card>
          <CardHeader
            title="Send for review"
            description="A reviewer must approve this draft before it appears on the public website."
          />
          <form action={submitFormAction} className="space-y-3 px-5 py-4">
            <Result state={submitState} />
            <Button type="submit" variant="secondary" disabled={submitting || dirty || !hasDraft}>
              <Send className="size-4" aria-hidden="true" />
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
            {dirty || !hasDraft ? (
              <p className="text-sm text-ink-muted">Save your changes before submitting.</p>
            ) : null}
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Preview"
          description="How this draft will look on the public website. Links are not clickable here."
        />
        <div className="px-5 py-6">
          <p className="text-3xl font-semibold tracking-tight text-ink">
            {title || "Untitled page"}
          </p>
          {blocks.length > 0 ? (
            <ContentBlocks className="mt-6" blocks={blocks} interactive={false} />
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Nothing to preview yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function BlockFields({
  block,
  update,
}: {
  block: ContentBlock;
  update: (id: string, patch: Partial<ContentBlock>) => void;
}) {
  const id = (name: string) => `${block.id}-${name}`;
  const set = (patch: Record<string, unknown>) => update(block.id, patch as Partial<ContentBlock>);

  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <Field id={id("text")} label="Heading text">
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={120}
                value={block.text}
                onChange={(e) => set({ text: e.target.value })}
              />
            )}
          </Field>
          <Field id={id("level")} label="Size">
            {(p) => (
              <select
                {...p}
                value={block.level}
                onChange={(e) => set({ level: Number(e.target.value) })}
              >
                <option value={2}>Section heading</option>
                <option value={3}>Sub-heading</option>
              </select>
            )}
          </Field>
        </div>
      );
    case "text":
      return (
        <Field
          id={id("text")}
          label="Text"
          hint="Plain text. Leave a blank line between paragraphs."
        >
          {(p) => (
            <textarea
              {...p}
              rows={6}
              maxLength={5000}
              value={block.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          )}
        </Field>
      );
    case "callout":
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <Field id={id("tone")} label="Kind">
              {(p) => (
                <select {...p} value={block.tone} onChange={(e) => set({ tone: e.target.value })}>
                  <option value="info">Information</option>
                  <option value="warning">Warning</option>
                </select>
              )}
            </Field>
            <Field id={id("title")} label="Title" optional>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  maxLength={120}
                  value={block.title ?? ""}
                  onChange={(e) => set({ title: e.target.value })}
                />
              )}
            </Field>
          </div>
          <Field id={id("text")} label="Message">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                maxLength={1000}
                value={block.text}
                onChange={(e) => set({ text: e.target.value })}
              />
            )}
          </Field>
        </>
      );
    case "links": {
      const setItem = (i: number, patch: { label?: string; url?: string }) =>
        set({ items: block.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
      return (
        <>
          <Field id={id("title")} label="List title" optional>
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={120}
                value={block.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
              />
            )}
          </Field>
          <ul className="space-y-3">
            {block.items.map((item, i) => (
              <li
                key={i}
                className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <Field id={id(`label-${i}`)} label={`Link ${i + 1} text`}>
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      maxLength={120}
                      value={item.label}
                      onChange={(e) => setItem(i, { label: e.target.value })}
                    />
                  )}
                </Field>
                <Field
                  id={id(`url-${i}`)}
                  label={`Link ${i + 1} address`}
                  hint={i === 0 ? "https://…, mailto:, tel: or /page" : undefined}
                >
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      inputMode="url"
                      maxLength={500}
                      autoCapitalize="none"
                      spellCheck={false}
                      value={item.url}
                      onChange={(e) => setItem(i, { url: e.target.value })}
                    />
                  )}
                </Field>
                <Button
                  variant="ghost"
                  disabled={block.items.length === 1}
                  onClick={() => set({ items: block.items.filter((_, j) => j !== i) })}
                  aria-label={`Remove link ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            disabled={block.items.length >= 12}
            onClick={() => set({ items: [...block.items, { label: "", url: "" }] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add link
          </Button>
        </>
      );
    }
    case "contact":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("name")} label="Name or office">
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={120}
                value={block.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            )}
          </Field>
          <Field id={id("phone")} label="Phone" optional>
            {(p) => (
              <input
                {...p}
                type="tel"
                maxLength={40}
                value={block.phone ?? ""}
                onChange={(e) => set({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field id={id("email")} label="Email" optional>
            {(p) => (
              <input
                {...p}
                type="email"
                maxLength={254}
                value={block.email ?? ""}
                onChange={(e) => set({ email: e.target.value })}
              />
            )}
          </Field>
          <Field id={id("hours")} label="Hours" optional>
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={200}
                value={block.hours ?? ""}
                onChange={(e) => set({ hours: e.target.value })}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field id={id("address")} label="Address" optional>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  maxLength={300}
                  value={block.address ?? ""}
                  onChange={(e) => set({ address: e.target.value })}
                />
              )}
            </Field>
          </div>
        </div>
      );
    case "service_links":
      return (
        <p className="text-sm text-ink-muted">
          Shows “Report a problem” and “Track a request” buttons. There is nothing to configure.
        </p>
      );
  }
}
