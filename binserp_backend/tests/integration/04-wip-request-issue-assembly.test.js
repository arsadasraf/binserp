import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { materialRequestSchema } from "../../src/models/store/index.js";
import {
  connectTestDB,
  disconnectTestDB,
  createTestTenantContext,
} from "../helpers/tenantTestHarness.js";

describe("Chain 4: WIP Material Request (Dual-UOM & 24h Policy) -> Material Issue -> WIP Inventory Integration", () => {
  let tenant;
  let vendorId;
  let rmId;
  let materialRequestId;
  let requestNumber;

  beforeAll(async () => {
    await connectTestDB();
    tenant = await createTestTenantContext({ suffix: "CHAIN4" });

    // Seed Vendor + Dual-UOM RM + Initial Stock via GRN
    const vRes = await request(app)
      .post("/api/store/vendor")
      .set(tenant.headers.admin)
      .send({
        name: "Jindal Alloy Steels",
        contactPerson: "Prakash",
        phone: "9845112233",
        email: "prakash@jindal.local",
        gstNumber: "29AABCJ1122F1Z5",
        address: "Bengaluru",
      });
    vendorId = (vRes.body.vendor?._id || vRes.body.data?._id).toString();

    const rmRes = await request(app)
      .post("/api/store/raw-material")
      .set(tenant.headers.admin)
      .send({
        name: "SS 316L Seamless Pipe 2 Inch",
        descriptions: "Schedule 40 Pickled & Passivated Pipe",
        unit: "KG",
        hasSecondaryUnit: true,
        secondaryUnit: "MTR",
        conversionFactor: 0.25, // 1 KG = 0.25 MTR (4 KG per MTR)
      });
    rmId = (rmRes.body.rawMaterial || rmRes.body.rmBoItem)._id.toString();

    // Add 100 KG (= 25 MTR) stock via GRN
    const grnRes = await request(app)
      .post("/api/store/grn")
      .set(tenant.headers.admin)
      .send({
        grnNumber: `GRN-RM-WIP-${Date.now()}`,
        date: new Date().toISOString(),
        type: "rm",
        supplier: vendorId,
        qcRequired: false,
        items: [
          {
            material: rmId,
            materialName: "SS 316L Seamless Pipe 2 Inch",
            quantity: 100,
            receivedQuantity: 100,
            acceptedQuantity: 100,
            unit: "KG",
            hasSecondaryUnit: true,
            secondaryUnit: "MTR",
            conversionFactor: 0.25,
            secondaryQuantity: 25,
            rate: 320,
          },
        ],
      });
    expect(grnRes.status).toBe(201);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("creates a Dual-UOM Material Request and preserves both Primary and Secondary UOM quantities", async () => {
    const reqRes = await request(app)
      .post("/api/store/material-request")
      .set(tenant.headers.admin)
      .send({
        requestNumber: `MR-DUAL-${Date.now()}`,
        department: "CNC Shop Floor",
        priority: "High",
        type: "rm",
        items: [
          {
            material: rmId,
            itemType: "Raw Material",
            materialName: "SS 316L Seamless Pipe 2 Inch",
            quantity: 20, // 20 KG
            unit: "KG",
            hasSecondaryUnit: true,
            secondaryUnit: "MTR",
            conversionFactor: 0.25,
            secondaryQuantity: 5, // 5 MTR
            selectedUnit: "MTR",
            purpose: "Valve Body Machining",
          },
        ],
      });

    expect(reqRes.status).toBe(201);
    const createdReq = reqRes.body.materialRequest || reqRes.body.data;
    expect(createdReq).toBeDefined();
    materialRequestId = createdReq._id.toString();
    requestNumber = createdReq.requestNumber;

    expect(createdReq.items[0].hasSecondaryUnit).toBe(true);
    expect(createdReq.items[0].secondaryUnit).toBe("MTR");
    expect(Number(createdReq.items[0].quantity)).toBe(20);
    expect(Number(createdReq.items[0].secondaryQuantity)).toBe(5);
  });

  it("allows status/fulfillment progression on Material Requests older than 24 hours without 24h time-lock error", async () => {
    // Backdate createdAt to 48 hours ago to simulate older Material Request being issued
    const MaterialRequestModel = tenant.getModel("MaterialRequest", materialRequestSchema);
    await MaterialRequestModel.updateOne(
      { _id: materialRequestId },
      { $set: { createdAt: new Date(Date.now() - 48 * 3600 * 1000) } },
      { timestamps: false }
    );

    // Status update after Material Issue (e.g. status: 'Issued', skipInventoryUpdate: true) MUST succeed (200)
    const statusUpdateRes = await request(app)
      .put(`/api/store/material-request/${materialRequestId}`)
      .set(tenant.headers.admin)
      .send({
        status: "Approved",
        skipInventoryUpdate: true,
      });

    expect(statusUpdateRes.status).toBe(200);
  });

  it("issues material against the Material Request, deducts Store Stock, and populates WIP Inventory", async () => {
    const issueRes = await request(app)
      .post("/api/store/material-issue")
      .set(tenant.headers.admin)
      .send({
        issueNumber: `ISS-RM-${Date.now()}`,
        date: new Date().toISOString(),
        type: "rm",
        department: "CNC Shop Floor",
        materialRequest: materialRequestId,
        requestNumber,
        status: "Issued",
        items: [
          {
            material: rmId,
            itemType: "Raw Material",
            materialName: "SS 316L Seamless Pipe 2 Inch",
            quantity: 20,
            unit: "KG",
            hasSecondaryUnit: true,
            secondaryUnit: "MTR",
            conversionFactor: 0.25,
            secondaryQuantity: 5,
            purpose: "Valve Body Machining",
          },
        ],
      });

    expect(issueRes.status).toBe(201);

    // Store stock should be deducted from 100 KG -> 80 KG
    const rmListRes = await request(app)
      .get("/api/store/raw-material")
      .set(tenant.headers.admin);
    const updatedRM = (rmListRes.body.rawMaterials || []).find(
      (r) => String(r._id) === rmId
    );
    expect(Number(updatedRM.currentStock)).toBe(80);

    // WIP Inventory endpoint should respond cleanly
    const wipRes = await request(app)
      .get("/api/store/wip/inventory")
      .set(tenant.headers.admin);
    expect(wipRes.status).toBe(200);
  });
});

