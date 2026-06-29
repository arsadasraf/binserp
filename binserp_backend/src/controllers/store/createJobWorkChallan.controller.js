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
  quotationSchema,
  fgItemSchema
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


export const createJobWorkChallan = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const Material = req.getModel("RmBoItem", rmBoItemSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);

    const companyId = getCompanyId(req);
    let { challanNumber, vendor, date, expectedReturnDate, items } = req.body;

    // Validate Input
    if (!vendor || !items || items.length === 0) {
      return res.status(400).json({ message: "Vendor, and items are required" });
    }

    // Auto-generate Challan Number if missing
    if (!challanNumber) {
      const lastChallan = await JobWorkChallan.findOne({ company: companyId }).sort({ createdAt: -1 });
      if (lastChallan && lastChallan.challanNumber && lastChallan.challanNumber.startsWith("JWC-")) {
        const lastNum = parseInt(lastChallan.challanNumber.split("-")[1], 10);
        if (!isNaN(lastNum)) {
          challanNumber = `JWC-${String(lastNum + 1).padStart(4, '0')}`;
        } else {
          challanNumber = `JWC-0001`;
        }
      } else {
        challanNumber = `JWC-0001`;
      }
    }

    // Process Items and Update Source Stock
    const processedItems = [];
    for (const item of items) {
      const { item: itemId, itemType, quantitySent, processType, unit, description } = item;

      // 1. Validate Stock & Fetch Name
      let itemName = "";
      let validItemId = itemId;
      
      if (itemType === "bo") {
        const materialDoc = await Material.findById(itemId);
        if (!materialDoc) return res.status(400).json({ message: `Material not found: ${itemId}` });

        itemName = materialDoc.name;
      } else if (itemType === "custom") {
        itemName = item.itemName || "Custom Item";
        validItemId = null; // Custom items don't have an ID
      } else { // InHouse
        const fgDoc = await FGItem.findById(itemId);
        if (!fgDoc) return res.status(400).json({ message: `FG Item not found: ${itemId}` });

        itemName = fgDoc.name || fgDoc.componentName;
      }

      const processedItem = {
        itemName,
        itemType,
        processType,
        quantitySent,
        quantityReceived: 0,
        unit: unit || "PCS",
        description,
        status: "Sent",
      };

      if (validItemId) {
        processedItem.item = validItemId;
      }
      processedItems.push(processedItem);
    }

    // Create Challan
    const jobWork = await JobWorkChallan.create({
      company: companyId,
      challanNumber,
      vendor,
      date: date || new Date(),
      expectedReturnDate,
      status: "Open",
      items: processedItems,
      createdBy: req.user.id
    });

    res.status(201).json({ message: "Job Work Challan created successfully", jobWork });

  } catch (error) {
    console.error("Create JobWork Error:", error);
    res.status(500).json({ message: error.message });
  }
};

