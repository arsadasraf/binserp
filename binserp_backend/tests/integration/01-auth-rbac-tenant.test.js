import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import {
  connectTestDB,
  disconnectTestDB,
  createTestTenantContext,
} from "../helpers/tenantTestHarness.js";

describe("Chain 1: Authentication, Granular RBAC & Multi-Tenant Database Isolation", () => {
  let tenantA;
  let tenantB;

  beforeAll(async () => {
    await connectTestDB();
    tenantA = await createTestTenantContext({ suffix: "TENANT_A" });
    tenantB = await createTestTenantContext({ suffix: "TENANT_B" });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("rejects unauthenticated requests across protected ERP endpoints with 401", async () => {
    const endpoints = [
      "/api/store/raw-material",
      "/api/store/fg-item",
      "/api/purchase/po",
      "/api/mrp/plan",
      "/api/sales/order",
      "/api/quality/incoming",
    ];

    for (const url of endpoints) {
      const res = await request(app).get(url);
      expect(res.status, `Expected 401 on unauthenticated GET ${url}`).toBe(401);
    }
  });

  it("blocks custom role spoofing ('GM' with isDefault: false) from accessing unauthorized modules (Rule 4)", async () => {
    // restrictedUser has a custom role named "GM" (isDefault: false) with ONLY Store -> inventory:read
    const invRes = await request(app)
      .get("/api/store/inventory")
      .set(tenantA.headers.restricted);
    expect(invRes.status).toBe(200);

    // Must be denied access to Purchase POs and Sales Orders (403)
    const poRes = await request(app)
      .get("/api/purchase/po")
      .set(tenantA.headers.restricted);
    expect(poRes.status).toBe(403);

    const salesRes = await request(app)
      .get("/api/sales/order")
      .set(tenantA.headers.restricted);
    expect(salesRes.status).toBe(403);
  });

  it("restricts Company Owner account token strictly to Admin module and blocks operational Store routes", async () => {
    const storeRes = await request(app)
      .post("/api/store/category")
      .set(tenantA.headers.companyOwner)
      .send({ name: "Unauthorized Category", type: "Raw Material" });

    // Company owner token is restricted from Store -> masters
    expect(storeRes.status).toBe(403);
  });

  it("guarantees strict multi-tenant data isolation between Tenant A and Tenant B", async () => {
    // 1. Create a Vendor & Raw Material in Tenant A
    const vendorResA = await request(app)
      .post("/api/store/vendor")
      .set(tenantA.headers.admin)
      .send({
        name: "Tenant A Exclusive Steel Supplier",
        contactPerson: "Rajesh Kumar",
        phone: "9876543210",
        email: "rajesh@tenanta-supplier.local",
        gstNumber: "29ABCDE1234F1Z5",
        address: "Peenya Industrial Area, Bengaluru",
      });
    expect(vendorResA.status).toBe(201);

    const rmResA = await request(app)
      .post("/api/store/raw-material")
      .set(tenantA.headers.admin)
      .send({
        name: "Tenant A Secret Alloy Bar",
        descriptions: " Ø30mm Aerospace Grade Titanium Bar",
        unit: "KG",
        minimumStock: 25,
      });
    expect(rmResA.status).toBe(201);

    // 2. Query Vendors & Raw Materials as Tenant B Admin -> Must NOT see Tenant A's records
    const vendorListB = await request(app)
      .get("/api/store/vendor")
      .set(tenantB.headers.admin);
    expect(vendorListB.status).toBe(200);
    const vendorsB = vendorListB.body?.vendors || vendorListB.body?.data || [];
    expect(
      vendorsB.some((v) => v.name === "Tenant A Exclusive Steel Supplier")
    ).toBe(false);

    const rmListB = await request(app)
      .get("/api/store/raw-material")
      .set(tenantB.headers.admin);
    expect(rmListB.status).toBe(200);
    const rmsB = rmListB.body?.rawMaterials || rmListB.body?.data || [];
    expect(rmsB.some((r) => r.name === "Tenant A Secret Alloy Bar")).toBe(false);

    // 3. Query as Tenant A Admin -> Must see its own records with technical descriptions populated
    const rmListA = await request(app)
      .get("/api/store/raw-material")
      .set(tenantA.headers.admin);
    expect(rmListA.status).toBe(200);
    const rmsA = rmListA.body?.rawMaterials || rmListA.body?.data || [];
    const matchedRM = rmsA.find((r) => r.name === "Tenant A Secret Alloy Bar");
    expect(matchedRM).toBeDefined();
    expect(matchedRM.descriptions).toContain("Aerospace Grade Titanium Bar");
  });
});
