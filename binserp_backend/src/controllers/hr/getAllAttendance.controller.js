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

export const getAllAttendance = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);
      const Attendance = req.getModel('Attendance', attendanceSchema);

    const companyId = getCompanyId(req);
    const { startDate, endDate, employeeId, status } = req.query;

    const query = { company: companyId };

    if (employeeId) {
      // Allow searching by internal _id (provided by frontend) OR custom employeeId
      const empQuery = { company: companyId };

      const orConditions = [{ employeeId: employeeId }];
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        orConditions.push({ _id: employeeId });
      }
      empQuery.$or = orConditions;

      const employee = await Employee.findOne(empQuery);

      if (employee) {
        query.employee = employee._id;
      } else {
        // If employee specific filter was requested but no employee found, return empty
        return res.status(200).json({ attendance: [], count: 0 });
      }
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Parse the start date and ensure it represents the very beginning of that local day
        const start = new Date(startDate);
        if (startDate.length <= 10) {
           // If it's just YYYY-MM-DD, set to local midnight to avoid UTC shift
           start.setHours(0, 0, 0, 0);
        }
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
           end.setHours(23, 59, 59, 999);
        }
        query.date.$lte = end;
      }
    }

    const attendance = await Attendance.find(query)
      .populate("employee", "employeeId name department designation")
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      attendance,
      count: attendance.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Attendance by Employee
