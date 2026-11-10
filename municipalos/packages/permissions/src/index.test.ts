import { describe, expect, it } from "vitest";
import { PERMISSIONS, SYSTEM_ROLES, can, serviceRequestVisibility, toPermissionSet } from "./index";

const role = (key: string) => toPermissionSet(SYSTEM_ROLES.find((r) => r.key === key)!.permissions);

describe("system roles", () => {
  it("municipal admin holds every permission", () => {
    expect(role("municipal_admin").size).toBe(PERMISSIONS.length);
  });
  it("auditor is read-only", () => {
    const p = role("auditor");
    for (const perm of p) expect(perm.endsWith(".read") || perm.includes(".read_")).toBe(true);
  });
  it("department employee cannot assign, close, reopen or read audit log", () => {
    const p = role("department_employee");
    expect(can(p, "service_requests.assign")).toBe(false);
    expect(can(p, "service_requests.close")).toBe(false);
    expect(can(p, "service_requests.reopen")).toBe(false);
    expect(can(p, "audit.read")).toBe(false);
  });
  it("ignores unknown permission strings from storage", () => {
    expect(toPermissionSet(["nope", "audit.read"]).size).toBe(1);
  });
});

describe("serviceRequestVisibility", () => {
  it("read_all sees everything", () => {
    expect(serviceRequestVisibility(role("city_clerk"), null)).toEqual({ scope: "all" });
  });
  it("department roles are scoped to their department", () => {
    expect(serviceRequestVisibility(role("department_employee"), "d1")).toEqual({
      scope: "department",
      departmentId: "d1",
    });
  });
  it("department role without a department sees nothing", () => {
    expect(serviceRequestVisibility(role("department_employee"), null)).toEqual({ scope: "none" });
  });
  it("roles without request permissions see nothing", () => {
    expect(serviceRequestVisibility(role("content_editor"), "d1")).toEqual({ scope: "none" });
  });
});
