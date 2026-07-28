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


    if (typeof updateData.paymentDetails === "string") {
      try { updateData.paymentDetails = JSON.parse(updateData.paymentDetails); } catch (e) { }
    }
    if (typeof updateData.salary === "string") {
      try { updateData.salary = JSON.parse(updateData.salary); } catch (e) { }
    }
    if (typeof updateData.leaves === "string") {
      try { updateData.leaves = JSON.parse(updateData.leaves); } catch (e) { }
    }
    if (typeof updateData.weeklyOff === "string") {
      try { updateData.weeklyOff = JSON.parse(updateData.weeklyOff); } catch (e) { updateData.weeklyOff = [updateData.weeklyOff]; }
    }
    if (updateData.isOTApplicable !== undefined) {
      updateData.isOTApplicable = updateData.isOTApplicable === 'true' || updateData.isOTApplicable === true;
    }
    if (updateData.otCompensateForAbsent !== undefined) {
      updateData.otCompensateForAbsent = updateData.otCompensateForAbsent === 'true' || updateData.otCompensateForAbsent === true;
    }
    if (updateData.absentOTRate !== undefined) {
      updateData.absentOTRate = Number(updateData.absentOTRate) || 0;
    }

    // Parse existing document arrays if they come as strings
    if (typeof updateData.existingIdDocuments === "string") {
      try { updateData.idDocuments = JSON.parse(updateData.existingIdDocuments); } catch (e) { updateData.idDocuments = [updateData.existingIdDocuments]; }
    } else if (Array.isArray(updateData.existingIdDocuments)) {
      updateData.idDocuments = updateData.existingIdDocuments;
    } else {
      updateData.idDocuments = [];
    }

    if (typeof updateData.existingDegreeDocuments === "string") {
      try { updateData.degreeDocuments = JSON.parse(updateData.existingDegreeDocuments); } catch (e) { updateData.degreeDocuments = [updateData.existingDegreeDocuments]; }
    } else if (Array.isArray(updateData.existingDegreeDocuments)) {
      updateData.degreeDocuments = updateData.existingDegreeDocuments;
    } else {
      updateData.degreeDocuments = [];
    }

    if (typeof updateData.existingExperienceDocuments === "string") {
      try { updateData.experienceDocuments = JSON.parse(updateData.existingExperienceDocuments); } catch (e) { updateData.experienceDocuments = [updateData.existingExperienceDocuments]; }
    } else if (Array.isArray(updateData.existingExperienceDocuments)) {
      updateData.experienceDocuments = updateData.existingExperienceDocuments;
    } else {
      updateData.experienceDocuments = [];
    }

    // Handle file uploads if provided
    if (req.files) {
      if (req.files['photo'] && req.files['photo'].length > 0) {
        const uploadResult = await uploadOnS3(req.files['photo'][0].path, "employees", getCompanyLoginId(req));
        if (uploadResult) updateData.photo = uploadResult.secure_url;
      }
      
      if (req.files['idDocuments'] && req.files['idDocuments'].length > 0) {
        for (const file of req.files['idDocuments']) {
          const uploadResult = await uploadOnS3(file.path, "employees/documents", getCompanyLoginId(req));
          if (uploadResult) updateData.idDocuments.push(uploadResult.secure_url);
        }
      }
      
      if (req.files['degreeDocuments'] && req.files['degreeDocuments'].length > 0) {
        for (const file of req.files['degreeDocuments']) {
          const uploadResult = await uploadOnS3(file.path, "employees/documents", getCompanyLoginId(req));
          if (uploadResult) updateData.degreeDocuments.push(uploadResult.secure_url);
        }
      }
      
      if (req.files['experienceDocuments'] && req.files['experienceDocuments'].length > 0) {
        for (const file of req.files['experienceDocuments']) {
          const uploadResult = await uploadOnS3(file.path, "employees/documents", getCompanyLoginId(req));
          if (uploadResult) updateData.experienceDocuments.push(uploadResult.secure_url);
        }
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
