import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import {
  connectTestDB,
  disconnectTestDB,
  createTestTenantContext,
} from "../helpers/tenantTestHarness.js";

describe("Chain 2: Store Masters, Dual-UOM, Multi-Level FG BOM & Price Lists Integration", () => {
  let tenant;
  let vendorId;
  let customerId;
  let rmId;
  let boId;
  let subAssemblyFgId;
  let parentFgId;

  beforeAll(async () => {
    await connectTestDB();
    tenant = await createTestTenantContext({ suffix: "CHAIN2" });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("creates Vendor, Customer, Dual-UOM Raw Material, and Bought-Out Masters with descriptions", async () => {
    // 1. Vendor
    const vRes = await request(app)
      .post("/api/store/vendor")
      .set(tenant.headers.admin)
      .send({
        name: "Apex Precision Metals Pvt Ltd",
        contactPerson: "Suresh Menon",
        phone: "9845012345",
        email: "sales@apexmetals.local",
        gstNumber: "29AABCA1234C1Z1",
        address: "Bommasandra Industrial Area, Bengaluru",
      });
    expect(vRes.status).toBe(201);
    vendorId = (vRes.body.vendor?._id || vRes.body.data?._id).toString();

    // 2. Customer
    const cRes = await request(app)
      .post("/api/store/customer")
      .set(tenant.headers.admin)
      .send({
        name: "Bharat Heavy Automation Ltd",
        contactPerson: "Ananya Rao",
        phone: "9845098765",
        email: "procurement@bhal.local",
        gstNumber: "29AABCB9876D1Z9",
        address: "Whitefield, Bengaluru",
      });
    expect(cRes.status).toBe(201);
    customerId = (cRes.body.customer?._id || cRes.body.data?._id).toString();

    // 3. Dual-UOM Raw Material (Primary: KG, Secondary: MTR, 1 KG = 0.5 MTR)
    const rmRes = await request(app)
      .post("/api/store/raw-material")
      .set(tenant.headers.admin)
      .send({
        name: "EN24 Alloy Steel Round Bar",
        descriptions: "Ø40mm Ultrasonic Tested EN24 Bar",
        unit: "KG",
        hasSecondaryUnit: true,
        secondaryUnit: "MTR",
        conversionFactor: 0.5,
        primaryRatio: 2,
        secondaryRatio: 1,
        minimumStock: 50,
        hsnCode: "722830",
      });
    expect(rmRes.status).toBe(201);
    const createdRM = rmRes.body.rawMaterial || rmRes.body.rmBoItem;
    expect(createdRM).toBeDefined();
    expect(createdRM.hasSecondaryUnit).toBe(true);
    expect(createdRM.secondaryUnit).toBe("MTR");
    expect(Number(createdRM.conversionFactor)).toBe(0.5);
    rmId = createdRM._id.toString();

    // 4. Bought-Out Item
    const boRes = await request(app)
      .post("/api/store/bought-out")
      .set(tenant.headers.admin)
      .send({
        name: "Taper Roller Bearing 32208",
        descriptions: "40x80x24.75mm Heavy Duty Bearing",
        unit: "NOS",
        minimumStock: 20,
        hsnCode: "848220",
      });
    expect(boRes.status).toBe(201);
    const createdBO = boRes.body.boughtOut || boRes.body.rmBoItem;
    expect(createdBO).toBeDefined();
    expect(createdBO.descriptions).toContain("40x80x24.75mm");
    boId = createdBO._id.toString();
  });

  it("creates Multi-Level FG BOM (Sub-Assembly + Parent Assembly) and preserves Dual-UOM BOM quantities", async () => {
    // 1. Create Sub-Assembly FG containing the Dual-UOM Raw Material
    const subFgRes = await request(app)
      .post("/api/store/fg-item")
      .set(tenant.headers.admin)
      .send({
        name: "Machined Drive Shaft Sub-Assembly",
        type: "Sub Assembly",
        description: "Heat-Treated & Ground Drive Shaft Sub-Assy",
        unit: "NOS",
        revisionNumber: "R1",
        bom: [
          {
            itemType: "RawMaterial",
            item: rmId,
            itemName: "EN24 Alloy Steel Round Bar",
            quantity: 4, // 4 KG = 2 MTR
            unit: "KG",
            hasSecondaryUnit: true,
            secondaryUnit: "MTR",
            conversionFactor: 0.5,
            secondaryQuantity: 2,
            selectedUnit: "MTR",
            inputQuantity: 2,
          },
        ],
      });
    expect(subFgRes.status).toBe(201);
    subAssemblyFgId = subFgRes.body.fgItem._id.toString();
    expect(subFgRes.body.fgItem.bom).toHaveLength(1);
    expect(subFgRes.body.fgItem.bom[0].selectedUnit).toBe("MTR");
    expect(Number(subFgRes.body.fgItem.bom[0].secondaryQuantity)).toBe(2);

    // 2. Create Parent Assembly FG referencing Sub-Assembly + Bought-Out Bearing
    const parentFgRes = await request(app)
      .post("/api/store/fg-item")
      .set(tenant.headers.admin)
      .send({
        name: "Heavy Duty Gearbox Assembly 10HP",
        type: "Assembly",
        description: "10HP Helical Industrial Gearbox",
        unit: "NOS",
        revisionNumber: "R1",
        bom: [
          {
            itemType: "FGItem",
            item: subAssemblyFgId,
            itemName: "Machined Drive Shaft Sub-Assembly",
            quantity: 2,
            unit: "NOS",
          },
          {
            itemType: "BoughtOut",
            item: boId,
            itemName: "Taper Roller Bearing 32208",
            quantity: 4,
            unit: "NOS",
          },
        ],
      });
    expect(parentFgRes.status).toBe(201);
    parentFgId = parentFgRes.body.fgItem._id.toString();
    expect(parentFgRes.body.fgItem.bom).toHaveLength(2);
  });

  it("integrates Vendor Price List and Sales Price List with FG Item & Material technical descriptions", async () => {
    // 1. Create Preferred Vendor Price List for Dual-UOM RM
    const vplRes = await request(app)
      .post("/api/purchase/price-list")
      .set(tenant.headers.admin)
      .send({
        vendor: vendorId,
        material: rmId,
        price: 115,
        taxRate: 18,
        pricingUnit: "KG",
        isSecondaryUnit: false,
        isPreferred: true,
        remarks: "Annual rate contract",
      });
    expect([200, 201]).toContain(vplRes.status);

    // Fetch Vendor Price Lists and verify populated material descriptions
    const getVplRes = await request(app)
      .get("/api/purchase/price-list")
      .set(tenant.headers.admin);
    expect(getVplRes.status).toBe(200);
    const vplList = getVplRes.body?.data || [];
    const matchedVpl = vplList.find(
      (entry) => String(entry.material?._id || entry.material) === rmId
    );
    expect(matchedVpl).toBeDefined();
    expect(matchedVpl.material?.descriptions).toContain("Ultrasonic Tested EN24");
    expect(matchedVpl.isPreferred).toBe(true);

    // 2. Create Sales Price List for Parent FG and verify it syncs sellingPrice to FGItem master
    const splRes = await request(app)
      .post("/api/sales/price-list")
      .set(tenant.headers.admin)
      .send({
        fgItem: parentFgId,
        price: 45000,
        taxRate: 18,
        currency: "INR",
        pricingUnit: "NOS",
      });
    expect(splRes.status).toBe(200);

    const getSplRes = await request(app)
      .get("/api/sales/price-list")
      .set(tenant.headers.admin);
    expect(getSplRes.status).toBe(200);
    const matchedSpl = (getSplRes.body?.priceLists || []).find(
      (p) => String(p.fgItem?._id || p.fgItem) === parentFgId
    );
    expect(matchedSpl).toBeDefined();
    expect(matchedSpl.fgItem?.description).toBe("10HP Helical Industrial Gearbox");
    expect(Number(matchedSpl.price)).toBe(45000);
  });
});

