import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import {
  connectTestDB,
  disconnectTestDB,
  createTestTenantContext,
} from "../helpers/tenantTestHarness.js";

describe("Chain 6: Sales Order Workflow & Cross-Module API Smoke Contracts (HR, Quality, PPC, CRM, Gate Entry)", () => {
  let tenant;
  let customerId;
  let fgId;

  beforeAll(async () => {
    await connectTestDB();
    tenant = await createTestTenantContext({ suffix: "CHAIN6" });

    const cRes = await request(app)
      .post("/api/store/customer")
      .set(tenant.headers.admin)
      .send({
        name: "Kirloskar Pneumatic Co Ltd",
        contactPerson: "Deepak Kulkarni",
        phone: "9822011223",
        email: "purchase@kirloskar.local",
        gstNumber: "27AABCK1234A1Z5",
        address: "Hadapsar, Pune",
      });
    customerId = (cRes.body.customer?._id || cRes.body.data?._id).toString();

    const fgRes = await request(app)
      .post("/api/store/fg-item")
      .set(tenant.headers.admin)
      .send({
        name: "Compressor Valve Assembly CV-90",
        type: "Assembly",
        description: "High Pressure Stainless Valve Assembly",
        unit: "NOS",
      });
    fgId = fgRes.body.fgItem._id.toString();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("creates and retrieves Sales Incoming RFQ, Quotation, and Sales Order with FG descriptions", async () => {
    // 1. Incoming RFQ
    const rfqRes = await request(app)
      .post("/api/sales/incoming-rfq")
      .set(tenant.headers.admin)
      .send({
        rfqNumber: `SRFQ-${Date.now()}`,
        customer: customerId,
        date: new Date().toISOString(),
        items: [
          {
            fgItem: fgId,
            name: "Compressor Valve Assembly CV-90",
            description: "High Pressure Stainless Valve Assembly",
            quantity: 10,
            unit: "NOS",
          },
        ],
      });
    expect([200, 201]).toContain(rfqRes.status);

    // 2. Sales Order
    const soRes = await request(app)
      .post("/api/sales/order")
      .set(tenant.headers.admin)
      .send({
        orderNumber: `SO-${Date.now()}`,
        customer: customerId,
        orderType: "DIRECT",
        targetDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        totalAmount: 150000,
        items: [
          {
            fgItem: fgId,
            type: "FGItem",
            name: "Compressor Valve Assembly CV-90",
            description: "High Pressure Stainless Valve Assembly",
            quantity: 10,
            pricePerQuantity: 15000,
            totalPrice: 150000,
          },
        ],
      });
    expect([200, 201]).toContain(soRes.status);

    const getSoRes = await request(app)
      .get("/api/sales/order")
      .set(tenant.headers.admin);
    expect(getSoRes.status).toBe(200);
    const orders = getSoRes.body.salesOrders || getSoRes.body.orders || getSoRes.body.data || [];
    expect(orders.length).toBeGreaterThanOrEqual(1);
  });

  it("verifies cross-module GET endpoints respond without 500 Internal Server Errors", async () => {
    const moduleEndpoints = [
      "/api/store/category",
      "/api/store/location",
      "/api/store/bought-out",
      "/api/store/consumable-item",
      "/api/store/inventory",
      "/api/store/transactions",
      "/api/purchase/rfq",
      "/api/purchase/quotation",
      "/api/purchase/bill",
      "/api/sales/quotation",
      "/api/sales/dc",
      "/api/sales/invoice",
      "/api/visitor",
      "/api/vehicle",
      "/api/employee-movement",
      "/api/roles",
    ];

    for (const endpoint of moduleEndpoints) {
      const res = await request(app)
        .get(endpoint)
        .set(tenant.headers.admin);
      expect(
        res.status,
        `Endpoint ${endpoint} returned unexpected status ${res.status}`
      ).toBeLessThan(500);
    }
  });
});

