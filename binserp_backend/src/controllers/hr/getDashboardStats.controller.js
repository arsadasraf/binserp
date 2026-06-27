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

export const getDashboardStats = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);
      const Attendance = req.getModel('Attendance', attendanceSchema);

    const companyId = getCompanyId(req);

    // Parse Date from Query or Default to Today
    let targetDate = new Date();
    if (req.query.date) {
      targetDate = new Date(req.query.date);
    }

    // Set start and end of the target day
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1. Total Employees
    const totalEmployees = await Employee.countDocuments({
      company: companyId,
      status: { $ne: 'Terminated' }
    });

    // 2. Attendance for Target Date
    const todayAttendance = await Attendance.find({
      company: companyId,
      date: { $gte: targetDate, $lt: nextDay }
    }).populate('employee', 'department designation');

    // Calculate Counts
    let presentCount = 0;

    // Map to store counts for aggregation
    const deptStats = {};
    const desigStats = {};

    todayAttendance.forEach(record => {
      if (record.status === 'Present' || record.status === 'HalfDay' || record.status === 'Late') {
        presentCount++;

        // Department Aggregation
        const dept = record.employee?.department || 'Unknown';
        if (!deptStats[dept]) deptStats[dept] = { present: 0 };
        deptStats[dept].present++;

        // Designation Aggregation
        const desig = record.employee?.designation || 'Unknown';
        if (!desigStats[desig]) desigStats[desig] = { present: 0 };
        desigStats[desig].present++;
      }
    });

    // 3. Get All Active Employees for detailed aggregation (Total per Dept/Desig)
    const allEmployees = await Employee.find({
      company: companyId,
      status: { $ne: 'Terminated' }
    }).select('department designation');

    // Aggregate Totals
    allEmployees.forEach(emp => {
      const dept = emp.department || 'Unknown';
      if (!deptStats[dept]) deptStats[dept] = { present: 0, total: 0 };
      if (!deptStats[dept].total) deptStats[dept].total = 0;
      deptStats[dept].total++;

      const desig = emp.designation || 'Unknown';
      if (!desigStats[desig]) desigStats[desig] = { present: 0, total: 0 };
      if (!desigStats[desig].total) desigStats[desig].total = 0;
      desigStats[desig].total++;
    });

    // Format Response Arrays
    const departmentWise = Object.keys(deptStats).map(key => ({
      name: key,
      total: deptStats[key].total,
      present: deptStats[key].present,
      absent: deptStats[key].total - deptStats[key].present
    }));

    const designationWise = Object.keys(desigStats).map(key => ({
      name: key,
      total: desigStats[key].total,
      present: desigStats[key].present,
      absent: desigStats[key].total - desigStats[key].present
    }));

    res.status(200).json({
      totalEmployees,
      presentToday: presentCount,
      absentToday: totalEmployees - presentCount,
      departmentWise,
      designationWise
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Error fetching dashboard stats" });
  }
};

// ========== EMPLOYEE DASHBOARD (SELF) ==========
