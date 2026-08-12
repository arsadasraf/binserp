import { SYSTEM_PERMISSIONS } from "../config/permissions.config.js";

/**
 * Ensures system default roles exist for every module (GM, Store, HR, PPC, Security, CRM, Accounts, Maintenance, Quality, Reports).
 */
export const seedDefaultRoles = async (RoleModel, companyId) => {
  try {
    if (!RoleModel || !companyId) return null;

    // Helper to extract tab strings for a given module definition
    const getModuleTabs = (mod) => {
      return mod.tabs.map((t) => (typeof t === "string" ? t : t.id || t.name));
    };

    // 1. GM Operational Policies (Excludes Admin module)
    const gmOperationalPolicies = SYSTEM_PERMISSIONS
      .filter((mod) => mod.module !== "Admin")
      .map((mod) => ({
        module: mod.module,
        tabs: getModuleTabs(mod),
      }));

    // Seed/Update GM Role
    let gmRole = await RoleModel.findOne({
      $or: [{ name: "GM" }, { name: "Admin Default Role" }],
    });

    if (!gmRole) {
      gmRole = await RoleModel.create({
        company: companyId,
        name: "GM",
        description: "General Manager default role with full access to operational system modules (excludes Admin user/role management)",
        policies: gmOperationalPolicies,
        isDefault: true,
        isActive: true,
      });
      console.log("[Roles] Created GM default role for company:", companyId);
    } else {
      gmRole.name = "GM";
      gmRole.description = "General Manager default role with full access to operational system modules (excludes Admin user/role management)";
      gmRole.policies = gmOperationalPolicies;
      gmRole.isDefault = true;
      await gmRole.save({ validateBeforeSave: false });
    }

    // 2. Module-Specific Default Roles
    const moduleDefs = SYSTEM_PERMISSIONS.filter((mod) => mod.module !== "Admin");

    for (const mod of moduleDefs) {
      const roleName = mod.module;
      const roleDescription = `Default ${mod.label || mod.module} module role with exclusive access to ${mod.module}`;
      const singleModulePolicy = [
        {
          module: mod.module,
          tabs: getModuleTabs(mod),
        },
      ];

      let existingRole = await RoleModel.findOne({ name: roleName });

      if (!existingRole) {
        await RoleModel.create({
          company: companyId,
          name: roleName,
          description: roleDescription,
          policies: singleModulePolicy,
          isDefault: true,
          isActive: true,
        });
        console.log(`[Roles] Created ${roleName} default module role for company:`, companyId);
      } else {
        existingRole.description = roleDescription;
        existingRole.policies = singleModulePolicy;
        existingRole.isDefault = true;
        await existingRole.save({ validateBeforeSave: false });
      }
    }

    return gmRole;
  } catch (error) {
    console.error("[Roles] Error seeding default roles:", error.message);
    return null;
  }
};
