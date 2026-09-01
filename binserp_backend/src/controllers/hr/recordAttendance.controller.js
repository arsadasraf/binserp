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

    const currentTime = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lookback36h = new Date(currentTime.getTime() - 36 * 60 * 60 * 1000);

    let attendance;

    if (type === "checkIn") {
      // Check if employee is already checked in (active session in last 36 hours)
      const openAttendance = await Attendance.findOne({
        company: companyId,
        employee: employee._id,
        "checkIn.time": { $gte: lookback36h },
        $or: [
          { "checkOut.time": { $exists: false } },
          { "checkOut.time": null }
        ]
      }).sort({ "checkIn.time": -1 });

      if (openAttendance) {
        return res.status(400).json({
          message: `Employee is already checked in since ${new Date(openAttendance.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please check out first.`,
        });
      }

      attendance = new Attendance({
        company: companyId,
        employee: employee._id,
        date: currentTime,
        status: "Present",
        checkIn: {
          time: currentTime,
          photo: photoUrl,
          location: location || "",
          markedBy: req.user?._id || req.user?.id,
          method: "Manual"
        },
        hoursWorked: 0,
        verificationMethod: "Manual"
      });

      await attendance.save();

    } else if (type === "checkOut") {
      // Look for open check-in in the last 36 hours (cross-midnight / extended shift support)
      attendance = await Attendance.findOne({
        company: companyId,
        employee: employee._id,
        "checkIn.time": { $gte: lookback36h },
        $or: [
          { "checkOut.time": { $exists: false } },
          { "checkOut.time": null }
        ]
      }).sort({ "checkIn.time": -1 });

      // Fallback: search for today's record that is still open
      if (!attendance) {
        attendance = await Attendance.findOne({
          company: companyId,
          employee: employee._id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
          $or: [
            { "checkOut.time": { $exists: false } },
            { "checkOut.time": null }
          ]
        }).sort({ "checkIn.time": -1 });
      }

      if (!attendance) {
        return res.status(400).json({
          message: "No active check-in found for this employee to check out.",
        });
      }

      const diffMs = currentTime.getTime() - new Date(attendance.checkIn.time).getTime();
      const diffMins = diffMs / 60000;
      const diffHours = diffMs / 3600000;

      // 5-Minute Anti-Double-Scan Debounce
      if (diffMins < 5) {
        const waitSecs = Math.max(1, Math.round(300 - (diffMs / 1000)));
        return res.status(400).json({
          status: "warning",
          type: "debounce",
          message: `Employee checked in only ${Math.floor(diffMins)}m ago. Check-out is available after 5 minutes (wait ${waitSecs}s).`
        });
      }

      // Early Check-Out (< 4h) Confirmation
      const forceCheckOut = req.body.forceCheckOut === true || req.body.forceCheckOut === "true";
      if (diffHours < 4 && !forceCheckOut) {
        const hoursFormatted = Math.floor(diffHours);
        const minsFormatted = Math.round((diffHours % 1) * 60);
        return res.status(200).json({
          status: "requires_confirmation",
          type: "early_checkout",
          employee: employee.name,
          employeeId: employee._id,
          hoursWorked: parseFloat(diffHours.toFixed(2)),
          workedText: `${hoursFormatted}h ${minsFormatted}m`,
          message: `Employee has worked for ${hoursFormatted}h ${minsFormatted}m (less than 4 hours). Do you confirm early check-out?`
        });
      }

      attendance.checkOut = {
        time: currentTime,
        photo: photoUrl,
        location: location || "",
        markedBy: req.user?._id || req.user?.id,
        method: "Manual"
      };

      attendance.hoursWorked = Math.round(diffHours * 100) / 100;
      attendance.verificationMethod = "Manual";
      if (diffHours < 4) {
        attendance.earlyDeparture = true;
      }

      await attendance.save();

    } else if (type === "undoCheckIn") {
      attendance = await Attendance.findOne({
        company: companyId,
        employee: employee._id,
        "checkIn.time": { $gte: lookback36h },
        $or: [
          { "checkOut.time": { $exists: false } },
          { "checkOut.time": null }
        ]
      }).sort({ "checkIn.time": -1 });

      if (!attendance || !attendance.checkIn?.time) {
        return res.status(400).json({ message: "No active check-in found to undo" });
      }
      const diffMins = (currentTime.getTime() - new Date(attendance.checkIn.time).getTime()) / 60000;
      if (diffMins > 5) {
        return res.status(400).json({ message: "Undo window (5 minutes) has expired for check-in" });
      }
      attendance.checkIn = undefined;
      attendance.status = "Absent";
      await attendance.save();

    } else if (type === "undoCheckOut") {
      attendance = await Attendance.findOne({
        company: companyId,
        employee: employee._id,
        "checkOut.time": { $gte: lookback36h }
      }).sort({ "checkOut.time": -1 });

      if (!attendance || !attendance.checkOut?.time) {
        return res.status(400).json({ message: "No check-out found to undo" });
      }
      const diffMins = (currentTime.getTime() - new Date(attendance.checkOut.time).getTime()) / 60000;
      if (diffMins > 5) {
        return res.status(400).json({ message: "Undo window (5 minutes) has expired for check-out" });
      }
      attendance.checkOut = undefined;
      attendance.hoursWorked = 0;
      await attendance.save();
    }

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
