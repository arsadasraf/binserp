import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  employeeSchema,
  departmentSchema,
  designationSchema,
  skillSchema,
  employeeTypeSchema,
  holidaySchema
} from "../../models/hr/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const bulkImportHrMasters = asyncHandler(async (req, res) => {
  const { masterTab, items, overwrite } = req.body;
  const companyId = getCompanyId(req);

  if (!companyId) {
    throw new ApiError(400, "Company ID could not be determined from request context.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Items array is required for bulk import.");
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const skippedItems = [];

  if (masterTab === "employee") {
    const Employee = req.getModel("Employee", employeeSchema);
    const Department = req.getModel("Department", departmentSchema);
    const Designation = req.getModel("Designation", designationSchema);
    const EmployeeType = req.getModel("EmployeeType", employeeTypeSchema);

    for (const item of items) {
      const empId = item.employeeId || item.id;
      const empName = item.name || item.fullName;

      if (!empName || !empId) {
        skippedCount++;
        continue;
      }

      const cleanEmpId = String(empId).trim();
      const cleanName = String(empName).trim();
      const cleanDept = item.department ? String(item.department).trim() : "General";
      const cleanDesig = item.designation ? String(item.designation).trim() : "Staff";
      const cleanEmpType = item.employeeType ? String(item.employeeType).trim() : "Full-Time";

      const query = { company: companyId, employeeId: cleanEmpId };
      const exists = await Employee.findOne(query);

      // If employee already exists and overwrite is NOT enabled, skip immediately
      if (exists && !overwrite) {
        skippedCount++;
        skippedItems.push(`ID: ${cleanEmpId} (${cleanName})`);
        continue;
      }

      // Auto-register Department if not existing
      if (cleanDept) {
        const deptExists = await Department.findOne({
          company: companyId,
          name: { $regex: new RegExp(`^${cleanDept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
        });
        if (!deptExists) {
          try {
            await Department.create({ company: companyId, name: cleanDept, description: "Auto-created from Employee import" });
          } catch { /* ignore duplicate error */ }
        }
      }

      // Auto-register Designation if not existing
      if (cleanDesig) {
        const desigExists = await Designation.findOne({
          company: companyId,
          name: { $regex: new RegExp(`^${cleanDesig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
        });
        if (!desigExists) {
          try {
            await Designation.create({ company: companyId, name: cleanDesig, department: cleanDept, description: "Auto-created from Employee import" });
          } catch { /* ignore duplicate error */ }
        }
      }

      // Auto-register EmployeeType if not existing
      if (cleanEmpType) {
        const typeExists = await EmployeeType.findOne({
          company: companyId,
          name: { $regex: new RegExp(`^${cleanEmpType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
        });
        if (!typeExists) {
          try {
            await EmployeeType.create({ company: companyId, name: cleanEmpType, description: "Auto-created from Employee import" });
          } catch { /* ignore duplicate error */ }
        }
      }

      const doc = {
        company: companyId,
        employeeId: cleanEmpId,
        name: cleanName,
        contact: item.contact ? String(item.contact).trim() : "",
        email: item.email ? String(item.email).trim().toLowerCase() : "",
        gender: ["Male", "Female", "Other"].includes(item.gender) ? item.gender : "Male",
        bloodGroup: item.bloodGroup || "",
        department: cleanDept,
        designation: cleanDesig,
        employeeType: cleanEmpType,
        status: ["Active", "Inactive", "Terminated", "OnLeave"].includes(item.status) ? item.status : "Active",
        joiningDate: item.joiningDate ? new Date(item.joiningDate) : new Date(),
        salary: {
          basic: Number(item.basic || 0),
          hra: Number(item.hra || 0),
          conveyance: Number(item.conveyance || 0),
          medical: Number(item.medical || 0),
          specialAllowance: Number(item.specialAllowance || 0),
          pf: Number(item.pf || 0),
          esi: Number(item.esi || 0),
          professionalTax: Number(item.professionalTax || 0),
        },
      };

      if (item.dob) {
        doc.dob = new Date(item.dob);
      }

      if (exists && overwrite) {
        await Employee.findOneAndUpdate(query, { $set: doc }, { new: true });
        updatedCount++;
      } else {
        await Employee.create(doc);
        insertedCount++;
      }
    }

  } else if (masterTab === "department") {
    const Department = req.getModel("Department", departmentSchema);

    for (const item of items) {
      const deptName = item.name || item.departmentName || item.department;
      if (!deptName) {
        skippedCount++;
        continue;
      }

      const name = String(deptName).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } };
      const exists = await Department.findOne(query);

      if (exists && !overwrite) {
        skippedCount++;
        skippedItems.push(name);
        continue;
      }

      const doc = {
        company: companyId,
        name,
        description: item.description ? String(item.description).trim() : "",
      };

      if (exists && overwrite) {
        await Department.findOneAndUpdate(query, { $set: doc }, { new: true });
        updatedCount++;
      } else {
        await Department.create(doc);
        insertedCount++;
      }
    }

  } else if (masterTab === "designation") {
    const Designation = req.getModel("Designation", designationSchema);

    for (const item of items) {
      const desigName = item.name || item.designationName || item.designation;
      if (!desigName) {
        skippedCount++;
        continue;
      }

      const name = String(desigName).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } };
      const exists = await Designation.findOne(query);

      if (exists && !overwrite) {
        skippedCount++;
        skippedItems.push(name);
        continue;
      }

      const doc = {
        company: companyId,
        name,
        description: item.description ? String(item.description).trim() : "",
      };

      if (exists && overwrite) {
        await Designation.findOneAndUpdate(query, { $set: doc }, { new: true });
        updatedCount++;
      } else {
        await Designation.create(doc);
        insertedCount++;
      }
    }

  } else if (masterTab === "employee-type") {
    const EmployeeType = req.getModel("EmployeeType", employeeTypeSchema);

    for (const item of items) {
      const typeName = item.name || item.typeName || item.employeeType;
      if (!typeName) {
        skippedCount++;
        continue;
      }

      const name = String(typeName).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } };
      const exists = await EmployeeType.findOne(query);

      if (exists && !overwrite) {
        skippedCount++;
        skippedItems.push(name);
        continue;
      }

      const doc = {
        company: companyId,
        name,
        description: item.description ? String(item.description).trim() : "",
      };

      if (exists && overwrite) {
        await EmployeeType.findOneAndUpdate(query, { $set: doc }, { new: true });
        updatedCount++;
      } else {
        await EmployeeType.create(doc);
        insertedCount++;
      }
    }

  } else if (masterTab === "skill") {
    const Skill = req.getModel("Skill", skillSchema);

    for (const item of items) {
      const skillName = item.name || item.skillName || item.skill;
      if (!skillName) {
        skippedCount++;
        continue;
      }

      const name = String(skillName).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } };
      const exists = await Skill.findOne(query);

      if (exists && !overwrite) {
        skippedCount++;
        skippedItems.push(name);
        continue;
      }

      const doc = {
        company: companyId,
        name,
        description: item.description ? String(item.description).trim() : "",
      };

      if (exists && overwrite) {
        await Skill.findOneAndUpdate(query, { $set: doc }, { new: true });
        updatedCount++;
      } else {
        await Skill.create(doc);
        insertedCount++;
      }
    }

  } else if (masterTab === "holiday") {
    const Holiday = req.getModel("Holiday", holidaySchema);

    for (const item of items) {
      const holidayName = item.name || item.title || item.holidayName || item.holidayTitle;
      const rawDate = item.date || item.holidayDate;

      if (!holidayName || !rawDate) {
        skippedCount++;
        continue;
      }

      const name = String(holidayName).trim();
      const holidayDate = new Date(rawDate);
      if (isNaN(holidayDate.getTime())) {
        skippedCount++;
        continue;
      }
      holidayDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(holidayDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const query = {
        company: companyId,
        date: { $gte: holidayDate, $lt: nextDay }
      };

      const exists = await Holiday.findOne(query);

      if (exists && !overwrite) {
        skippedCount++;
        skippedItems.push(`${name} (${holidayDate.toISOString().split('T')[0]})`);
        continue;
      }

      const holidayType = ["Public", "Optional", "Company"].includes(item.type) ? item.type : "Public";

      const doc = {
        company: companyId,
        name,
        date: holidayDate,
        type: holidayType,
        description: item.description ? String(item.description).trim() : "",
        isActive: item.isActive !== false && item.status !== "Inactive"
      };

      if (exists && overwrite) {
        await Holiday.findOneAndUpdate(query, { $set: doc }, { new: true });
        updatedCount++;
      } else {
        await Holiday.create(doc);
        insertedCount++;
      }
    }

  } else {
    throw new ApiError(400, `Unsupported master tab: ${masterTab}`);
  }

  return res.status(200).json(
    new ApiResponse(200, { insertedCount, updatedCount, skippedCount, skippedItems }, "HR Master data imported successfully")
  );
});
