import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Company } from "../../src/models/company/index.js";
import { userSchema, roleSchema } from "../../src/models/user/index.js";
import { getTenantModel, getTenantConnection } from "../../src/db/tenant.js";
import { clearCachedCompany } from "../../src/middlewares/auth.middleware.js";

let mongoMemoryServer = null;

/**
 * Connects to an isolated test MongoDB instance.
 * Uses TEST_MONGODB_URI if provided; otherwise starts an isolated in-memory MongoMemoryServer.
 */
export async function connectTestDB() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "binserp_integration_test_jwt_secret_key_2026";
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  const customTestUri = process.env.TEST_MONGODB_URI;
  if (customTestUri) {
    await mongoose.connect(customTestUri, {
      dbName: "binserp_test_master",
    });
    return;
  }

  mongoMemoryServer = await MongoMemoryServer.create();
  const uri = mongoMemoryServer.getUri();
  await mongoose.connect(uri, {
    dbName: "binserp_test_master",
  });
}

/**
 * Drops test databases and closes the MongoDB connection cleanly.
 */
export async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    mongoMemoryServer = null;
  }
}

/**
 * Provisions a complete isolated Tenant Company, Tenant DB, System Default Admin Role,
 * Restricted Custom Role, and signed JWT tokens for Supertest requests.
 *
 * @param {object} options
 * @param {string} [options.suffix] - Unique suffix (e.g. "A", "B")
 */
export async function createTestTenantContext(options = {}) {
  const suffix = options.suffix || `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const companyId = `COMP_${suffix}`;
  const dbName = `binserp_test_tenant_${suffix}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  clearCachedCompany(companyId);

  const company = await Company.create({
    companyName: `BinsERP Test Corp ${suffix}`,
    companyType: "OEM (Own Product Manufacturer)",
    service: ["Precision Manufacturing"],
    companyId,
    dbName,
    email: `admin_${suffix}@binserp-test.local`.toLowerCase(),
    contactNumber: String(9000000000 + Math.floor(Math.random() * 900000000)),
    state: "Karnataka",
    city: "Bengaluru",
    password: "TestPassword@123",
    isVerified: true,
    isSuspended: false,
    tokenVersion: 0,
  });

  const RoleModel = getTenantModel(dbName, "Role", roleSchema);
  const UserModel = getTenantModel(dbName, "User", userSchema);

  // 1. Built-in Default Admin Role (isDefault: true -> full access in requirePermission)
  const adminRole = await RoleModel.create({
    company: company._id,
    name: "Admin Default Role",
    description: "Built-in system default admin role",
    isDefault: true,
    isActive: true,
    policies: [],
  });

  // 2. Spoofed Custom Role named "GM" with isDefault: false (must NOT bypass RBAC per Rule 4)
  const spoofedCustomRole = await RoleModel.create({
    company: company._id,
    name: "GM",
    description: "User-created custom role with spoofed GM name",
    isDefault: false,
    isActive: true,
    policies: [
      {
        module: "Store",
        tabs: [{ name: "inventory", actions: ["read"] }],
      },
    ],
  });

  // 3. Store & Purchase Operational Role
  const storePurchaseRole = await RoleModel.create({
    company: company._id,
    name: "Store & Purchase Manager",
    description: "Operational access to Store Masters, Inventory, WIP, Purchase, Sales",
    isDefault: false,
    isActive: true,
    policies: [
      {
        module: "Store",
        tabs: ["masters", "inventory", "wip", "purchase", "sales"],
      },
    ],
  });

  const adminUser = await UserModel.create({
    company: company._id,
    name: `Admin User ${suffix}`,
    userId: `USR_ADMIN_${suffix}`,
    email: `user_admin_${suffix}@binserp-test.local`.toLowerCase(),
    password: "TestPassword@123",
    department: "Management",
    role: adminRole._id,
    roles: [adminRole._id],
    roleLevel: 10,
    isActive: true,
    tokenVersion: 0,
  });

  const restrictedUser = await UserModel.create({
    company: company._id,
    name: `Restricted User ${suffix}`,
    userId: `USR_RESTR_${suffix}`,
    email: `user_restr_${suffix}@binserp-test.local`.toLowerCase(),
    password: "TestPassword@123",
    department: "Store",
    role: spoofedCustomRole._id,
    roles: [spoofedCustomRole._id],
    roleLevel: 2,
    isActive: true,
    tokenVersion: 0,
  });

  const storeManagerUser = await UserModel.create({
    company: company._id,
    name: `Store Manager ${suffix}`,
    userId: `USR_MGR_${suffix}`,
    email: `user_mgr_${suffix}@binserp-test.local`.toLowerCase(),
    password: "TestPassword@123",
    department: "Store",
    role: storePurchaseRole._id,
    roles: [storePurchaseRole._id],
    roleLevel: 5,
    isActive: true,
    tokenVersion: 0,
  });

  const adminToken = jwt.sign(
    {
      id: adminUser._id.toString(),
      type: "user",
      companyId: company.companyId,
      tokenVersion: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  const restrictedToken = jwt.sign(
    {
      id: restrictedUser._id.toString(),
      type: "user",
      companyId: company.companyId,
      tokenVersion: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  const storeManagerToken = jwt.sign(
    {
      id: storeManagerUser._id.toString(),
      type: "user",
      companyId: company.companyId,
      tokenVersion: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  const companyOwnerToken = jwt.sign(
    {
      id: company._id.toString(),
      type: "company",
      companyId: company.companyId,
      tokenVersion: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  return {
    company,
    dbName,
    tenantConnection: getTenantConnection(dbName),
    getModel: (name, schema) => getTenantModel(dbName, name, schema),
    roles: {
      adminRole,
      spoofedCustomRole,
      storePurchaseRole,
    },
    users: {
      adminUser,
      restrictedUser,
      storeManagerUser,
    },
    tokens: {
      adminToken,
      restrictedToken,
      storeManagerToken,
      companyOwnerToken,
    },
    headers: {
      admin: { Authorization: `Bearer ${adminToken}` },
      restricted: { Authorization: `Bearer ${restrictedToken}` },
      storeManager: { Authorization: `Bearer ${storeManagerToken}` },
      companyOwner: { Authorization: `Bearer ${companyOwnerToken}` },
    },
  };
}

