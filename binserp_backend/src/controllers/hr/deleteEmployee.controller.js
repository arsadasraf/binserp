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
    const Attendance = req.getModel('Attendance', attendanceSchema);
    const Salary = req.getModel('Salary', salarySchema);
    const EmployeeJob = req.getModel('EmployeeJob', employeeJobSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const employee = await Employee.findOne({
      _id: id,
      company: companyId,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // 1. Strict Protection: If attendance exists, employee CANNOT be deleted (only deactivated)
    const hasAttendance = await Attendance.exists({ employee: id, company: companyId });
    if (hasAttendance) {
      return res.status(400).json({ 
        message: "Cannot delete this employee because attendance has already been marked for them. Employees with attendance history cannot be deleted and can only be deactivated (use the Active/Inactive toggle)." 
      });
    }

    // 2. Strict Protection: If salary records exist, employee cannot be deleted
    const hasSalary = await Salary.exists({ employee: id, company: companyId });
    if (hasSalary) {
      return res.status(400).json({ 
        message: "Cannot delete this employee because salary records exist for them. The employee can only be deactivated." 
      });
    }

    // 3. Strict Protection: If assigned jobs exist, employee cannot be deleted
    const hasJobs = await EmployeeJob.exists({ employee: id, company: companyId });
    if (hasJobs) {
      return res.status(400).json({ 
        message: "Cannot delete this employee because assigned jobs exist for them. The employee can only be deactivated." 
      });
    }

    // 4. Time window check for freshly added employees without any records
    const ageMs = Date.now() - new Date(employee.createdAt || employee._id.getTimestamp()).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (ageMs > TWENTY_FOUR_HOURS) {
      return res.status(403).json({ 
        message: "Employee records can only be deleted within 24 hours of creation (with no attendance history). Use the Active/Inactive toggle instead." 
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
