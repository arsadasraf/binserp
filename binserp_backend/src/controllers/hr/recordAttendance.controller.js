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

export const recordAttendance = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);
      const Attendance = req.getModel('Attendance', attendanceSchema);

    const companyId = getCompanyId(req);
    const { employeeId, type, location, faceEncoding } = req.body; // type: 'checkIn' or 'checkOut'

    if (!employeeId || !type) {
      return res.status(400).json({
        message: "Employee ID and type (checkIn/checkOut) are required",
      });
    }

    // Find employee
    const employee = await Employee.findOne({
      employeeId,
      company: companyId,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Handle photo upload if provided
    let photoUrl = null;
    if (req.file) {
      const uploadResult = await uploadOnS3(req.file.path, "attendance", companyId);
      if (uploadResult) {
        photoUrl = uploadResult.secure_url;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's attendance record
    let attendance = await Attendance.findOne({
      company: companyId,
      employee: employee._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (!attendance) {
      attendance = await Attendance.create({
        company: companyId,
        employee: employee._id,
        date: today,
        status: "Present",
      });
    }

    // Update check-in or check-out
    const currentTime = new Date();

    if (type === "checkIn") {
      attendance.checkIn = {
        time: currentTime,
        photo: photoUrl,
        location: location || "",
      };
      attendance.status = "Present";
    } else if (type === "checkOut") {
      attendance.checkOut = {
        time: currentTime,
        photo: photoUrl,
        location: location || "",
      };

      // Calculate hours worked
      if (attendance.checkIn?.time) {
        const hoursWorked =
          (currentTime - new Date(attendance.checkIn.time)) / (1000 * 60 * 60);
        attendance.hoursWorked = Math.round(hoursWorked * 100) / 100;
      }
    } else if (type === "undoCheckIn") {
      if (!attendance.checkIn?.time) {
        return res.status(400).json({ message: "No check-in found to undo" });
      }
      const diffMins = (currentTime.getTime() - new Date(attendance.checkIn.time).getTime()) / 60000;
      if (diffMins > 5) {
        return res.status(400).json({ message: "Undo window (5 minutes) has expired for check-in" });
      }
      attendance.checkIn = undefined;
      attendance.status = "Absent";
    } else if (type === "undoCheckOut") {
      if (!attendance.checkOut?.time) {
        return res.status(400).json({ message: "No check-out found to undo" });
      }
      const diffMins = (currentTime.getTime() - new Date(attendance.checkOut.time).getTime()) / 60000;
      if (diffMins > 5) {
        return res.status(400).json({ message: "Undo window (5 minutes) has expired for check-out" });
      }
      attendance.checkOut = undefined;
      attendance.hoursWorked = undefined;
    }

    await attendance.save();

    let actionText = type;
    if (type === 'checkIn') actionText = 'Check-in';
    else if (type === 'checkOut') actionText = 'Check-out';
    else if (type === 'undoCheckIn') actionText = 'Check-in undone';
    else if (type === 'undoCheckOut') actionText = 'Check-out undone';

    res.status(200).json({
      message: `${actionText} recorded successfully`,
      attendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Attendance Records
