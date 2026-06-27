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

export const getEmployeeJobs = async (req, res) => {
  try {
    const EmployeeJob = req.getModel('EmployeeJob', employeeJobSchema);

    const companyId = getCompanyId(req);

    // Ensure it's an employee
    if (req.userType !== 'employee') {
      return res.status(403).json({ message: "Access denied. Employee only." });
    }
    const employeeId = req.user._id;

    const { status } = req.query;
    const query = { company: companyId, employee: employeeId };
    if (status) query.status = status;

    const jobs = await EmployeeJob.find(query).sort({ createdAt: -1 });

    res.status(200).json({ jobs, count: jobs.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Job Status (Employee)
