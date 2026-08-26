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
    const Inventory = req.getModel("Inventory", inventorySchema);

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
      jobWorkType = "store-conversion",
      mrpPlan,
      mrpNumber,
      routeCardRef,
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

    // Process Items, Check Stock & Validate Availability
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
      
      if ((itemType === "bo" || itemType === "rm") && validItemId) {
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

      // Stock Check for Store Conversion & Store-to-WIP (Main Store RM/BO)
      if (jobWorkType !== "wip-to-wip" && jobWorkType !== "route-card") {
        if ((itemType === "rm" || itemType === "bo") && validItemId) {
          const invDoc = await Inventory.findOne({
            company: companyId,
            $or: [
              { materialId: validItemId },
              { _id: validItemId }
            ]
          });

          let availStock = 0;
          if (invDoc) {
            availStock = Number(invDoc.currentStock !== undefined ? invDoc.currentStock : invDoc.quantity) || 0;
          } else {
            const matDoc = await Material.findById(validItemId);
            if (matDoc) {
              availStock = Number(matDoc.quantity !== undefined ? matDoc.quantity : matDoc.currentStock) || 0;
            }
          }

          const reqQty = Number(quantitySent) || 0;
          if (availStock <= 0) {
            return res.status(400).json({
              message: `Cannot dispatch "${itemName}": Item is OUT OF STOCK in Main Store (Available: 0 ${unit || 'PCS'}). Returnable DC cannot be created.`
            });
          }

          if (reqQty > availStock) {
            return res.status(400).json({
              message: `Cannot dispatch "${itemName}": Requested quantity (${reqQty}) exceeds available Main Store stock (${availStock} ${unit || 'PCS'}). Returnable DC cannot be created.`
            });
          }
        }
      } else if (jobWorkType === "wip-to-wip") {
        // Stock Check for WIP-to-WIP (Shopfloor Component Stock strictly, never Main FG Store)
        const Component = req.getModel("Component", componentSchema);
        const MaterialIssue = req.getModel("MaterialIssue", materialIssueSchema);
        const JobWork = req.getModel("JobWorkChallan", jobWorkSchema);
        let availWipStock = 0;

        // 1. Check Component collection
        if (validItemId || itemName) {
          const searchConditions = [];
          if (mongoose.Types.ObjectId.isValid(validItemId)) {
            searchConditions.push({ _id: validItemId });
          }
          if (itemName && itemName.trim()) {
            searchConditions.push({ componentName: new RegExp(`^${itemName.trim()}$`, "i") });
            searchConditions.push({ name: new RegExp(`^${itemName.trim()}$`, "i") });
          }

          if (searchConditions.length > 0) {
            const compDoc = await Component.findOne({
              company: companyId,
              $or: searchConditions
            });
            if (compDoc) {
              availWipStock = Math.max(availWipStock, Number(compDoc.quantity || 0));
            }
          }
        }

        // 2. Also check Store Material Issues issued to shopfloor
        try {
          const nameRegex = itemName && itemName.trim() ? new RegExp(`^${itemName.trim()}$`, "i") : null;
          const issues = await MaterialIssue.find({
            company: companyId,
            items: {
              $elemMatch: {
                $or: [
                  ...(validItemId ? [{ material: validItemId }, { fgItem: validItemId }, { component: validItemId }] : []),
                  ...(nameRegex ? [{ materialName: nameRegex }] : [])
                ]
              }
            }
          });

          let totalIssuedToShopfloor = 0;
          issues.forEach(iss => {
            (iss.items || []).forEach(it => {
              const matchesId = validItemId && (String(it.material) === String(validItemId) || String(it.fgItem) === String(validItemId) || String(it.component) === String(validItemId));
              const matchesName = nameRegex && it.materialName && nameRegex.test(it.materialName);
              if (matchesId || matchesName) {
                totalIssuedToShopfloor += Number(it.quantity || 0);
              }
            });
          });

          if (totalIssuedToShopfloor > 0) {
            const existingJobWorks = await JobWork.find({
              company: companyId,
              jobWorkType: "wip-to-wip",
              status: { $ne: "Cancelled" }
            });

            let totalDispatched = 0;
            let totalReturned = 0;
            existingJobWorks.forEach(jw => {
              (jw.items || []).forEach(it => {
                const itMatchesId = validItemId && String(it.item) === String(validItemId);
                const itMatchesName = nameRegex && it.itemName && nameRegex.test(it.itemName);
                if (itMatchesId || itMatchesName) {
                  totalDispatched += Number(it.quantitySent || 0);
                  totalReturned += Number(it.quantityReceived || 0);
                }
              });
            });

            const perpetualShopfloorStock = Math.max(0, totalIssuedToShopfloor - totalDispatched + totalReturned);
            availWipStock = Math.max(availWipStock, perpetualShopfloorStock);
          }
        } catch (calcErr) {
          console.warn("WIP stock calculation error in createJobWorkChallan:", calcErr);
        }

        const reqQty = Number(quantitySent) || 0;
        if (availWipStock <= 0) {
          return res.status(400).json({
            message: `Cannot dispatch "${itemName}": Item is OUT OF STOCK in Shopfloor WIP (Available: 0 ${unit || 'PCS'}). Returnable DC cannot be created.`
          });
        }

        if (reqQty > availWipStock) {
          return res.status(400).json({
            message: `Cannot dispatch "${itemName}": Requested quantity (${reqQty}) exceeds available Shopfloor WIP stock (${availWipStock} ${unit || 'PCS'}). Returnable DC cannot be created.`
          });
        }
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

    const Job = req.getModel("Job", jobSchema);

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
      jobWorkType,
      mrpPlan: mrpPlan || undefined,
      mrpNumber: mrpNumber || undefined,
      routeCardRef,
      status: "Open",
      items: processedItems,
      createdBy: req.user?.id || req.user?._id
    });

    // Update inventory for RM/BO items (outward transition) or PPC Route Card operation status
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);

    const vendorDoc = await req.getModel("Vendor", vendorSchema).findById(vendor);
    const vendorName = vendorDoc ? vendorDoc.name : "Subcontractor Vendor";

    if (jobWorkType === "route-card" && routeCardRef?.job) {
      try {
        const jobDoc = await Job.findById(routeCardRef.job);
        if (jobDoc && Array.isArray(jobDoc.processHistory)) {
          const op = jobDoc.processHistory.find((p) => p.sequence === routeCardRef.operationSequence || p.isJobWork);

          if (op) {
            op.status = "InProgress";
            op.isJobWork = true;
            op.assignedVendor = vendor;
            await jobDoc.save();
          }
        }
      } catch (jobErr) {
        console.error("Error updating PPC Job for route card job work challan:", jobErr);
      }
    }

    const Component = req.getModel("Component", componentSchema);

    for (const item of processedItems) {
      if (jobWorkType !== "route-card" && jobWorkType !== "wip-to-wip" && (item.itemType === "bo" || item.itemType === "rm") && item.item) {
        // Decrease current stock & log returnable DC transaction from Main Store RM/BO
        await updateInventoryStock(
          req,
          item.item, // material ID
          -Number(item.quantitySent), // Negative to decrement stock
          item.unit || "PCS",
          undefined,
          {
            transactionCategory: jobWorkType === "store-conversion" ? "RM_CONVERSION_OUTWARD" : "RETURNABLE_DC_JOB_WORK_OUTWARD",
            referenceDocType: "JobWorkChallan",
            referenceDocId: jobWork._id,
            referenceDocNumber: challanNumber,
            recipientOrSource: vendorName,
            purpose: jobWorkType === "store-conversion" ? `RM Conversion Outward Dispatch to ${vendorName} (Challan #${challanNumber})` : (item.processType || `Subcontractor Outward Dispatch (${jobWorkType})`),
            performedBy: req.user?.id || req.user?._id,
          }
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
      } else if (jobWorkType === "wip-to-wip" && item.item) {
        // Decrease WIP FG Component stock
        try {
          await Component.findByIdAndUpdate(item.item, {
            $inc: { quantity: -Number(item.quantitySent) }
          });
        } catch (compErr) {
          console.error("Error updating Component stock for WIP-to-WIP challan:", compErr);
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

