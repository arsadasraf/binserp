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
    if (typeof updateData.leaves === "string") {
      try { updateData.leaves = JSON.parse(updateData.leaves); } catch (e) { }
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
