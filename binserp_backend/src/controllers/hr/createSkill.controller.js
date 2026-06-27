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
