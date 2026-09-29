import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { userSchema, roleSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/employee.model.js";

export const getCRMTeamAccess = asyncHandler(async (req, res) => {
    const UserModel = req.getModel("User", userSchema);
    const EmployeeModel = req.getModel("Employee", employeeSchema);
    const RoleModel = req.getModel("Role", roleSchema);

    // 1. Fetch company roles that grant CRM access or Full/GM access
    const roles = await RoleModel.find({ company: req.company._id, isActive: { $ne: false } });

    // Determine which role IDs have access to CRM
    const crmRoleMap = new Map();
    for (const r of roles) {
        const isGM = r.name === "GM" || r.name === "Admin Default Role" || r.name === "Company Management";
        const crmPolicy = r.policies?.find(p => String(p.module).toLowerCase() === "crm");

        if (isGM) {
            crmRoleMap.set(String(r._id), {
                roleName: r.name,
                tabs: ["overview", "leads", "deals", "customers", "masters"],
                isFullAccess: true
            });
        } else if (crmPolicy) {
            const tabs = (crmPolicy.tabs || []).map(t => typeof t === "string" ? t : (t?.name || t?.id));
            crmRoleMap.set(String(r._id), {
                roleName: r.name,
                tabs,
                isFullAccess: false
            });
        }
    }

    // 2. Fetch Users
    const users = await UserModel.find({ company: req.company._id, isActive: { $ne: false } })
        .select("name username email phone role userType photo")
        .populate("role", "name policies");

    // 3. Fetch Employees
    const employees = await EmployeeModel.find({ company: req.company._id, isActive: { $ne: false } })
        .select("name email phone roles department designation")
        .populate("roles", "name policies");

    const team = [];

    // Filter Users
    for (const u of users) {
        if (!u.role) continue;
        const roleInfo = crmRoleMap.get(String(u.role._id));
        if (roleInfo) {
            team.push({
                _id: u._id,
                type: "user",
                name: u.name || u.username || "User",
                email: u.email,
                phone: u.phone,
                photo: u.photo,
                roleName: roleInfo.roleName,
                tabs: roleInfo.tabs,
                isFullAccess: roleInfo.isFullAccess
            });
        }
    }

    // Filter Employees
    for (const emp of employees) {
        if (!emp.roles || !Array.isArray(emp.roles)) continue;
        for (const r of emp.roles) {
            const roleInfo = crmRoleMap.get(String(r._id));
            if (roleInfo) {
                team.push({
                    _id: emp._id,
                    type: "employee",
                    name: emp.name,
                    email: emp.email,
                    phone: emp.phone,
                    department: emp.department,
                    designation: emp.designation,
                    roleName: roleInfo.roleName,
                    tabs: roleInfo.tabs,
                    isFullAccess: roleInfo.isFullAccess
                });
                break; // avoid duplicate if multiple roles match
            }
        }
    }

    return res.status(200).json(new ApiResponse(200, team, "CRM team access list fetched successfully"));
});
