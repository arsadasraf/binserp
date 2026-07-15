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


export const updateCustomer = async (req, res) => {
  try {
    const Customer = req.getModel('Customer', customerSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    let updateData = { ...req.body };
    if (req.body.bankDetails) {
      updateData.bankDetails = {
        accountNumber: req.body.bankDetails.accountNumber || "",
        ifscCode: req.body.bankDetails.ifscCode || "",
        bankName: req.body.bankDetails.bankName || "",
        branchName: req.body.bankDetails.branchName || req.body.bankDetails.branch || "",
        accountName: req.body.bankDetails.accountName || "",
        swiftCode: req.body.bankDetails.swiftCode || "",
      };
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.status(200).json({ message: "Customer updated successfully", customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Location
