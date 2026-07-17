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
      leaves,
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

    // Parse leaves if it's a JSON string
    if (typeof leaves === "string") {
      try {
        leaves = JSON.parse(leaves);
      } catch (e) {
        leaves = { casualLeave: 0, sickLeave: 0 };
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
      leaves: leaves || { casualLeave: 0, sickLeave: 0 },
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
