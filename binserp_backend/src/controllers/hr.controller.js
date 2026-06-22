import { employeeSchema, attendanceSchema, departmentSchema, designationSchema, skillSchema, employeeTypeSchema, salarySchema, employeeJobSchema } from "../models/hr.model.js";
import { hrPrefixSettingsSchema } from "../models/hrPrefix.model.js";
import { jobSchema, manpowerSchema } from "../models/ppc.model.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../utils/s3.js";
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
export const createEmployee = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);
    const companyId = getCompanyId(req);
    let {
      employeeId, // Optional now, auto-generated if missing
      name,
      email,
      contact,
      department,
      employeeType,
      designation,
      skills,
      joiningDate,
      status,
      faceEncoding,
      experience,
      degree,
      paymentDetails,
      salary,
    } = req.body;

    // Parse skills if it's a JSON string
    if (typeof skills === "string") {
      try {
        skills = JSON.parse(skills);
      } catch (e) {
        skills = skills ? [skills] : [];
      }
    }

    // Parse paymentDetails if it's a JSON string
    if (typeof paymentDetails === "string") {
      try {
        paymentDetails = JSON.parse(paymentDetails);
      } catch (e) {
        paymentDetails = {};
      }
    }

    // Parse salary if it's a JSON string
    if (typeof salary === "string") {
      try {
        salary = JSON.parse(salary);
      } catch (e) {
        salary = {};
      }
    }

    if (!name || !email || !contact || !department || !designation) {
      return res.status(400).json({
        message: "Name, email, contact, department, and designation are required",
      });
    }

    // Auto-generate Employee ID if not provided
    if (!employeeId) {
      try {
        console.log(">>> Auto-generating Employee ID");
        const HRPrefixSettings = req.getModel("HRPrefixSettings", hrPrefixSettingsSchema);
        if (!HRPrefixSettings) throw new Error("Failed to get HRPrefixSettings model");

        let settings = await HRPrefixSettings.findOne();
        console.log(">>> Existing settings:", settings);

        if (!settings) {
          console.log(">>> Creating default settings");
          settings = await HRPrefixSettings.create({});
          console.log(">>> Created settings:", settings);
        }

        if (!settings) throw new Error("Settings is null after creation attempt");

        // Ensure employeeSerial exists (handle migration for existing docs)
        if (!settings.employeeSerial) {
          settings.employeeSerial = 1;
        }

        employeeId = `${settings.employeePrefix}-${String(settings.employeeSerial).padStart(4, '0')}`;
        console.log(">>> Generated ID:", employeeId);

        // Increment serial
        settings.employeeSerial += 1;
        await settings.save();
        console.log(">>> Saved updated settings");
      } catch (err) {
        console.error(">>> Error in auto-ID generation:", err);
        return res.status(500).json({ message: "Error generating Employee ID: " + err.message });
      }
    }

    // Check if employeeId already exists
    const existingEmployee = await Employee.findOne({
      $or: [{ employeeId }, { email }],
      company: companyId
    });

    if (existingEmployee) {
      return res.status(400).json({
        message: "Employee ID or email already exists",
      });
    }

    // Handle photo upload if provided
    let photoUrl = null;
    if (req.file) {
      const uploadResult = await uploadOnS3(req.file.path, "employees", getCompanyLoginId(req));
      if (uploadResult) {
        photoUrl = uploadResult.secure_url;
      }
    }

    const employee = await Employee.create({
      company: companyId,
      employeeId,
      name,
      email,
      contact,
      department,
      employeeType: employeeType || "Full-Time",
      designation,
      skills: skills || [],
      joiningDate: joiningDate || new Date(),
      status: status || "Active",
      photo: photoUrl,
      faceEncoding,
      experience,
      degree,
      paymentDetails: paymentDetails || {},
      salary: salary || {},
    });

    res.status(201).json({
      message: "Employee created successfully",
      employee,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Employees
// Get All Employees
export const getAllEmployees = async (req, res) => {
  try {
    console.log(">>> [getAllEmployees] Fetching employees...");
    if (!req.getModel) throw new Error("req.getModel is undefined");

    const Employee = req.getModel('Employee', employeeSchema);
    if (!Employee) throw new Error("Failed to load Employee model from tenant connection");

    // Pre-register Skill model for populate
    req.getModel('Skill', skillSchema);

    const companyId = getCompanyId(req);
    console.log(">>> [getAllEmployees] Company ID:", companyId);

    const { department, status } = req.query;

    const query = { company: companyId };
    if (department) query.department = department;
    if (status) query.status = status;

    const employees = await Employee.find(query)
      .populate('skills', 'name')
      .sort({ createdAt: -1 });

    // Sign photos for preview
    const signedEmployees = await Promise.all(employees.map(async (emp) => {
      const empObj = emp.toObject();
      if (empObj.photo) empObj.photo = (await signPhotos([empObj.photo]))[0];
      return empObj;
    }));

    res.status(200).json({
      employees: signedEmployees,
      count: signedEmployees.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const employee = await Employee.findOne({
      _id: id,
      company: companyId,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const empObj = employee.toObject();
    if (empObj.photo) empObj.photo = (await signPhotos([empObj.photo]))[0];

    res.status(200).json(empObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Employee
export const updateEmployee = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    let updateData = req.body;

    // Parse complex fields if they come as strings
    if (typeof updateData.skills === "string") {
      try { updateData.skills = JSON.parse(updateData.skills); } catch (e) { }
    }
    if (typeof updateData.paymentDetails === "string") {
      try { updateData.paymentDetails = JSON.parse(updateData.paymentDetails); } catch (e) { }
    }
    if (typeof updateData.salary === "string") {
      try { updateData.salary = JSON.parse(updateData.salary); } catch (e) { }
    }

    // Handle photo upload if provided
    if (req.file) {
      const uploadResult = await uploadOnS3(req.file.path, "employees", companyId);
      if (uploadResult) {
        updateData.photo = uploadResult.secure_url;
      }
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      message: "Employee updated successfully",
      employee,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Employee
export const deleteEmployee = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const employee = await Employee.findOne({
      _id: id,
      company: companyId,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const ageMs = Date.now() - new Date(employee.createdAt || employee._id.getTimestamp()).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (ageMs > TWENTY_FOUR_HOURS) {
      return res.status(403).json({ 
        message: "Employee records can only be deleted within 24 hours of creation. Use the Active/Inactive toggle instead." 
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
export const toggleEmployeeStatus = async (req, res) => {
  try {
    const Employee = req.getModel('Employee', employeeSchema);
    const { id } = req.params;
    const companyId = getCompanyId(req);

    const employee = await Employee.findOne({ _id: id, company: companyId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const newActive = !employee.isActive;
    const updatePayload = {
      isActive: newActive,
      status: newActive ? "Active" : "Inactive",
    };
    
    if (newActive && !employee.activatedAt) {
      updatePayload.activatedAt = new Date();
    }

    const updated = await Employee.findOneAndUpdate(
      { _id: id, company: companyId },
      updatePayload,
      { new: true }
    );

    res.status(200).json({
      message: `Employee ${newActive ? "activated" : "deactivated"} successfully`,
      employee: updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== ATTENDANCE MANAGEMENT ==========

// Record Attendance (Check-in/Check-out)
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

export const createDepartment = async (req, res) => {
  try {
    const Department = req.getModel('Department', departmentSchema);

    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Department name is required" });
    }

    const existing = await Department.findOne({ company: companyId, name });
    if (existing) {
      return res.status(400).json({ message: "Department already exists" });
    }

    const department = await Department.create({
      company: companyId,
      name,
      description,
    });

    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const Department = req.getModel('Department', departmentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    const department = await Department.findOneAndUpdate(
      { _id: id, company: companyId },
      { name, description },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    res.status(200).json({
      message: "Department updated successfully",
      department,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllDepartments = async (req, res) => {
  try {
    const Department = req.getModel('Department', departmentSchema);

    const companyId = getCompanyId(req);
    const departments = await Department.find({ company: companyId }).sort({ name: 1 });
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const Department = req.getModel('Department', departmentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    await Department.findOneAndDelete({ _id: id, company: companyId });
    res.status(200).json({ message: "Department deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== DESIGNATION MANAGEMENT ==========

export const createDesignation = async (req, res) => {
  try {
    const Designation = req.getModel('Designation', designationSchema);

    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Designation name is required" });
    }

    const existing = await Designation.findOne({ company: companyId, name });
    if (existing) {
      return res.status(400).json({ message: "Designation already exists" });
    }

    const designation = await Designation.create({
      company: companyId,
      name,
      description,
    });

    res.status(201).json(designation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDesignation = async (req, res) => {
  try {
    const Designation = req.getModel('Designation', designationSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    const designation = await Designation.findOneAndUpdate(
      { _id: id, company: companyId },
      { name, description },
      { new: true, runValidators: true }
    );

    if (!designation) {
      return res.status(404).json({ message: "Designation not found" });
    }

    res.status(200).json({
      message: "Designation updated successfully",
      designation,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllDesignations = async (req, res) => {
  try {
    const Designation = req.getModel('Designation', designationSchema);

    const companyId = getCompanyId(req);
    const designations = await Designation.find({ company: companyId }).sort({ name: 1 });
    res.status(200).json(designations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDesignation = async (req, res) => {
  try {
    const Designation = req.getModel('Designation', designationSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    await Designation.findOneAndDelete({ _id: id, company: companyId });
    res.status(200).json({ message: "Designation deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== SKILL MANAGEMENT ==========

export const createSkill = async (req, res) => {
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    if (!name) return res.status(400).json({ message: "Skill name is required" });

    // Check if skill already exists
    const existingSkill = await Skill.findOne({ name, company: companyId });
    if (existingSkill) {
      return res.status(400).json({ message: "Skill already exists" });
    }

    const skill = await Skill.create({ name, description, company: companyId });
    res.status(201).json({ message: "Skill created successfully", skill });
  } catch (error) {
    console.error("Create Skill Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllSkills = async (req, res) => {
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const companyId = getCompanyId(req);
    const skills = await Skill.find({ company: companyId }).sort({ name: 1 });
    res.status(200).json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSkill = async (req, res) => {
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    const skill = await Skill.findOneAndUpdate(
      { _id: id, company: companyId },
      { name, description },
      { new: true, runValidators: true }
    );

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    res.status(200).json({ message: "Skill updated successfully", skill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSkill = async (req, res) => {
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    await Skill.findOneAndDelete({ _id: id, company: companyId });
    res.status(200).json({ message: "Skill deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== EMPLOYEE TYPE MANAGEMENT ==========

export const createEmployeeType = async (req, res) => {
  try {
    const EmployeeType = req.getModel('EmployeeType', employeeTypeSchema);

    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    if (!name) return res.status(400).json({ message: "Employee Type name is required" });

    // Check if employee type already exists
    const existingType = await EmployeeType.findOne({ name, company: companyId });
    if (existingType) {
      return res.status(400).json({ message: "Employee Type already exists" });
    }

    const employeeType = await EmployeeType.create({ name, description, company: companyId });
    res.status(201).json({ message: "Employee Type created successfully", employeeType });
  } catch (error) {
    console.error("Create Employee Type Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllEmployeeTypes = async (req, res) => {
  try {
    const EmployeeType = req.getModel('EmployeeType', employeeTypeSchema);

    const companyId = getCompanyId(req);
    const employeeTypes = await EmployeeType.find({ company: companyId }).sort({ name: 1 });
    res.status(200).json(employeeTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateEmployeeType = async (req, res) => {
  try {
    const EmployeeType = req.getModel('EmployeeType', employeeTypeSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    const employeeType = await EmployeeType.findOneAndUpdate(
      { _id: id, company: companyId },
      { name, description },
      { new: true, runValidators: true }
    );

    if (!employeeType) {
      return res.status(404).json({ message: "Employee Type not found" });
    }

    res.status(200).json({ message: "Employee Type updated successfully", employeeType });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteEmployeeType = async (req, res) => {
  try {
    const EmployeeType = req.getModel('EmployeeType', employeeTypeSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    await EmployeeType.findOneAndDelete({ _id: id, company: companyId });
    res.status(200).json({ message: "Employee Type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== EMPLOYEE JOB MANAGEMENT (New Flow) ==========

// Assign Job to Employee (Admin/Manager)
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
    const EmployeeJob = req.getModel('EmployeeJob', employeeJobSchema); // NEW
    const Job = req.getModel('Job', jobSchema);
    const Salary = req.getModel('Salary', salarySchema);

    // 1. Fetch Recent Attendance (Last 30 days)
    const recentAttendance = await Attendance.find({
      company: companyId,
      employee: employeeId,
      date: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
    }).sort({ date: -1 });

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
        name: req.user.name,
        designation: req.user.designation,
        department: req.user.department,
        joiningDate: req.user.joiningDate,
        photo: req.user.photo
      },
      attendance: recentAttendance,
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
