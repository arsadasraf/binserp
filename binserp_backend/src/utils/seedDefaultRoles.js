import { SYSTEM_PERMISSIONS } from "../config/permissions.config.js";

/**
 * Ensures the system default "GM" (General Manager) role exists with full access
 * across all 10 system modules (including Reports).
 */
export const seedDefaultRoles = async (RoleModel, companyId) => {
  try {
    if (!RoleModel || !companyId) return null;

    // Build full access policies from central permissions manifest
    const fullAccessPolicies = SYSTEM_PERMISSIONS.map(mod => ({
      module: mod.module,
      tabs: mod.tabs.map(t => typeof t === "string" ? t : (t.id || t.name))
    }));

    // Find GM role or legacy Admin Default Role
    let gmRole = await RoleModel.findOne({
      $or: [
        { name: "GM" },
        { name: "Admin Default Role" }
      ]
    });

    if (!gmRole) {
      gmRole = await RoleModel.create({
        company: companyId,
        name: "GM",
        description: "General Manager default role with full access to all modules including Reports",
        policies: fullAccessPolicies,
        isDefault: true,
        isActive: true
      });
      console.log("[Roles] Created GM default role for company:", companyId);
    } else {
      // Update GM role policies to include all current system modules (e.g. Reports)
      gmRole.name = "GM";
      gmRole.description = "General Manager default role with full access to all modules including Reports";
      gmRole.policies = fullAccessPolicies;
      gmRole.isDefault = true;
      await gmRole.save({ validateBeforeSave: false });
    }

    return gmRole;
  } catch (error) {
    console.error("[Roles] Error seeding GM default role:", error.message);
    return null;
  }
};
