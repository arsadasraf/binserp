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

export const assignJob = async (req, res) => {
  try {
    const EmployeeJob = req.getModel('EmployeeJob', employeeJobSchema);

    const companyId = getCompanyId(req);
    const { employeeId, title, description, priority, dueDate, remarks } = req.body; // employeeId here is the _id of the employee doc

    if (!employeeId || !title) {
      return res.status(400).json({ message: "Employee and Title are required" });
    }

    const job = await EmployeeJob.create({
      company: companyId,
      employee: employeeId,
      title,
      description,
      priority: priority || "Medium",
      dueDate,
      remarks,
      status: "Pending"
    });

    res.status(201).json({ message: "Job assigned successfully", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get My Jobs (Employee Self)
