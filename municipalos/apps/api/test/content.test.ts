/**
 * Website CMS: the draft -> review -> publish workflow, scheduling, announcements, and the
 * security properties around them (who may publish, what the public can see, tenant isolation).
 */
import { schema, sql, withTenant } from "@municipalos/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CR, MS, PUB_CR, PUB_MS, USERS, createTestApp, type TestApp } from "./helpers";

const EDITOR = "nora.kim@cedarridge.example";
const CONTENT = `${CR}/content`;

let t: TestApp;
let editor: string;
let clerk: string;
let admin: string;

const textBlock = (text: string, id = "b1") => ({ type: "text", id, text });

async function createPage(slug: string, title = "Test page", token = editor) {
  const res = await t.api("POST", `${CONTENT}/pages`, { token, json: { slug, title } });
  if (res.status !== 201) throw new Error(`create page failed: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}
const detail = async (id: string, token = clerk) =>
  (await t.api("GET", `${CONTENT}/pages/${id}`, { token })).body;
const save = (
  id: string,
  body: string,
  expectedVersion: number | null,
  token = editor,
  title = "Test page",
) =>
  t.api("PUT", `${CONTENT}/pages/${id}/draft`, {
    token,
    json: { title, blocks: [textBlock(body)], expectedVersion },
  });
const submit = (id: string, token = editor) =>
  t.api("POST", `${CONTENT}/pages/${id}/submit`, { token });
const publish = (id: string, json: Record<string, unknown> = {}, token = clerk) =>
  t.api("POST", `${CONTENT}/pages/${id}/publish`, { token, json });
const publicPage = (slug: string, base = PUB_CR) => t.api("GET", `${base}/pages/${slug}`);

/** Creates a page and takes it all the way to published. */
async function publishedPage(slug: string, body: string) {
  const id = await createPage(slug);
  await save(id, body, 1);
  await submit(id);
  const res = await publish(id);
  if (res.status !== 200) throw new Error(`publish failed: ${JSON.stringify(res.body)}`);
  return id;
}

beforeAll(async () => {
  t = await createTestApp();
  [editor, clerk, admin] = await Promise.all([
    t.login(EDITOR),
    t.login(USERS.crClerk),
    t.login(USERS.crAdmin),
  ]);
});
afterAll(() => t.close());

describe("page workflow", () => {
  let id: string;

  it("creates a page as a private draft", async () => {
    id = await createPage("road-closures", "Road closures");
    const page = await detail(id);
    expect(page).toMatchObject({ slug: "road-closures", live: null, scheduled: null });
    expect(page.working).toMatchObject({
      status: "draft",
      revisionNumber: 1,
      authorName: "Nora Kim",
      blocks: [],
    });
    expect((await publicPage("road-closures")).status).toBe(404);
  });

  it("rejects duplicate and malformed slugs", async () => {
    const dup = await t.api("POST", `${CONTENT}/pages`, {
      token: editor,
      json: { slug: "road-closures", title: "Again" },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("slug_taken");
    const bad = await t.api("POST", `${CONTENT}/pages`, {
      token: editor,
      json: { slug: "Road Closures!", title: "Bad" },
    });
    expect(bad.status).toBe(422);
  });

  it("saves drafts with optimistic concurrency", async () => {
    const first = await save(id, "Main St closed Tuesday.", 1, editor, "Road closures");
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(2);
    // A second editor working from the old version must not overwrite the first.
    const stale = await save(id, "Overwritten!", 1, clerk, "Road closures");
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("stale_draft");
    expect((await detail(id)).working.blocks[0].text).toBe("Main St closed Tuesday.");
  });

  it("rejects unsafe or malformed blocks", async () => {
    const attempt = (blocks: unknown[]) =>
      t.api("PUT", `${CONTENT}/pages/${id}/draft`, {
        token: editor,
        json: { title: "Road closures", blocks, expectedVersion: 2 },
      });
    expect(
      (
        await attempt([
          { type: "links", id: "x", items: [{ label: "Click", url: "javascript:alert(1)" }] },
        ])
      ).status,
    ).toBe(422);
    expect(
      (await attempt([{ type: "html", id: "x", html: "<script>alert(1)</script>" }])).status,
    ).toBe(422);
    expect(
      (
        await attempt([
          { type: "links", id: "x", items: [{ label: "Click", url: "//evil.example" }] },
        ])
      ).status,
    ).toBe(422);
    expect((await detail(id)).working.version).toBe(2);
  });

  it("will not submit an empty page", async () => {
    const empty = await createPage("empty-page");
    const res = await submit(empty);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("empty_page");
  });

  it("lets the editor submit, which notifies publishers and locks the draft", async () => {
    expect((await submit(id)).status).toBe(200);
    expect((await detail(id)).working).toMatchObject({ status: "in_review" });
    const inbox = await t.api("GET", `${CR}/notifications`, { token: clerk });
    expect(inbox.body.items[0]).toMatchObject({
      subject: 'Page "Road closures" is waiting for review',
      entityType: "website_page",
      entityId: id,
    });
    // The author is not a publisher and is not notified about their own submission.
    const own = await t.api("GET", `${CR}/notifications`, { token: editor });
    expect(
      own.body.items.some((n: { subject: string }) => n.subject.includes("waiting for review")),
    ).toBe(false);
    const locked = await save(id, "Sneaky edit during review", 2);
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe("in_review");
    expect((await publicPage("road-closures")).status).toBe(404);
  });

  it("does not let an editor publish or decide on their own work", async () => {
    expect((await publish(id, {}, editor)).status).toBe(403);
    expect(
      (
        await t.api("POST", `${CONTENT}/pages/${id}/request-changes`, {
          token: editor,
          json: { note: "Looks fine to me" },
        })
      ).status,
    ).toBe(403);
    expect((await t.api("POST", `${CONTENT}/pages/${id}/archive`, { token: editor })).status).toBe(
      403,
    );
    expect(
      (
        await t.api("PUT", `${CONTENT}/pages/${id}/navigation`, {
          token: editor,
          json: { showInNav: true, navOrder: 1 },
        })
      ).status,
    ).toBe(403);
    expect((await detail(id, editor)).actions).toMatchObject({
      canPublish: false,
      canRequestChanges: false,
      canArchive: false,
      canEditNavigation: false,
    });
    expect((await publicPage("road-closures")).status).toBe(404);
  });

  it("lets a reviewer request changes with a note, returning the draft to the author", async () => {
    const bare = await t.api("POST", `${CONTENT}/pages/${id}/request-changes`, {
      token: clerk,
      json: { note: "" },
    });
    expect(bare.status).toBe(422);
    const res = await t.api("POST", `${CONTENT}/pages/${id}/request-changes`, {
      token: clerk,
      json: { note: "Please add the detour route." },
    });
    expect(res.status).toBe(200);
    const page = await detail(id, editor);
    expect(page.working).toMatchObject({
      status: "draft",
      reviewNote: "Please add the detour route.",
      reviewerName: "Helen Cho",
    });
    const inbox = await t.api("GET", `${CR}/notifications`, { token: editor });
    expect(inbox.body.items[0]).toMatchObject({
      subject: 'Changes requested on page "Road closures"',
      body: "Please add the detour route.",
    });
  });

  it("publishes after approval and serves the page publicly", async () => {
    const version = (await detail(id)).working.version;
    expect(
      (
        await save(
          id,
          "Main St closed Tuesday. Detour via Oak Ave.",
          version,
          editor,
          "Road closures",
        )
      ).status,
    ).toBe(200);
    expect((await submit(id)).status).toBe(200);
    expect((await publish(id)).body).toEqual({ scheduledFor: null });

    const pub = await publicPage("road-closures");
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ slug: "road-closures", title: "Road closures" });
    expect(pub.body.blocks).toEqual([textBlock("Main St closed Tuesday. Detour via Oak Ave.")]);
    // Nothing about authors, reviewers or revision history leaks to the public.
    expect(Object.keys(pub.body).sort()).toEqual(["blocks", "publishedAt", "slug", "title"]);

    const page = await detail(id);
    expect(page.working).toBeNull();
    expect(page.live).toMatchObject({
      displayStatus: "live",
      reviewerName: "Helen Cho",
      authorName: "Nora Kim",
    });
    const inbox = await t.api("GET", `${CR}/notifications`, { token: editor });
    expect(inbox.body.items[0].subject).toBe('Page "Road closures" was approved and published');
  });

  it("keeps the published revision live while a new draft is edited and reviewed", async () => {
    const started = await save(
      id,
      "NEW: closure extended to Thursday.",
      null,
      editor,
      "Road closures",
    );
    expect(started.status).toBe(200);
    expect(started.body.version).toBe(1);
    let page = await detail(id);
    expect(page.working).toMatchObject({ status: "draft", revisionNumber: 2 });
    expect(page.live.revisionNumber).toBe(1);
    expect((await publicPage("road-closures")).body.blocks[0].text).toContain("Detour via Oak Ave");

    await submit(id);
    expect((await publicPage("road-closures")).body.blocks[0].text).toContain("Detour via Oak Ave");
    await publish(id);
    expect((await publicPage("road-closures")).body.blocks[0].text).toBe(
      "NEW: closure extended to Thursday.",
    );
    page = await detail(id);
    expect(
      page.revisions.map((r: { revisionNumber: number; displayStatus: string }) => [
        r.revisionNumber,
        r.displayStatus,
      ]),
    ).toEqual([
      [2, "live"],
      [1, "superseded"],
    ]);
  });

  it("controls navigation separately, and only lists live pages", async () => {
    const nav = async () =>
      (await t.api("GET", `${PUB_CR}/pages`)).body.items.map((p: { slug: string }) => p.slug);
    expect(await nav()).not.toContain("road-closures");
    expect(
      (
        await t.api("PUT", `${CONTENT}/pages/${id}/navigation`, {
          token: clerk,
          json: { showInNav: true, navOrder: 5 },
        })
      ).status,
    ).toBe(200);
    expect(await nav()).toContain("road-closures");

    const draftOnly = await createPage("nav-draft");
    await t.api("PUT", `${CONTENT}/pages/${draftOnly}/navigation`, {
      token: clerk,
      json: { showInNav: true, navOrder: 1 },
    });
    expect(await nav()).not.toContain("nav-draft");
  });

  it("archives a page (removing it from the public site) and restores it as a draft", async () => {
    expect((await t.api("POST", `${CONTENT}/pages/${id}/archive`, { token: clerk })).status).toBe(
      200,
    );
    expect((await publicPage("road-closures")).status).toBe(404);
    expect(
      (await t.api("GET", `${PUB_CR}/pages`)).body.items.map((p: { slug: string }) => p.slug),
    ).not.toContain("road-closures");
    const list = await t.api("GET", `${CONTENT}/pages`, { token: clerk });
    expect(list.body.items.find((p: { id: string }) => p.id === id)).toMatchObject({
      isLive: false,
      isArchived: true,
    });
    expect((await t.api("POST", `${CONTENT}/pages/${id}/archive`, { token: clerk })).status).toBe(
      409,
    );

    expect((await t.api("POST", `${CONTENT}/pages/${id}/restore`, { token: editor })).status).toBe(
      200,
    );
    const page = await detail(id);
    expect(page.working).toMatchObject({ status: "draft", revisionNumber: 3 });
    expect(page.working.blocks[0].text).toBe("NEW: closure extended to Thursday.");
    // Restoring does not republish: it needs review again, and history is untouched.
    expect((await publicPage("road-closures")).status).toBe(404);
    expect(page.revisions).toHaveLength(3);
    expect((await t.api("POST", `${CONTENT}/pages/${id}/restore`, { token: editor })).status).toBe(
      409,
    );
  });

  it("writes an audit event for every step", async () => {
    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    const actions = audit.body.items
      .filter((e: { entityId: string }) => e.entityId === id)
      .map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "content.page_created",
        "content.draft_saved",
        "content.revision_submitted",
        "content.changes_requested",
        "content.revision_published",
        "content.navigation_updated",
        "content.page_archived",
        "content.page_restored",
      ]),
    );
    const published = audit.body.items.find(
      (e: { action: string; entityId: string }) =>
        e.action === "content.revision_published" && e.entityId === id,
    );
    expect(published).toMatchObject({ actorName: "Helen Cho" });
  });
});

describe("scheduled publication", () => {
  const setPublishAt = async (pageId: string, revisionNumber: number, when: Date) => {
    const [cr] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = 'cedar-ridge'`);
    await withTenant(t.handle.db, { municipalityId: cr!.id }, (tx) =>
      tx.execute(
        sql`update content_revisions set publish_at = ${when.toISOString()}::timestamptz where page_id = ${pageId} and revision_number = ${revisionNumber}`,
      ),
    );
  };
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  it("rejects a publication time in the past", async () => {
    const id = await createPage("past-schedule");
    await save(id, "Body text here.", 1);
    await submit(id);
    const res = await publish(id, { publishAt: inHours(-1) });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("publish_at_in_past");
  });

  it("keeps a scheduled first revision private until its time arrives", async () => {
    const id = await createPage("pool-opening");
    await save(id, "The pool opens June 1.", 1);
    await submit(id);
    const res = await publish(id, { publishAt: inHours(24) });
    expect(res.body.scheduledFor).toBeTruthy();
    expect((await publicPage("pool-opening")).status).toBe(404);
    const page = await detail(id);
    expect(page.live).toBeNull();
    expect(page.scheduled).toMatchObject({ displayStatus: "scheduled" });
    const list = await t.api("GET", `${CONTENT}/pages`, { token: clerk });
    expect(list.body.items.find((p: { id: string }) => p.id === id)).toMatchObject({
      isLive: false,
      scheduledFor: res.body.scheduledFor,
    });

    // Time passes: no job runs, the next read simply serves it.
    await setPublishAt(id, 1, new Date(Date.now() - 1000));
    expect((await publicPage("pool-opening")).body.blocks[0].text).toBe("The pool opens June 1.");
    expect((await detail(id)).live).toMatchObject({ displayStatus: "live", revisionNumber: 1 });
  });

  it("serves the previous revision until a scheduled replacement takes over", async () => {
    const id = await publishedPage("trash-pickup", "Pickup is on Mondays.");
    // The first revision went live an hour ago (rather than milliseconds ago).
    const [cr] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = 'cedar-ridge'`);
    await withTenant(t.handle.db, { municipalityId: cr!.id }, (tx) =>
      tx.execute(
        sql`update content_revisions set published_at = now() - interval '1 hour' where page_id = ${id} and revision_number = 1`,
      ),
    );
    await save(id, "Pickup moves to Tuesdays.", null);
    await submit(id);
    await publish(id, { publishAt: inHours(48) });
    expect((await publicPage("trash-pickup")).body.blocks[0].text).toBe("Pickup is on Mondays.");
    await setPublishAt(id, 2, new Date(Date.now() - 1000));
    expect((await publicPage("trash-pickup")).body.blocks[0].text).toBe(
      "Pickup moves to Tuesdays.",
    );
  });

  it("cancels an older scheduled revision when newer content is published first", async () => {
    const id = await publishedPage("library-hours", "Open 9 to 5.");
    await save(id, "SCHEDULED: open 9 to 7 from next month.", null);
    await submit(id);
    await publish(id, { publishAt: inHours(72) });
    await save(id, "CORRECTION: open 10 to 6.", null);
    await submit(id);
    await publish(id);
    const page = await detail(id);
    expect(page.scheduled).toBeNull();
    expect(page.live.revisionNumber).toBe(3);
    expect(
      page.revisions.find((r: { revisionNumber: number }) => r.revisionNumber === 2),
    ).toMatchObject({ displayStatus: "archived" });
    expect((await publicPage("library-hours")).body.blocks[0].text).toBe(
      "CORRECTION: open 10 to 6.",
    );
  });
});

describe("announcements", () => {
  let id: string;
  const homeTitles = async () =>
    (await t.api("GET", PUB_CR)).body.announcements.map((a: { title: string }) => a.title);

  it("are created as drafts that the public cannot see", async () => {
    const res = await t.api("POST", `${CONTENT}/announcements`, {
      token: editor,
      json: { title: "Water main flushing", body: "Crews will flush hydrants next week." },
    });
    expect(res.status).toBe(201);
    id = res.body.id;
    expect(await homeTitles()).not.toContain("Water main flushing");
    const list = await t.api("GET", `${CONTENT}/announcements`, { token: editor });
    expect(list.body.items.find((a: { id: string }) => a.id === id)).toMatchObject({
      status: "draft",
    });
    const inbox = await t.api("GET", `${CR}/notifications`, { token: clerk });
    expect(inbox.body.items[0].subject).toBe(
      'Announcement "Water main flushing" is waiting to be published',
    );
  });

  it("can be edited by an editor while unpublished, but not published by them", async () => {
    const edit = await t.api("PUT", `${CONTENT}/announcements/${id}`, {
      token: editor,
      json: { title: "Water main flushing", body: "Crews will flush hydrants April 20–24." },
    });
    expect(edit.status).toBe(200);
    expect(
      (await t.api("POST", `${CONTENT}/announcements/${id}/publish`, { token: editor, json: {} }))
        .status,
    ).toBe(403);
    expect(await homeTitles()).not.toContain("Water main flushing");
  });

  it("appear on the website once a publisher publishes them", async () => {
    const past = await t.api("POST", `${CONTENT}/announcements/${id}/publish`, {
      token: clerk,
      json: { expiresAt: new Date(Date.now() - 60_000).toISOString() },
    });
    expect(past.status).toBe(422);
    expect(
      (await t.api("POST", `${CONTENT}/announcements/${id}/publish`, { token: clerk, json: {} }))
        .status,
    ).toBe(200);
    expect(await homeTitles()).toContain("Water main flushing");
  });

  it("cannot be changed by an editor once published", async () => {
    const res = await t.api("PUT", `${CONTENT}/announcements/${id}`, {
      token: editor,
      json: { title: "Free pizza", body: "Unapproved text on the home page." },
    });
    expect(res.status).toBe(403);
    expect(await homeTitles()).not.toContain("Free pizza");
    expect(
      (
        await t.api("PUT", `${CONTENT}/announcements/${id}`, {
          token: clerk,
          json: { title: "Water main flushing", body: "Updated by the clerk." },
        })
      ).status,
    ).toBe(200);
  });

  it("stop showing when expired", async () => {
    expect(
      (await t.api("POST", `${CONTENT}/announcements/${id}/expire`, { token: editor })).status,
    ).toBe(403);
    expect(
      (await t.api("POST", `${CONTENT}/announcements/${id}/expire`, { token: clerk })).status,
    ).toBe(200);
    expect(await homeTitles()).not.toContain("Water main flushing");
    expect(
      (await t.api("POST", `${CONTENT}/announcements/${id}/expire`, { token: clerk })).status,
    ).toBe(409);
    const list = await t.api("GET", `${CONTENT}/announcements`, { token: clerk });
    expect(list.body.items.find((a: { id: string }) => a.id === id)).toMatchObject({
      status: "expired",
    });
  });
});

describe("authorization", () => {
  let pageId: string;
  beforeAll(async () => {
    pageId = await createPage("authz-page");
    await save(pageId, "Draft body.", 1);
  });

  it("gives staff without content permissions no access at all", async () => {
    const tech = await t.login(USERS.crPwTech);
    expect((await t.api("GET", `${CONTENT}/pages`, { token: tech })).status).toBe(403);
    expect((await t.api("GET", `${CONTENT}/pages/${pageId}`, { token: tech })).status).toBe(403);
    expect((await t.api("GET", `${CONTENT}/announcements`, { token: tech })).status).toBe(403);
    expect(
      (
        await t.api("POST", `${CONTENT}/pages`, {
          token: tech,
          json: { slug: "tech-page", title: "Nope" },
        })
      ).status,
    ).toBe(403);
    expect((await save(pageId, "Edited by a technician", 2, tech)).status).toBe(403);
    expect((await publish(pageId, {}, tech)).status).toBe(403);
  });

  it("keeps the auditor read-only", async () => {
    const auditor = await t.login(USERS.crAuditor);
    expect((await t.api("GET", `${CONTENT}/pages`, { token: auditor })).status).toBe(200);
    const page = await t.api("GET", `${CONTENT}/pages/${pageId}`, { token: auditor });
    expect(page.status).toBe(200);
    expect(Object.values(page.body.actions).every((v) => v === false)).toBe(true);
    expect(
      (
        await t.api("POST", `${CONTENT}/pages`, {
          token: auditor,
          json: { slug: "auditor-page", title: "Nope" },
        })
      ).status,
    ).toBe(403);
    expect((await save(pageId, "Edited by the auditor", 2, auditor)).status).toBe(403);
    expect((await submit(pageId, auditor)).status).toBe(403);
    expect(
      (
        await t.api("POST", `${CONTENT}/announcements`, {
          token: auditor,
          json: { title: "Auditor says", body: "Should not exist." },
        })
      ).status,
    ).toBe(403);
  });

  it("requires a session", async () => {
    expect((await t.api("GET", `${CONTENT}/pages`)).status).toBe(401);
    expect((await t.api("POST", `${CONTENT}/pages/${pageId}/publish`, { json: {} })).status).toBe(
      401,
    );
  });

  it("a municipal administrator can do the whole flow, but still in two steps", async () => {
    const id = await createPage("admin-page", "Admin page", admin);
    await save(id, "Written by the administrator.", 1, admin);
    // Even with every permission there is no draft -> published shortcut.
    expect((await publish(id, {}, admin)).status).toBe(409);
    expect((await submit(id, admin)).status).toBe(200);
    expect((await publish(id, {}, admin)).status).toBe(200);
    expect((await publicPage("admin-page")).status).toBe(200);
  });
});

describe("tenant isolation", () => {
  let crPage: string;
  beforeAll(async () => {
    crPage = await publishedPage("cedar-only", "Only for Cedar Ridge.");
  });

  it("does not serve one city's page under another city", async () => {
    expect((await publicPage("cedar-only")).status).toBe(200);
    expect((await publicPage("cedar-only", PUB_MS)).status).toBe(404);
    expect(
      (await t.api("GET", `${PUB_MS}/pages`)).body.items.map((p: { slug: string }) => p.slug),
    ).not.toContain("cedar-only");
  });

  it("lets two cities use the same slug independently", async () => {
    const [a, b] = [await publicPage("about"), await publicPage("about", PUB_MS)];
    expect(a.body.title).toBe("About Cedar Ridge");
    expect(b.body.title).toBe("About Marlow Springs");
  });

  it("denies another city's staff, and does not resolve foreign ids at home", async () => {
    const msAdmin = await t.login(USERS.msAdmin);
    expect((await t.api("GET", `${CONTENT}/pages`, { token: msAdmin })).status).toBe(403);
    expect((await t.api("GET", `${CONTENT}/pages/${crPage}`, { token: msAdmin })).status).toBe(403);
    const home = `${MS}/content`;
    expect((await t.api("GET", `${home}/pages/${crPage}`, { token: msAdmin })).status).toBe(404);
    expect(
      (
        await t.api("PUT", `${home}/pages/${crPage}/draft`, {
          token: msAdmin,
          json: { title: "Hijacked", blocks: [textBlock("x")], expectedVersion: null },
        })
      ).status,
    ).toBe(404);
    expect(
      (await t.api("POST", `${home}/pages/${crPage}/archive`, { token: msAdmin })).status,
    ).toBe(404);
    expect(
      (
        await t.api("PUT", `${home}/pages/${crPage}/navigation`, {
          token: msAdmin,
          json: { showInNav: true, navOrder: 0 },
        })
      ).status,
    ).toBe(404);
    const list = await t.api("GET", `${home}/pages`, { token: msAdmin });
    expect(list.body.items.some((p: { slug: string }) => p.slug === "cedar-only")).toBe(false);
    expect((await publicPage("cedar-only")).body.blocks[0].text).toBe("Only for Cedar Ridge.");
  });

  it("does not resolve another city's announcement id", async () => {
    const created = await t.api("POST", `${CONTENT}/announcements`, {
      token: clerk,
      json: { title: "Cedar Ridge only", body: "A local notice." },
    });
    const msAdmin = await t.login(USERS.msAdmin);
    const home = `${MS}/content/announcements/${created.body.id}`;
    expect(
      (
        await t.api("PUT", home, {
          token: msAdmin,
          json: { title: "Hijacked", body: "By another city." },
        })
      ).status,
    ).toBe(404);
    expect((await t.api("POST", `${home}/publish`, { token: msAdmin, json: {} })).status).toBe(404);
  });

  describe("at the database level", () => {
    const { websitePages, contentRevisions, municipalities } = schema;
    const idOf = async (slug: string) =>
      (
        await t.handle.db
          .select()
          .from(municipalities)
          .where(sql`slug = ${slug}`)
      )[0]!.id;

    it("hides both tables without a tenant and scopes unfiltered queries", async () => {
      expect(await t.handle.db.select().from(websitePages)).toEqual([]);
      expect(await t.handle.db.select().from(contentRevisions)).toEqual([]);
      const ms = await idOf("marlow-springs");
      const rows = await withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
        tx.select().from(websitePages),
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.municipalityId === ms)).toBe(true);
      const revs = await withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
        tx.select().from(contentRevisions),
      );
      expect(revs.every((r) => r.municipalityId === ms)).toBe(true);
    });

    it("refuses cross-tenant writes and references", async () => {
      const [cr, ms] = [await idOf("cedar-ridge"), await idOf("marlow-springs")];
      await expect(
        withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
          tx.insert(websitePages).values({ municipalityId: cr, slug: "planted", title: "Planted" }),
        ),
      ).rejects.toThrow();
      // A Marlow Springs revision cannot point at a Cedar Ridge page (composite foreign key).
      await expect(
        withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
          tx.insert(contentRevisions).values({
            municipalityId: ms,
            pageId: crPage,
            revisionNumber: 99,
            title: "Planted",
            status: "published",
            publishedAt: new Date(),
          }),
        ),
      ).rejects.toThrow();
      const updated = await withTenant(t.handle.db, { municipalityId: ms }, (tx) =>
        tx
          .update(contentRevisions)
          .set({ title: "tampered" })
          .where(sql`page_id = ${crPage}`)
          .returning(),
      );
      expect(updated).toEqual([]);
    });

    it("never lets the runtime role delete pages, revisions or announcements", async () => {
      const cr = await idOf("cedar-ridge");
      const run = (q: ReturnType<typeof sql>) =>
        withTenant(t.handle.db, { municipalityId: cr }, (tx) => tx.execute(q));
      await expect(run(sql`delete from content_revisions`)).rejects.toThrow();
      await expect(run(sql`delete from website_pages`)).rejects.toThrow();
      await expect(run(sql`delete from announcements`)).rejects.toThrow();
    });

    it("allows only one working revision per page", async () => {
      const cr = await idOf("cedar-ridge");
      const id = await createPage("one-draft");
      await expect(
        withTenant(t.handle.db, { municipalityId: cr }, (tx) =>
          tx
            .insert(contentRevisions)
            .values({ municipalityId: cr, pageId: id, revisionNumber: 2, title: "Second draft" }),
        ),
      ).rejects.toThrow();
    });
  });
});

describe("staff profile", () => {
  it("exposes the municipality time zone for scheduling", async () => {
    const me = await t.api("GET", `${CR}/me`, { token: editor });
    expect(me.body.timezone).toBe("America/Denver");
    expect(me.body.permissions.sort()).toEqual(["content.edit", "content.read"]);
  });
});
