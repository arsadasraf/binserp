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

export const updateEmployeeJobStatus = async (req, res) => {
  try {
    const EmployeeJob = req.getModel('EmployeeJob', employeeJobSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, remarks } = req.body;

    // Verify ownership if employee
    const job = await EmployeeJob.findOne({ _id: id, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (req.userType === 'employee' && job.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to update this job" });
    }

    if (status) job.status = status;
    if (status === 'Completed') job.completionDate = new Date();
    if (remarks) job.remarks = remarks;

    await job.save();

    res.status(200).json({ message: "Job updated successfully", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== DASHBOARD STATS ==========
