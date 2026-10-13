import { employeeSchema, attendanceSchema, departmentSchema, designationSchema, skillSchema, employeeTypeSchema, salarySchema, employeeJobSchema, holidaySchema } from "../../models/hr/index.js";
import { hrPrefixSettingsSchema } from "../../models/hrPrefix/index.js";
import { jobSchema, manpowerSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import mongoose from "mongoose";

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

export const getEmployeeDashboardData = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    // Ensure user is an employee
    if (req.userType !== 'employee') {
      return res.status(403).json({ message: "Access denied. Employee only." });
    }

    const employeeId = req.user._id;

    // Models
    const Attendance = req.getModel('Attendance', attendanceSchema);
    const EmployeeJob = req.getModel('EmployeeJob', employeeJobSchema);
    const Job = req.getModel('Job', jobSchema);
    const Salary = req.getModel('Salary', salarySchema);
    const Holiday = req.getModel('Holiday', holidaySchema);
    const Employee = req.getModel('Employee', employeeSchema);

    const employeeDoc = await Employee.findById(employeeId);

    // 1. Fetch Full Monthly Attendance for at least the Last 3 Calendar Months + Current Month
    const now = new Date();
    // Default window: from the 1st of 3 months ago until end of the current month
    let queryStartDate = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0, 0);
    let queryEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (req.query.startDate && req.query.endDate) {
      queryStartDate = new Date(req.query.startDate);
      queryEndDate = new Date(req.query.endDate);
      queryEndDate.setHours(23, 59, 59, 999);
    } else if (req.query.month) {
      const [mYear, mMonth] = req.query.month.split('-').map(Number);
      const reqStart = new Date(mYear, mMonth - 1, 1, 0, 0, 0, 0);
      const reqEnd = new Date(mYear, mMonth, 0, 23, 59, 59, 999);
      if (reqStart < queryStartDate) queryStartDate = reqStart;
      if (reqEnd > queryEndDate) queryEndDate = reqEnd;
    }

    const attendanceRecords = await Attendance.find({
      company: companyId,
      employee: employeeId,
      date: { $gte: queryStartDate, $lte: queryEndDate }
    }).sort({ date: -1 });

    const holidays = await Holiday.find({
      company: companyId,
      isActive: true,
      date: { $gte: queryStartDate, $lte: queryEndDate }
    });

    // 2. Fetch Assigned Work (Jobs where assignedEmployee match OR assignedManpower contains employee)
    // Note: PPC Job schema usually has `assignedManpower` array linking to `Manpower` schema which links to `Employee`.
    // Direct link `assignedEmployee` in `processHistory` might be used or `assignedManpower` in `job`.
    // For now, let's assume we look for Jobs where this employee is involved.

    // We need to find Manpower ID for this employee first if Job uses Manpower ref
    // But for simplicity, let's search where we can.

    // Strategy: simplified search on assignedManpower via populate if possible, or assume explicit link?
    // Let's try to match Manpower first.
    const Manpower = req.getModel('Manpower', manpowerSchema);
    // We need actual Manpower schema but I can't import it easily without file read of generic schema if not exported in hr.model
    // Wait, jobSchema is imported from ppc.model.js. Manpower schema is also there. 
    // I should import manpowerSchema from ppc.model.js as well.

    // *Re-checking imports*: I will add manpowerSchema to imports in next step or assume strict referencing.
    // Let's stick to what we have. 

    const jobs = await Job.find({
      company: companyId,
      $or: [
        { "processHistory.assignedEmployee": employeeId }, // Direct assignment in granular history
        // We might miss top-level assignedManpower if we don't resolve Manpower ID.
        // For MVP, focus on processHistory which is more granular/likely for "Dashboard"
      ],
      status: { $in: ["Scheduled", "InProgress"] }
    }).select("jobNumber partName customerName status processHistory quantity scheduledStart scheduledEnd");

    // Filter processHistory to only show items relevant to this employee
    const myJobs = jobs.map(job => {
      const myTasks = job.processHistory.filter(ph => ph.assignedEmployee?.toString() === employeeId.toString() && ph.status !== 'Completed');
      return {
        ...job.toObject(),
        myTasks
      };
    }).filter(j => j.myTasks.length > 0 || j.processHistory.length === 0); // Include if matched top level (future) or has specific tasks

    // 2.1 Fetch NEW Employee Jobs
    const assignedJobsDirect = await EmployeeJob.find({
      company: companyId,
      employee: employeeId,
      status: { $ne: 'Completed' } // Show pending/inprogress primarily? Or all. Let's fetch active ones.
    }).sort({ priority: 1, dueDate: 1 });


    // 3. Fetch Salary Slips
    const salarySlips = await Salary.find({
      company: companyId,
      employee: employeeId,
      status: "Paid"
    }).sort({ year: -1, month: -1 }).limit(12);

    res.status(200).json({
      employee: {
        _id: req.user._id,
        employeeId: employeeDoc?.employeeId || req.user.employeeId,
        name: employeeDoc?.name || req.user.name,
        designation: employeeDoc?.designation || req.user.designation,
        department: employeeDoc?.department || req.user.department,
        joiningDate: employeeDoc?.joiningDate || req.user.joiningDate,
        weeklyOff: employeeDoc?.weeklyOff || 'Sunday',
        photo: employeeDoc?.photo || req.user.photo
      },
      weeklyOff: employeeDoc?.weeklyOff || 'Sunday',
      holidays: holidays || [],
      attendance: attendanceRecords,
      assignedJobs: [...assignedJobsDirect, ...myJobs],
      employeeJobs: assignedJobsDirect,
      ppcJobs: myJobs,
      salarySlips: salarySlips
    });

  } catch (error) {
    console.error("Employee Dashboard Error:", error);
    res.status(500).json({ message: error.message });
  }
};
