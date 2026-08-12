import { manpowerSchema } from "../../models/ppc/index.js";
import { employeeSchema } from "../../models/hr/index.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

/**
 * 👷 Get All Shopfloor Manpower / Employees
 * GET /api/ppc/manpower
 */
export const getAllManpower = async (req, res) => {
  try {
    const Manpower = req.getModel("Manpower", manpowerSchema);
    const Employee = req.getModel("Employee", employeeSchema);

    const companyId = getCompanyId(req);
    const { status, skills } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;

    // 1. Fetch Manpower collection records
    let manpowers = await Manpower.find(query)
      .populate("employee", "employeeId name department designation skills status photo")
      .sort({ createdAt: -1 });

    // 2. Fetch HR Employees to ensure all shopfloor workers are included
    const allEmployees = await Employee.find({ company: companyId }).select(
      "_id employeeId name designation department status skills photo"
    );

    const manpowerEmpIds = new Set(
      manpowers.map((m) => (m.employee?._id || m.employee || "").toString())
    );

    // Merge any missing HR employees as shopfloor manpower items
    const mergedList = [...manpowers];
    allEmployees.forEach((emp) => {
      if (!manpowerEmpIds.has(emp._id.toString())) {
        mergedList.push({
          _id: emp._id,
          employeeId: emp.employeeId,
          name: emp.name,
          designation: emp.designation,
          department: emp.department,
          status: emp.status || "Active",
          skills: emp.skills || [],
          photo: emp.photo,
          isHrOnly: true,
        });
      }
    });

    // 3. Filter by skills if provided
    let finalResult = mergedList;
    if (skills) {
      const requiredSkills = skills.split(",");
      finalResult = finalResult.filter((mp) => {
        const mpSkills = (mp.skills || []).map((s) => (typeof s === "string" ? s : s.name));
        return requiredSkills.some((skill) => mpSkills.includes(skill));
      });
    }

    res.status(200).json({ manpower: finalResult, count: finalResult.length });
  } catch (error) {
    console.error("Error in getAllManpower:", error);
    res.status(500).json({ message: error.message });
  }
};
