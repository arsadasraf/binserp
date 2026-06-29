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
  rmBoItemSchema,
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


export const deleteGRN = async (req, res) => {
  try {
    const GRN = req.getModel('GRN', grnSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const grn = await GRN.findOne({ _id: id, company: companyId });
    if (!grn) {
      return res.status(404).json({ message: "GRN not found" });
    }

    // Reverse inventory update if GRN was accepted/received
    if ((grn.status === "Accepted" || grn.status === "Received") && grn.items && grn.items.length > 0) {
      for (const item of grn.items) {
        const quantity = item.acceptedQuantity || item.receivedQuantity || item.quantity;
        if (grn.type === 'inhouse') {
          const compId = item.component?._id || item.component || item.material;
          await updateComponentStock(req, compId, -quantity);
        } else {
          await updateInventoryStock(
            req,
            item.material, // Use material ID directly from item
            -quantity, // Negative quantity to reverse
            item.unit || "PCS",
            item.locationId
          );
        }
      }
    }

    await GRN.findByIdAndDelete(id);

    res.status(200).json({ message: "GRN deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== INVENTORY MANAGEMENT ==========

// Helper function to update inventory stock
