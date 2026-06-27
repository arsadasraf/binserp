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
