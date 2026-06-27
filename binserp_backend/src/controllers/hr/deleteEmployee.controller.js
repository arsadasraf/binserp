import { employeeSchema, attendanceSchema, departmentSchema, designationSchema, skillSchema, employeeTypeSchema, salarySchema, employeeJobSchema } from "../../models/hr/index.js";
import { hrPrefixSettingsSchema } from "../../models/hrPrefix/index.js";
import { jobSchema, manpowerSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import mongoose from "mongoose";

// Helper to get company ID from request
// Helper to get company ID from request
const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  if (!req.user) throw new Error("User context missing in request");

  if (req.userType === "company") {
    return req.user.id;
  } else if (req.userType === "user" || req.userType === "saasadmin" || req.userType === "employee") {
    if (req.user.company && req.user.company._id) return req.user.company._id;
    if (req.user.company) return req.user.company;
  }

  throw new Error("Could not modify company ID from request context");
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ========== EMPLOYEE MANAGEMENT ==========

// Create Employee
// Create Employee

export const deleteEmployee = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const employee = await Employee.findOne({
      _id: id,
      company: companyId,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const ageMs = Date.now() - new Date(employee.createdAt || employee._id.getTimestamp()).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (ageMs > TWENTY_FOUR_HOURS) {
      return res.status(403).json({ 
        message: "Employee records can only be deleted within 24 hours of creation. Use the Active/Inactive toggle instead." 
      });
    }

    const employeeDeleted = await Employee.findOneAndDelete({
      _id: id,
      company: companyId,
    });

    if (employeeDeleted && employeeDeleted.photo) {
      await deleteFromS3(employeeDeleted.photo);
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Toggle Employee Status
