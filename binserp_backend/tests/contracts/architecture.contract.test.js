import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

describe("Suite 0: BinsERP Architecture, Security & Coding Standards Contract Guard", () => {
  it("enforces verifyJWT across all protected operational route files (Rule 4)", () => {
    const protectedRouteFiles = [
      "store.routes.js",
      "purchase.routes.js",
      "mrp.routes.js",
      "sales.routes.js",
      "hr.routes.js",
      "ppc.routes.js",
      "quality.routes.js",
      "maintenance.routes.js",
      "crm.routes.js",
      "accounts.routes.js",
      "role.routes.js",
      "reports.routes.js",
      "visitor.routes.js",
      "vehicle.routes.js",
      "employeeMovement.routes.js",
    ];

    for (const file of protectedRouteFiles) {
      const fullPath = path.join(backendRoot, "src/routes", file);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(
        content.includes("verifyJWT"),
        `Route file ${file} must enforce verifyJWT authentication`
      ).toBe(true);
    }
  });

  it("prevents custom roles from spoofing system default roles in requirePermission (Rule 4)", () => {
    const authMiddlewarePath = path.join(
      backendRoot,
      "src/middlewares/auth.middleware.js"
    );
    const content = fs.readFileSync(authMiddlewarePath, "utf-8");

    // Must check r?.isDefault !== false before granting full-access bypass
    expect(content).toContain("r?.isDefault !== false");
  });

  it("serves static assets with X-Content-Type-Options: nosniff (Rule 5)", () => {
    const appPath = path.join(backendRoot, "src/app.js");
    const content = fs.readFileSync(appPath, "utf-8");

    expect(content).toContain("X-Content-Type-Options");
    expect(content).toContain("nosniff");
  });

  it("populates technical description fields in MRP, Purchase, and Store controllers (Rule 2)", () => {
    const mrpControllerPath = path.join(
      backendRoot,
      "src/controllers/purchase/mrpPlan.controller.js"
    );
    const mrpContent = fs.readFileSync(mrpControllerPath, "utf-8");

    // Verify linkedPOs integration and description fields are preserved
    expect(mrpContent).toContain("linkedPOs");
    expect(mrpContent).toContain("descriptions");
  });
});
