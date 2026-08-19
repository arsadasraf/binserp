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

  if (masterTab === "employee") {
    const Employee = req.getModel("Employee", employeeSchema);

    for (const item of items) {
      if (!item.name || !item.employeeId) {
        skippedCount++;
        continue;
      }

      const query = { company: companyId, employeeId: String(item.employeeId).trim() };

      const doc = {
        company: companyId,
        employeeId: String(item.employeeId).trim(),
        name: String(item.name).trim(),
        contact: item.contact ? String(item.contact).trim() : "",
        email: item.email ? String(item.email).trim().toLowerCase() : "",
        gender: ["Male", "Female", "Other"].includes(item.gender) ? item.gender : "Male",
        bloodGroup: item.bloodGroup || "",
        department: item.department ? String(item.department).trim() : "General",
        designation: item.designation ? String(item.designation).trim() : "Staff",
        employeeType: item.employeeType ? String(item.employeeType).trim() : "Full-Time",
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

      if (overwrite) {
        await Employee.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Employee.findOne(query);
        if (!exists) {
          await Employee.create(doc);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }
    }

  } else if (masterTab === "department") {
    const Department = req.getModel("Department", departmentSchema);

    for (const item of items) {
      if (!item.name) {
        skippedCount++;
        continue;
      }

      const name = String(item.name).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name}$`, "i") } };
      const doc = {
        company: companyId,
        name,
        description: item.description ? String(item.description).trim() : "",
      };

      if (overwrite) {
        await Department.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Department.findOne(query);
        if (!exists) {
          await Department.create(doc);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }
    }

  } else if (masterTab === "designation") {
    const Designation = req.getModel("Designation", designationSchema);

    for (const item of items) {
      if (!item.name) {
        skippedCount++;
        continue;
      }

      const name = String(item.name).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name}$`, "i") } };
      const doc = {
        company: companyId,
        name,
        department: item.department ? String(item.department).trim() : "",
        description: item.description ? String(item.description).trim() : "",
      };

      if (overwrite) {
        await Designation.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Designation.findOne(query);
        if (!exists) {
          await Designation.create(doc);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }
    }

  } else if (masterTab === "employee-type") {
    const EmployeeType = req.getModel("EmployeeType", employeeTypeSchema);

    for (const item of items) {
      if (!item.name) {
        skippedCount++;
        continue;
      }

      const name = String(item.name).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name}$`, "i") } };
      const doc = {
        company: companyId,
        name,
        description: item.description ? String(item.description).trim() : "",
      };

      if (overwrite) {
        await EmployeeType.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await EmployeeType.findOne(query);
        if (!exists) {
          await EmployeeType.create(doc);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }
    }

  } else if (masterTab === "skill") {
    const Skill = req.getModel("Skill", skillSchema);

    for (const item of items) {
      if (!item.name) {
        skippedCount++;
        continue;
      }

      const name = String(item.name).trim();
      const query = { company: companyId, name: { $regex: new RegExp(`^${name}$`, "i") } };
      const doc = {
        company: companyId,
        name,
        category: item.category ? String(item.category).trim() : "General",
        description: item.description ? String(item.description).trim() : "",
      };

      if (overwrite) {
        await Skill.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Skill.findOne(query);
        if (!exists) {
          await Skill.create(doc);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }
    }

  } else if (masterTab === "holiday") {
    const Holiday = req.getModel("Holiday", holidaySchema);

    for (const item of items) {
      if (!item.title || !item.date) {
        skippedCount++;
        continue;
      }

      const title = String(item.title).trim();
      const holidayDate = new Date(item.date);
      holidayDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(holidayDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const query = {
        company: companyId,
        date: { $gte: holidayDate, $lt: nextDay }
      };

      const doc = {
        company: companyId,
        title,
        date: holidayDate,
        description: item.description ? String(item.description).trim() : "",
        isRecurring: item.isRecurring === true || item.isRecurring === "Yes" || item.isRecurring === "true" || item.isRecurring === 1,
        isActive: true
      };

      if (overwrite) {
        await Holiday.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Holiday.findOne(query);
        if (!exists) {
          await Holiday.create(doc);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }
    }

  } else {
    throw new ApiError(400, `Unsupported master tab: ${masterTab}`);
  }

  return res.status(200).json(
    new ApiResponse(200, { insertedCount, updatedCount, skippedCount }, "HR Master data imported successfully")
  );
});
