/**
 * Photo uploads: validation, sanitising, limits, and who can read the bytes.
 */
import { schema, sql, withTenant } from "@municipalos/database";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CR,
  MS,
  PUB_CR,
  PUB_MS,
  USERS,
  createTestApp,
  submitRequest,
  type TestApp,
} from "./helpers";

let t: TestApp;
let request: { id: string; reference: string };
let other: { id: string; reference: string };
let photoId: string;

const image = (width = 640, height = 480) =>
  sharp({ create: { width, height, channels: 3, background: { r: 90, g: 120, b: 60 } } });

beforeAll(async () => {
  t = await createTestApp();
  request = await submitRequest(t);
  other = await submitRequest(t);
});
afterAll(() => t.close());

describe("resident photo upload", () => {
  it("stores a photo as a re-encoded JPEG with all metadata removed", async () => {
    const withGps = await image()
      .withExif({
        IFD0: { Make: "TestCam", Artist: "Jordan Resident" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 38/1 46/1" },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();

    const res = await t.upload(
      `${PUB_CR}/service-requests/${request.reference}/attachments`,
      withGps,
    );
    expect(res.status).toBe(201);
    photoId = res.body.id;

    const [stored] = [...t.storage.objects.entries()].filter(([key]) => key.includes(photoId));
    expect(stored).toBeDefined();
    const meta = await sharp(stored![1].bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(stored![1].bytes.includes(Buffer.from("Jordan Resident"))).toBe(false);
  });

  it("keys stored objects by municipality and request", async () => {
    const [m] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = 'cedar-ridge'`);
    const key = [...t.storage.objects.keys()].find((k) => k.includes(photoId))!;
    expect(key).toBe(`${m!.id}/requests/${request.id}/${photoId}.jpg`);
  });

  it("accepts PNG and WebP, and shrinks very large images", async () => {
    const png = await t.upload(
      `${PUB_CR}/service-requests/${request.reference}/attachments`,
      await image().png().toBuffer(),
      { type: "image/png", filename: "a.png" },
    );
    expect(png.status).toBe(201);
    const big = await t.upload(
      `${PUB_CR}/service-requests/${request.reference}/attachments`,
      await image(4200, 2800).webp().toBuffer(),
      { type: "image/webp", filename: "b.webp" },
    );
    expect(big.status).toBe(201);
    const view = await t.api("GET", `${PUB_CR}/service-requests/${request.reference}`);
    expect(view.body.photos).toHaveLength(3);
    const resized = view.body.photos.find((p: { id: string }) => p.id === big.body.id);
    expect(resized).toMatchObject({ width: 2000, kind: "report" });
    expect(resized.height).toBeLessThanOrEqual(2000);
  });

  it("serves the photo to the holder of the tracking number", async () => {
    const res = await t.raw(
      `${PUB_CR}/service-requests/${request.reference}/attachments/${photoId}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it("rejects files that are not real images, whatever they claim to be", async () => {
    const url = `${PUB_CR}/service-requests/${other.reference}/attachments`;
    const cases: [string, Buffer][] = [
      ["html named .jpg", Buffer.from("<html><script>alert(1)</script></html>")],
      [
        "svg",
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      ],
      ["pdf", Buffer.from("%PDF-1.7 not an image")],
      [
        "jpeg header then garbage",
        Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 1)]),
      ],
      ["empty", Buffer.alloc(0)],
    ];
    for (const [name, bytes] of cases) {
      const res = await t.upload(url, bytes);
      expect(res.status, name).toBe(422);
    }
    const json = await t.api("POST", url, { json: { file: "nope" } });
    expect(json.status).toBe(415);
    const view = await t.api("GET", `${PUB_CR}/service-requests/${other.reference}`);
    expect(view.body.photos).toEqual([]);
  });

  it("rejects photos over 15 MB", async () => {
    const res = await t.upload(
      `${PUB_CR}/service-requests/${other.reference}/attachments`,
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(15 * 1024 * 1024 + 10)]),
    );
    expect(res.status).toBe(413);
  });

  it("limits a request to four resident photos", async () => {
    const url = `${PUB_CR}/service-requests/${request.reference}/attachments`;
    const jpeg = await image(100, 100).jpeg().toBuffer();
    expect((await t.upload(url, jpeg)).status).toBe(201);
    const fifth = await t.upload(url, jpeg);
    expect(fifth.status).toBe(409);
    expect(fifth.body.error.code).toBe("too_many_photos");
  });

  it("records the upload in the history and audit log and notifies the department", async () => {
    const detail = await t.api("GET", `${CR}/service-requests/${request.id}`, {
      token: await t.login(USERS.crAdmin),
    });
    expect(
      detail.body.events.filter((e: { type: string }) => e.type === "photo_added"),
    ).toHaveLength(4);
    const audit = await t.api("GET", `${CR}/audit-events?pageSize=100`, {
      token: await t.login(USERS.crAuditor),
    });
    expect(
      audit.body.items.some(
        (e: { action: string; entityId: string }) =>
          e.action === "service_request.photo_added" && e.entityId === request.id,
      ),
    ).toBe(true);
    const notes = await t.api("GET", `${CR}/notifications`, {
      token: await t.login(USERS.crPwTech),
    });
    expect(
      notes.body.items.some(
        (n: { subject: string }) => n.subject === `Resident added a photo to ${request.reference}`,
      ),
    ).toBe(true);
  });
});

describe("photo access control", () => {
  it("does not serve a photo through another request's tracking number or another city", async () => {
    expect(
      (await t.raw(`${PUB_CR}/service-requests/${other.reference}/attachments/${photoId}`)).status,
    ).toBe(404);
    expect(
      (await t.raw(`${PUB_MS}/service-requests/${request.reference}/attachments/${photoId}`))
        .status,
    ).toBe(404);
    expect(
      (await t.raw(`${PUB_CR}/service-requests/CR-00000000/attachments/${photoId}`)).status,
    ).toBe(404);
    expect(
      (await t.raw(`${PUB_CR}/service-requests/${request.reference}/attachments/not-a-uuid`))
        .status,
    ).toBe(404);
  });

  it("cannot upload to another city's request or an unknown tracking number", async () => {
    const jpeg = await image(50, 50).jpeg().toBuffer();
    expect(
      (await t.upload(`${PUB_MS}/service-requests/${other.reference}/attachments`, jpeg)).status,
    ).toBe(404);
    expect(
      (await t.upload(`${PUB_CR}/service-requests/CR-00000000/attachments`, jpeg)).status,
    ).toBe(404);
  });

  it("requires a session and the right municipality and department for staff access", async () => {
    const path = `/service-requests/${request.id}/attachments/${photoId}`;
    expect((await t.raw(`${CR}${path}`)).status).toBe(401);
    expect((await t.raw(`${CR}${path}`, await t.login(USERS.crPwTech))).status).toBe(200);
    expect((await t.raw(`${CR}${path}`, await t.login(USERS.crParks))).status).toBe(404); // other department
    expect((await t.raw(`${CR}${path}`, await t.login(USERS.msAdmin))).status).toBe(403); // other city
    expect((await t.raw(`${MS}${path}`, await t.login(USERS.msAdmin))).status).toBe(404); // id not in own city
    expect(
      (
        await t.raw(
          `${CR}/service-requests/${other.id}/attachments/${photoId}`,
          await t.login(USERS.crAdmin),
        )
      ).status,
    ).toBe(404);
  });

  it("lets staff with comment permission add a completion photo the resident can see", async () => {
    const jpeg = await image(300, 200).jpeg().toBuffer();
    const url = `${CR}/service-requests/${other.id}/attachments`;
    expect((await t.upload(url, jpeg)).status).toBe(401);
    expect((await t.upload(url, jpeg, { token: await t.login(USERS.crAuditor) })).status).toBe(403);
    expect((await t.upload(url, jpeg, { token: await t.login(USERS.crParks) })).status).toBe(404);
    expect((await t.upload(url, jpeg, { token: await t.login(USERS.msAdmin) })).status).toBe(403);
    const ok = await t.upload(url, jpeg, { token: await t.login(USERS.crPwTech) });
    expect(ok.status).toBe(201);

    const view = await t.api("GET", `${PUB_CR}/service-requests/${other.reference}`);
    expect(view.body.photos).toEqual([
      expect.objectContaining({ id: ok.body.id, kind: "completion" }),
    ]);
    expect(JSON.stringify(view.body)).not.toContain("Priya");
    const detail = await t.api("GET", `${CR}/service-requests/${other.id}`, {
      token: await t.login(USERS.crPwDirector),
    });
    expect(detail.body.photos[0]).toMatchObject({
      kind: "completion",
      uploadedByName: "Priya Nair",
    });
  });

  it("refuses resident photos once a request is closed", async () => {
    const closed = await submitRequest(t);
    const token = await t.login(USERS.crPwDirector);
    await t.api("POST", `${CR}/service-requests/${closed.id}/status`, {
      token,
      json: { to: "closed", note: "Duplicate report." },
    });
    const res = await t.upload(
      `${PUB_CR}/service-requests/${closed.reference}/attachments`,
      await image(50, 50).jpeg().toBuffer(),
    );
    expect(res.status).toBe(409);
  });

  it("isolates attachment rows by tenant and keeps them append-only at the database", async () => {
    const { serviceRequestAttachments } = schema;
    expect(await t.handle.db.select().from(serviceRequestAttachments)).toEqual([]);
    const [ms] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = 'marlow-springs'`);
    expect(
      await withTenant(t.handle.db, { municipalityId: ms!.id }, (tx) =>
        tx.select().from(serviceRequestAttachments),
      ),
    ).toEqual([]);
    const [cr] = await t.handle.db
      .select()
      .from(schema.municipalities)
      .where(sql`slug = 'cedar-ridge'`);
    const run = (q: ReturnType<typeof sql>) =>
      withTenant(t.handle.db, { municipalityId: cr!.id }, (tx) => tx.execute(q));
    await expect(run(sql`delete from service_request_attachments`)).rejects.toThrow();
    await expect(
      run(sql`update service_request_attachments set storage_key = 'x'`),
    ).rejects.toThrow();
  });
});
