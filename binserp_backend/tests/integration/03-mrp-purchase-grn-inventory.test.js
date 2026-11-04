import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import {
  connectTestDB,
  disconnectTestDB,
  createTestTenantContext,
} from "../helpers/tenantTestHarness.js";

describe("Chain 3: MRP Demand Plan -> Outward Material & Job Work POs -> GRN -> Stock & Ledger Integration", () => {
  let tenant;
  let vendorId;
  let rmId;
  let boId;
  let fgId;
  let mrpPlanId;
  let mrpNumber;
  let standardPoId;
  let jobWorkPoId;

  beforeAll(async () => {
    await connectTestDB();
    tenant = await createTestTenantContext({ suffix: "CHAIN3" });

    // Seed Vendor, RM, BO, and FG with BOM
    const vRes = await request(app)
      .post("/api/store/vendor")
      .set(tenant.headers.admin)
      .send({
        name: "Kalyani Forge & Fasteners",
        contactPerson: "Vikram",
        phone: "9880011223",
        email: "vikram@kalyani.local",
        gstNumber: "29AABCK1122E1Z2",
        address: "Bengaluru",
      });
    vendorId = (vRes.body.vendor?._id || vRes.body.data?._id).toString();

    const rmRes = await request(app)
      .post("/api/store/raw-material")
      .set(tenant.headers.admin)
      .send({
        name: "MS Plate 10mm IS2062",
        descriptions: "10mm Hot Rolled Structural Steel Plate",
        unit: "KG",
        hasSecondaryUnit: true,
        secondaryUnit: "SQFT",
        conversionFactor: 0.1,
      });
    rmId = (rmRes.body.rawMaterial || rmRes.body.rmBoItem)._id.toString();

    const boRes = await request(app)
      .post("/api/store/bought-out")
      .set(tenant.headers.admin)
      .send({
        name: "Oil Seal 45x65x8 Viton",
        descriptions: "High-Temp Viton Shaft Seal",
        unit: "NOS",
      });
    boId = (boRes.body.boughtOut || boRes.body.rmBoItem)._id.toString();

    const fgRes = await request(app)
      .post("/api/store/fg-item")
      .set(tenant.headers.admin)
      .send({
        name: "Hydraulic Cylinder Assembly HC-200",
        type: "Assembly",
        description: "200 Bar Double Acting Cylinder",
        unit: "NOS",
        bom: [
          {
            itemType: "RawMaterial",
            item: rmId,
            itemName: "MS Plate 10mm IS2062",
            quantity: 10, // 10 KG per FG
            unit: "KG",
          },
          {
            itemType: "BoughtOut",
            item: boId,
            itemName: "Oil Seal 45x65x8 Viton",
            quantity: 2, // 2 NOS per FG
            unit: "NOS",
          },
        ],
      });
    fgId = fgRes.body.fgItem._id.toString();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("creates an MRP Demand Plan from FG BOM and explodes RM and BO requirements", async () => {
    const mrpRes = await request(app)
      .post("/api/mrp/plan")
      .set(tenant.headers.admin)
      .send({
        customerName: "L&T Construction Equipment",
        customerPoNumber: "CUST-PO-901",
        planningMonth: "2026-11",
        targetDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        fgItems: [
          {
            fgItem: fgId,
            fgItemName: "Hydraulic Cylinder Assembly HC-200",
            description: "200 Bar Double Acting Cylinder",
            quantity: 5, // 5 NOS FG -> requires 50 KG RM & 10 NOS BO
            unit: "NOS",
            sellingPrice: 12000,
          },
        ],
      });

    expect(mrpRes.status).toBe(201);
    const plan = mrpRes.body.mrpPlan;
    expect(plan).toBeDefined();
    mrpPlanId = plan._id.toString();
    mrpNumber = plan.mrpNumber;

    expect(plan.rmRequirements.length).toBeGreaterThanOrEqual(1);
    expect(plan.boRequirements.length).toBeGreaterThanOrEqual(1);
    expect(Number(plan.rmRequirements[0].requiredQuantity)).toBe(50);
    expect(Number(plan.boRequirements[0].requiredQuantity)).toBe(10);
  });

  it("links both Material Purchase Orders and Job Work Outward POs to the MRP Plan and lists them in MRP Details", async () => {
    // 1. Standard Material PO linked to MRP Plan
    const stdPoRes = await request(app)
      .post("/api/purchase/po")
      .set(tenant.headers.admin)
      .send({
        poNumber: `PO-MAT-${Date.now()}`,
        vendor: vendorId,
        poType: "standard",
        mrpPlanId,
        mrpNumber,
        items: [
          {
            material: rmId,
            materialName: "MS Plate 10mm IS2062",
            description: "10mm Hot Rolled Structural Steel Plate",
            quantity: 50,
            unit: "KG",
            rate: 75,
            amount: 3750,
            taxRate: 18,
          },
        ],
      });
    expect(stdPoRes.status).toBe(201);
    standardPoId = (stdPoRes.body.data?._id || stdPoRes.body.purchaseOrder?._id).toString();

    // 2. Job Work Outward PO linked to MRP Plan
    const jwPoRes = await request(app)
      .post("/api/purchase/po")
      .set(tenant.headers.admin)
      .send({
        poNumber: `PO-JW-${Date.now()}`,
        vendor: vendorId,
        poType: "jobwork",
        processType: "CNC Turning & Honing",
        mrpPlanId,
        mrpNumber,
        items: [
          {
            material: rmId,
            materialName: "MS Plate 10mm IS2062",
            description: "10mm Hot Rolled Structural Steel Plate",
            processType: "Laser Profiling",
            quantity: 50,
            unit: "KG",
            rate: 20,
            amount: 1000,
            taxRate: 18,
          },
        ],
      });
    expect(jwPoRes.status).toBe(201);
    jobWorkPoId = (jwPoRes.body.data?._id || jwPoRes.body.purchaseOrder?._id).toString();

    // 3. Fetch MRP Plan Details & List -> Must return both Material PO and Job Work Outward PO in linkedPOs
    const mrpDetailRes = await request(app)
      .get(`/api/mrp/plan/${mrpPlanId}`)
      .set(tenant.headers.admin);
    expect(mrpDetailRes.status).toBe(200);
    const detailedPlan = mrpDetailRes.body.mrpPlan;
    expect(detailedPlan.linkedPOCount).toBe(2);
    expect(detailedPlan.linkedPOs).toHaveLength(2);
    expect(detailedPlan.linkedPOs.some((po) => po.poType === "standard")).toBe(true);
    expect(detailedPlan.linkedPOs.some((po) => po.poType === "jobwork")).toBe(true);

    const mrpListRes = await request(app)
      .get("/api/mrp/plan")
      .set(tenant.headers.admin);
    expect(mrpListRes.status).toBe(200);
    const listedPlan = (mrpListRes.body.mrpPlans || []).find(
      (p) => String(p._id) === mrpPlanId
    );
    expect(listedPlan).toBeDefined();
    expect(listedPlan.linkedPOCount).toBe(2);
    expect(listedPlan.linkedPOs).toHaveLength(2);
  });

  it("dynamically recalculates committed values and unlinks Outward POs from the MRP Plan", async () => {
    // 1. Unlink the Job Work Outward PO from the MRP Plan
    const unlinkRes = await request(app)
      .put(`/api/purchase/po/${jobWorkPoId}`)
      .set(tenant.headers.admin)
      .send({
        mrpNumber: "",
        mrpPlanId: null,
      });
    expect(unlinkRes.status).toBe(200);

    // 2. Fetch MRP Plan Details -> Must now only have 1 linked PO (the standard material PO)
    const mrpDetailRes = await request(app)
      .get(`/api/mrp/plan/${mrpPlanId}`)
      .set(tenant.headers.admin);
    expect(mrpDetailRes.status).toBe(200);
    const planAfterUnlink = mrpDetailRes.body.mrpPlan;
    expect(planAfterUnlink.linkedPOCount).toBe(1);
    expect(planAfterUnlink.linkedPOs).toHaveLength(1);
    expect(planAfterUnlink.linkedPOs[0].poType).toBe("standard");

    // 3. Re-link the Job Work Outward PO back to the MRP Plan
    const relinkRes = await request(app)
      .put(`/api/purchase/po/${jobWorkPoId}`)
      .set(tenant.headers.admin)
      .send({
        mrpNumber,
        mrpPlanId,
      });
    expect(relinkRes.status).toBe(200);

    const mrpDetailAfterRelink = await request(app)
      .get(`/api/mrp/plan/${mrpPlanId}`)
      .set(tenant.headers.admin);
    expect(mrpDetailAfterRelink.status).toBe(200);
    expect(mrpDetailAfterRelink.body.mrpPlan.linkedPOCount).toBe(2);
  });

  it("records GRN against the Purchase Order and increments Store Inventory & Stock Transactions", async () => {
    const grnRes = await request(app)
      .post("/api/store/grn")
      .set(tenant.headers.admin)
      .send({
        grnNumber: `GRN-RM-${Date.now()}`,
        date: new Date().toISOString(),
        type: "rm",
        supplier: vendorId,
        purchaseOrder: standardPoId,
        mrpPlan: mrpPlanId,
        mrpNumber,
        qcRequired: false,
        invoiceNumber: "INV-KFF-101",
        items: [
          {
            material: rmId,
            materialName: "MS Plate 10mm IS2062",
            quantity: 50,
            receivedQuantity: 50,
            acceptedQuantity: 50,
            unit: "KG",
            rate: 75,
            amount: 3750,
          },
        ],
      });
    expect(grnRes.status).toBe(201);

    // Verify Raw Material stock is now 50 KG
    const rmListRes = await request(app)
      .get("/api/store/raw-material")
      .set(tenant.headers.admin);
    expect(rmListRes.status).toBe(200);
    const updatedRM = (rmListRes.body.rawMaterials || []).find(
      (r) => String(r._id) === rmId
    );
    expect(updatedRM).toBeDefined();
    expect(Number(updatedRM.currentStock)).toBe(50);
  });
});

