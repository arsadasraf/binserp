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
      gender,
      bloodGroup,
      dob,
      email,
      contact,
      department,
      employeeType,
      designation,
      idType,
      joiningDate,
      status,
      faceEncoding,
      experience,
      degree,
      standardWorkingHours,
      holidayWorkPolicy,
      weekOffWorkPolicy,
      paymentDetails,
      salary,
      leaves,
      compOffBalance,
      isOTApplicable,
      otCompensateForAbsent,
      absentOTRate
    } = req.body;


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

    let parsedWeeklyOff = req.body.weeklyOff || ["Sunday"];
    if (typeof parsedWeeklyOff === "string") {
      try {
        parsedWeeklyOff = JSON.parse(parsedWeeklyOff);
      } catch (e) {
        parsedWeeklyOff = [parsedWeeklyOff];
      }
    }

    if (!name || !department || !designation) {
      return res.status(400).json({
        message: "Name, department, and designation are required",
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
    const searchConditions = [{ employeeId }];
    if (email) searchConditions.push({ email });

    const existingEmployee = await Employee.findOne({
      $or: searchConditions,
      company: companyId
    });

    if (existingEmployee) {
      return res.status(400).json({
        message: "Employee ID or email already exists",
      });
    }

    // Handle file uploads if provided
    let photoUrl = null;
    let idDocumentsUrls = [];
    let degreeDocumentsUrls = [];
    let experienceDocumentsUrls = [];
    
    if (req.files) {
      if (req.files['photo'] && req.files['photo'].length > 0) {
        const uploadResult = await uploadOnS3(req.files['photo'][0].path, "employees", getCompanyLoginId(req));
        if (uploadResult) photoUrl = uploadResult.secure_url;
      }
      
      if (req.files['idDocuments'] && req.files['idDocuments'].length > 0) {
        for (const file of req.files['idDocuments']) {
          const uploadResult = await uploadOnS3(file.path, "employees/documents", getCompanyLoginId(req));
          if (uploadResult) idDocumentsUrls.push(uploadResult.secure_url);
        }
      }
      
      if (req.files['degreeDocuments'] && req.files['degreeDocuments'].length > 0) {
        for (const file of req.files['degreeDocuments']) {
          const uploadResult = await uploadOnS3(file.path, "employees/documents", getCompanyLoginId(req));
          if (uploadResult) degreeDocumentsUrls.push(uploadResult.secure_url);
        }
      }
      
      if (req.files['experienceDocuments'] && req.files['experienceDocuments'].length > 0) {
        for (const file of req.files['experienceDocuments']) {
          const uploadResult = await uploadOnS3(file.path, "employees/documents", getCompanyLoginId(req));
          if (uploadResult) experienceDocumentsUrls.push(uploadResult.secure_url);
        }
      }
    }

    const employee = await Employee.create({
      company: companyId,
      employeeId,
      name,
      gender,
      bloodGroup,
      dob,
      email,
      contact,
      department,
      employeeType: employeeType || "Full-Time",
      designation,
      idType,
      joiningDate: joiningDate || new Date(),
      status: status || "Active",
      photo: photoUrl,
      idDocuments: idDocumentsUrls,
      faceEncoding,
      experience,
      experienceDocuments: experienceDocumentsUrls,
      degree,
      degreeDocuments: degreeDocumentsUrls,
      paymentDetails: paymentDetails || {},
      salary: salary || {},
      leaves: leaves || { casualLeave: 0, sickLeave: 0 },
      weeklyOff: parsedWeeklyOff,
      compOffBalance: compOffBalance || 0,
      isOTApplicable: isOTApplicable === 'true',
      otCompensateForAbsent: otCompensateForAbsent === 'true',
      absentOTRate: Number(absentOTRate) || 0,
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
