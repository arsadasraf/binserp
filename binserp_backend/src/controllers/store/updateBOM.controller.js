import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { recalculateMRPWithLatestBOM } from "../purchase/mrpPlan.controller.js";
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


export const updateBOM = async (req, res) => {
  try {
    const BOM = req.getModel('BOM', bomSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const bom = await BOM.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    );
    if (!bom) return res.status(404).json({ message: "BOM not found" });

    // If BOM items were updated, automatically sync linked active MRP plans
    if (Array.isArray(req.body.items)) {
      try {
        const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
        const linkedPlans = await MRPPlan.find({
          company: companyId,
          status: { $in: ["Planned", "In Procurement", "Draft", "Partially Completed"] },
          $or: [
            { "fgItems.bomId": id },
            { "fgItems.bomNumber": bom.bomNumber },
            { "fgItems.fgItemCode": bom.productCode },
            { "fgItems.fgItemName": bom.productName },
            { "fgItems.nestedMaterials.materialName": bom.productName },
            { "fgItems.nestedMaterials.materialCode": bom.productCode },
            { "subAssemblyRequirements.materialName": bom.productName },
            { "subAssemblyRequirements.materialCode": bom.productCode }
          ]
        });

        for (const plan of linkedPlans) {
          await recalculateMRPWithLatestBOM(plan, req).catch((err) => {
            console.warn(`Auto-sync MRP Plan ${plan.mrpNumber} failed:`, err);
          });
        }
      } catch (syncErr) {
        console.warn("Auto-syncing linked MRP plans failed:", syncErr);
      }
    }

    res.status(200).json({ message: "BOM updated successfully", bom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update GRN and auto-update inventory when status changes to Accepted
