import { describe, expect, it } from "vitest";
import {
  createServiceRequestSchema,
  listServiceRequestsQuerySchema,
  referenceSchema,
} from "./index";

const base = {
  categoryId: "3f0e8a52-6f1b-4c62-9a55-0c6f0f3f9a11",
  description: "Large pothole in the right lane",
  locationText: "400 N Main St",
};

describe("createServiceRequestSchema", () => {
  it("accepts a minimal anonymous report and treats blank contact fields as absent", () => {
    const r = createServiceRequestSchema.parse({ ...base, reporterEmail: "", reporterName: "  " });
    expect(r.reporterEmail).toBeUndefined();
    expect(r.reporterName).toBeUndefined();
  });
  it("rejects short descriptions, bad emails and half coordinates", () => {
    expect(createServiceRequestSchema.safeParse({ ...base, description: "hole" }).success).toBe(
      false,
    );
    expect(createServiceRequestSchema.safeParse({ ...base, reporterEmail: "nope" }).success).toBe(
      false,
    );
    expect(createServiceRequestSchema.safeParse({ ...base, latitude: 40.1 }).success).toBe(false);
    expect(
      createServiceRequestSchema.safeParse({ ...base, latitude: 140, longitude: 0 }).success,
    ).toBe(false);
  });
});

describe("listServiceRequestsQuerySchema", () => {
  it("applies defaults and caps page size", () => {
    expect(listServiceRequestsQuerySchema.parse({})).toMatchObject({
      status: "open",
      page: 1,
      pageSize: 25,
    });
    expect(listServiceRequestsQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});

describe("referenceSchema", () => {
  it("normalizes case and rejects malformed references", () => {
    expect(referenceSchema.parse(" cr-7k3m9q2x ")).toBe("CR-7K3M9Q2X");
    expect(referenceSchema.safeParse("CR-123").success).toBe(false);
    expect(referenceSchema.safeParse("'; drop table--").success).toBe(false);
  });
});
