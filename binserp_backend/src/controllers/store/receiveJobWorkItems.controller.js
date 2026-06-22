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
import { prefixSettingsSchema } from "../../models/prefix.model.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc.model.js";
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


export const receiveJobWorkItems = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
      const Component = req.getModel("Component", componentSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { items: receivedItems } = req.body; // Array of { itemId, quantityReceived }

    const jobWork = await JobWorkChallan.findById(id);
    if (!jobWork) return res.status(404).json({ message: "Job Work Challan not found" });

    let allCompleted = true;

    for (const recItem of receivedItems) {
      const { itemId, quantity } = recItem; // itemId here is the _id of the item inside Challan.items
      const jwItem = jobWork.items.id(itemId); // Use subdocument ID method

      if (jwItem) {
        // Validation
        const pending = jwItem.quantitySent - jwItem.quantityReceived;

        // Update JW Item
        jwItem.quantityReceived += Number(quantity);
        if (jwItem.quantityReceived >= jwItem.quantitySent) {
          jwItem.status = "Completed";


        } else {
          jwItem.status = "Partial";
          allCompleted = false;
        }

        // Inventory update disabled as per user request
        
        // Add to history timeline
        if (!jobWork.receiveHistory) jobWork.receiveHistory = [];
        jobWork.receiveHistory.push({
          date: new Date(),
          itemId: itemId,
          quantity: Number(quantity)
        });

      }
    }

    // Update Main Status
    const anyPending = jobWork.items.some(i => i.status !== "Completed");
    jobWork.status = anyPending ? "Partial" : "Closed";

    await jobWork.save();

    res.status(200).json({ message: "Items received successfully", jobWork });

  } catch (error) {
    console.error("Receive JobWork Error:", error);
    res.status(500).json({ message: error.message });
  }
};

