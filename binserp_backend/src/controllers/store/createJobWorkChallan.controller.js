import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, fgItemSchema, rmInventoryMonthlySchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { updateInventoryStock } from './updateInventoryStock.controller.js';
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


export const createJobWorkChallan = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
    const Material = req.getModel("RmBoItem", rmBoItemSchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);

    const companyId = getCompanyId(req);
    let {
      challanNumber,
      vendor,
      date,
      expectedReturnDate,
      poNumber,
      vehicleNo,
      freightType,
      ewayBillNo,
      estimatedWeight,
      estimatedPrice,
      items
    } = req.body;

    // Validate Input
    if (!vendor || !items || items.length === 0) {
      return res.status(400).json({ message: "Vendor and items are required" });
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

    // Helper to check valid Mongoose ObjectId
    const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(val);

    // Process Items and Update Source Stock
    const processedItems = [];
    for (const item of items) {
      const {
        item: itemId,
        itemType,
        quantitySent,
        processType,
        unit,
        unitPrice,
        description,
        receivedItem: receivedItemId,
        receivedItemName,
        receivedItemType,
        quantityToBeReceived,
        receivingUnit
      } = item;

      // 1. Validate Stock & Fetch Sent Item Name
      let itemName = item.itemName || "";
      let validItemId = isValidObjectId(itemId) ? itemId : null;
      
      if (itemType === "bo" && validItemId) {
        const materialDoc = await Material.findById(validItemId);
        if (materialDoc) itemName = materialDoc.name;
      } else if (itemType === "custom") {
        itemName = item.itemName || "Custom Item";
        validItemId = null;
      } else if ((itemType === "inhouse" || itemType === "fg") && validItemId) {
        const fgDoc = await FGItem.findById(validItemId);
        if (fgDoc) itemName = fgDoc.name || fgDoc.componentName;
      }

      if (!itemName) {
        itemName = item.itemName || "Sent Item";
      }

      // 2. Fetch Returning Items (Multiple per Sent Item)
      const processedReturningItems = [];
      if (Array.isArray(item.returningItems) && item.returningItems.length > 0) {
        for (const ret of item.returningItems) {
          let retId = isValidObjectId(ret.receivedItem) ? ret.receivedItem : null;
          let retName = ret.receivedItemName || ret.itemName || "";
          const retType = ret.receivedItemType || "fg";

          if (retType === "bo" && retId) {
            const retMat = await Material.findById(retId);
            if (retMat) retName = retMat.name;
          } else if ((retType === "inhouse" || retType === "fg") && retId) {
            const retFg = await FGItem.findById(retId);
            if (retFg) retName = retFg.name || retFg.componentName;
          }

          const finalRetName = retName || itemName || "Returning Material";

          const retDoc = {
            receivedItemName: finalRetName,
            receivedItemType: retType,
            quantityToBeReceived: Number(ret.quantityToBeReceived) || 1,
            quantityReceived: 0,
            receivingUnit: ret.receivingUnit || "PCS",
            status: "Sent"
          };

          if (retId) {
            retDoc.receivedItem = retId;
          }

          processedReturningItems.push(retDoc);
        }
      } else {
        // Fallback for single returning item
        let validReceivedItemId = isValidObjectId(receivedItemId) ? receivedItemId : null;
        let finalReceivedItemName = receivedItemName || item.itemToBeReceived || itemName;

        if (receivedItemType === "bo" && validReceivedItemId) {
          const retMat = await Material.findById(validReceivedItemId);
          if (retMat) finalReceivedItemName = retMat.name;
        } else if ((receivedItemType === "inhouse" || receivedItemType === "fg") && validReceivedItemId) {
          const retFg = await FGItem.findById(validReceivedItemId);
          if (retFg) finalReceivedItemName = retFg.name || retFg.componentName;
        }

        const retDoc = {
          receivedItemName: finalReceivedItemName || itemName || "Returning Material",
          receivedItemType: receivedItemType || "fg",
          quantityToBeReceived: Number(quantityToBeReceived) || Number(quantitySent) || 1,
          quantityReceived: 0,
          receivingUnit: receivingUnit || unit || "PCS",
          status: "Sent"
        };

        if (validReceivedItemId) {
          retDoc.receivedItem = validReceivedItemId;
        }

        processedReturningItems.push(retDoc);
      }

      const firstReturn = processedReturningItems[0] || {};

      const processedItem = {
        itemName,
        itemType: itemType || "custom",
        processType: processType || "Job Work",
        quantitySent: Number(quantitySent) || 0,
        quantityReceived: 0,
        unit: unit || "PCS",
        unitPrice: Number(unitPrice) || 0,
        description: description || "",
        returningItems: processedReturningItems,
        // Legacy fallbacks
        itemToBeReceived: firstReturn.receivedItemName || itemName,
        receivedItemName: firstReturn.receivedItemName || itemName,
        receivedItemType: firstReturn.receivedItemType || "fg",
        quantityToBeReceived: firstReturn.quantityToBeReceived || Number(quantitySent) || 0,
        receivingUnit: firstReturn.receivingUnit || unit || "PCS",
        status: "Sent",
      };

      if (validItemId) {
        processedItem.item = validItemId;
      }
      if (firstReturn && firstReturn.receivedItem) {
        processedItem.receivedItem = firstReturn.receivedItem;
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
      poNumber: poNumber || "",
      vehicleNo: vehicleNo || "",
      freightType: freightType || "To pay",
      ewayBillNo: ewayBillNo || "",
      estimatedWeight: Number(estimatedWeight) || 0,
      estimatedPrice: Number(estimatedPrice) || 0,
      status: "Open",
      items: processedItems,
      createdBy: req.user.id
    });

    // Update inventory for RM/BO items (outward transition)
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);

    for (const item of processedItems) {
      if (item.itemType === "bo" && item.item) {
        // Decrease current stock
        await updateInventoryStock(
          req,
          item.item, // material ID
          -Number(item.quantitySent), // Negative to decrement stock
          item.unit || "PCS"
        );
        
        // Update Monthly Outward Flow
        try {
          await RMInventoryMonthly.findOneAndUpdate(
            { company: companyId, material: item.item, month: currentMonthStr },
            { $inc: { totalOutwardQuantity: Number(item.quantitySent) } },
            { new: true, upsert: true }
          );
        } catch (monthlyErr) {
          console.error("Error updating RM monthly outward quantity for Job Work:", monthlyErr);
        }
      }
    }

    await jobWork.populate("vendor");

    res.status(201).json({ message: "Job Work Challan created successfully", jobWork });

  } catch (error) {
    console.error("Create JobWork Error:", error);
    res.status(500).json({ message: error.message });
  }
};

