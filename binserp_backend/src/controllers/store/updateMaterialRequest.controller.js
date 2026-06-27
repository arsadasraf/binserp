import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import {
  deliveryChallanSchema,
  invoiceSchema,
  grnSchema,
  materialIssueSchema,
  bomSchema,
  inventorySchema,
  materialRequestSchema,
  purchaseOrderSchema,
  vendorSchema,
  customerSchema,
  locationSchema,
  categorySchema,
  materialSchema,
  companyInfoSchema,
  jobWorkSchema,
  jobWorkSupplierSchema,
  quotationSchema
} from "../../models/store/index.js";
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


export const updateMaterialRequest = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
      const Material = req.getModel('Material', materialSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const materialRequest = await MaterialRequest.findOne({
      _id: id,
      company: companyId,
    });

    if (!materialRequest) {
      return res.status(404).json({ message: "Material request not found" });
    }

    // If approving, set approvedBy
    if (status === "Approved" && !materialRequest.approvedBy) {
      materialRequest.approvedBy = req.user.id;
    }

    // Handle inventory update if status changes to "Issued"
    if (status === "Issued" && materialRequest.status !== "Issued" && !req.body.skipInventoryUpdate) {
      try {
        for (const item of materialRequest.items) {
          if (materialRequest.type === 'inhouse') {
            // Inhouse Logic: Update Component Stock
            if (item.component) {
              await updateComponentStock(req, item.component, -item.quantity);
            } else {
              // Fallback if component ID is missing but code/name exists (should have been caught in create)
              console.warn(`Inhouse item missing component reference: ${item.materialName}`);
            }
          } else {
            // BO Logic: Update Material Inventory
            // Use materialCode or find material by some means. 
            const materialDoc = await Material.findOne({ company: companyId, code: item.materialCode });
            if (materialDoc) {
              await updateInventoryStock(
                req,
                materialDoc._id,
                -item.quantity,
                item.unit || "PCS"
              );
            } else {
              console.warn(`Material not found for code: ${item.materialCode}, skipping inventory update.`);
            }
          }
        }
      } catch (err) {
        console.error("Inventory update failed during Issue:", err);
        return res.status(500).json({ message: "Failed to update inventory: " + err.message });
      }
    }

    materialRequest.status = status;
    if (remarks) materialRequest.remarks = remarks;

    await materialRequest.save();

    res.status(200).json({
      message: `Material request ${status.toLowerCase()} successfully`,
      materialRequest,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== PURCHASE ORDER (PO) ==========



