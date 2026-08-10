import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
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
      const { itemId, returningItemId, quantity } = recItem;
      const qtyNum = Number(quantity) || 0;
      if (qtyNum <= 0) continue;

      let foundItem = null;

      for (const jwItem of jobWork.items) {
        if (jwItem.returningItems && jwItem.returningItems.length > 0) {
          const retDoc = jwItem.returningItems.id(returningItemId || itemId);
          if (retDoc) {
            retDoc.quantityReceived = (retDoc.quantityReceived || 0) + qtyNum;
            if (retDoc.quantityReceived >= retDoc.quantityToBeReceived) {
              retDoc.status = "Completed";
            } else {
              retDoc.status = "Partial";
            }

            const allRetCompleted = jwItem.returningItems.every(
              r => r.status === "Completed" || (r.quantityReceived || 0) >= r.quantityToBeReceived
            );
            jwItem.quantityReceived = (jwItem.quantityReceived || 0) + qtyNum;
            jwItem.status = allRetCompleted ? "Completed" : "Partial";
            foundItem = jwItem;
            break;
          }
        }

        if (String(jwItem._id) === String(itemId)) {
          jwItem.quantityReceived = (jwItem.quantityReceived || 0) + qtyNum;
          const targetQty = jwItem.quantityToBeReceived || jwItem.quantitySent;
          if (jwItem.quantityReceived >= targetQty) {
            jwItem.status = "Completed";
          } else {
            jwItem.status = "Partial";
          }
          foundItem = jwItem;
          break;
        }
      }

      if (foundItem) {
        if (!jobWork.receiveHistory) jobWork.receiveHistory = [];
        jobWork.receiveHistory.push({
          date: new Date(),
          itemId: itemId,
          quantity: qtyNum
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

