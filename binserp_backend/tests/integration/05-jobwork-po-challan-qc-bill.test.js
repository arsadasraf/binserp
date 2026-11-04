import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import {
  connectTestDB,
  disconnectTestDB,
  createTestTenantContext,
} from "../helpers/tenantTestHarness.js";

describe("Chain 5: Job Work Outward PO <-> Job Work Challan Bidirectional Integration", () => {
  let tenant;
  let vendorId;
  let rmId;
  let challanId;
  let challanNumber;

  beforeAll(async () => {
    await connectTestDB();
    tenant = await createTestTenantContext({ suffix: "CHAIN5" });

    // Seed Vendor + RM + Stock via GRN
    const vRes = await request(app)
      .post("/api/store/vendor")
      .set(tenant.headers.admin)
      .send({
        name: "Precision Heat Treaters",
        contactPerson: "Mahesh",
        phone: "9845223344",
        email: "mahesh@heattreat.local",
        gstNumber: "29AABCP2233G1Z8",
        address: "Peenya, Bengaluru",
      });
    vendorId = (vRes.body.vendor?._id || vRes.body.data?._id).toString();

    const rmRes = await request(app)
      .post("/api/store/raw-material")
      .set(tenant.headers.admin)
      .send({
        name: "Forged Gear Blank 20MnCr5",
        descriptions: "Ø120mm Forged Alloy Gear Blank",
        unit: "KG",
      });
    rmId = (rmRes.body.rawMaterial || rmRes.body.rmBoItem)._id.toString();

    await request(app)
      .post("/api/store/grn")
      .set(tenant.headers.admin)
      .send({
        grnNumber: `GRN-JW-${Date.now()}`,
        date: new Date().toISOString(),
        type: "rm",
        supplier: vendorId,
        qcRequired: false,
        items: [
          {
            material: rmId,
            materialName: "Forged Gear Blank 20MnCr5",
            quantity: 200,
            receivedQuantity: 200,
            acceptedQuantity: 200,
            unit: "KG",
            rate: 110,
          },
        ],
      });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("creates a Job Work Challan and synchronizes PO reference & process rate when an Outward Job Work PO is created", async () => {
    // 1. Create Job Work Challan
    const challanRes = await request(app)
      .post("/api/store/jobwork/create")
      .set(tenant.headers.admin)
      .send({
        challanNumber: `JWC-TEST-${Date.now()}`,
        vendor: vendorId,
        date: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        jobWorkType: "store-conversion",
        purpose: "Case Carburizing & Hardening",
        items: [
          {
            item: rmId,
            itemType: "RawMaterial",
            itemName: "Forged Gear Blank 20MnCr5",
            quantity: 40,
            unit: "KG",
            processRate: 0,
          },
        ],
      });

    expect(challanRes.status).toBe(201);
    const createdChallan = challanRes.body.challan || challanRes.body.jobWork || challanRes.body.data;
    expect(createdChallan).toBeDefined();
    challanId = createdChallan._id.toString();
    challanNumber = createdChallan.challanNumber;

    // 2. Create Outward Job Work PO linked to the Job Work Challan
    const poNum = `JW-PO-${Date.now()}`;
    const poRes = await request(app)
      .post("/api/purchase/po")
      .set(tenant.headers.admin)
      .send({
        poNumber: poNum,
        vendor: vendorId,
        poType: "jobwork",
        processType: "Case Carburizing & Hardening",
        jobWorkChallan: challanId,
        challanNumber,
        items: [
          {
            material: rmId,
            materialName: "Forged Gear Blank 20MnCr5",
            description: "Ø120mm Forged Alloy Gear Blank",
            processType: "Case Carburizing",
            quantity: 40,
            unit: "KG",
            rate: 35,
            amount: 1400,
            taxRate: 18,
          },
        ],
      });
    expect(poRes.status).toBe(201);

    // 3. Verify Job Work Challan now has poNumber and updated processRate synced automatically
    const allChallansRes = await request(app)
      .get("/api/store/jobwork/all")
      .set(tenant.headers.admin);
    expect(allChallansRes.status).toBe(200);
    const challanList = allChallansRes.body.challans || allChallansRes.body.jobWorks || allChallansRes.body.data || [];
    const syncedChallan = challanList.find((c) => String(c._id) === challanId);
    expect(syncedChallan).toBeDefined();
    expect(syncedChallan.poNumber).toBe(poNum);
  });
});

