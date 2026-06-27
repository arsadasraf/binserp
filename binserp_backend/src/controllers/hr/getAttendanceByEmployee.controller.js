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

export const getAttendanceByEmployee = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);
      const Attendance = req.getModel('Attendance', attendanceSchema);

    const { employeeId } = req.params;
    const companyId = getCompanyId(req);
    const { startDate, endDate } = req.query;

    const employee = await Employee.findOne({
      employeeId,
      company: companyId,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const query = {
      company: companyId,
      employee: employee._id,
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const attendance = await Attendance.find(query)
      .populate("employee", "employeeId name department designation")
      .sort({ date: -1 });

    res.status(200).json({
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
      },
      attendance,
      count: attendance.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== DEPARTMENT MANAGEMENT ==========
