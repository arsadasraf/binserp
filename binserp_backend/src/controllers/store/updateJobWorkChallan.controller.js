import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, purchaseOrderSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { prefixSettingsSchema } from "../../models/prefix/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import fs from 'fs';
import path from 'path';

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// Helper function to update COMPONENT stock (InHouse)
const updateComponentStock = async (req, componentId, quantity) => {
  try {
    const companyId = getCompanyId(req); // Derive companyId from req
    const Component = req.getModel("Component", componentSchema);
    const component = await Component.findById(componentId);
    if (!component) {
      console.error(`Component not found: ${componentId}`);
      return null;
    }

    // Update quantity
    await Component.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};



// ========== GRN (Goods Receipt Note) ==========


export const updateJobWorkChallan = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const existingChallan = await JobWorkChallan.findOne({ _id: id, company: companyId });
    if (!existingChallan) return res.status(404).json({ message: "Job Work Challan not found" });

    // Block edit if already partially or fully received
    if (existingChallan.status === "Partial" || existingChallan.status === "Closed") {
      return res.status(400).json({ message: "Cannot edit a challan that has received items" });
    }

    const challan = await JobWorkChallan.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    );
    res.status(200).json({ message: "Job Work Challan updated successfully", challan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

