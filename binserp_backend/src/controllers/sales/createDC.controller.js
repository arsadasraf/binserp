import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { incomingRFQSchema, quotationSchema, incomingPOSchema, salesOrderSchema, salesOrderDispatchHistorySchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
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


export const createDC = async (req, res) => {
  try {
    const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);

    const companyId = getCompanyId(req);
    const { dcNumber, date, customer, items, status, customerPoReference } = req.body;

    console.log("Creating DC:", { dcNumber, companyId });

    if (customerPoReference) {
      const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);
      const po = await IncomingPO.findOne({ _id: customerPoReference, company: companyId });
      
      if (!po) {
        return res.status(404).json({ message: "Customer PO not found" });
      }

      // Validate quantities
      for (const dcItem of items) {
        // Find matching item in PO (assuming matching by productName for now, since DC might not store fgItem id)
        const poItem = po.items.find(i => i.productName === dcItem.materialName || i.fgItem?.toString() === dcItem.material?.toString());
        if (poItem) {
          const remainingQty = poItem.quantity - (poItem.dispatchedQuantity || 0);
          if (dcItem.quantity > remainingQty) {
            return res.status(400).json({ 
              message: `Cannot dispatch more than PO quantity for item: ${poItem.productName}. Remaining: ${remainingQty}, Requested: ${dcItem.quantity}` 
            });
          }
          // Update dispatched quantity
          poItem.dispatchedQuantity = (poItem.dispatchedQuantity || 0) + Number(dcItem.quantity);
        }
      }
      await po.save();
    }

    const dc = await DeliveryChallan.create({
      company: companyId,
      dcNumber,
      date,
      customerName: req.body.customerName, // Fallback or direct
      customer,
      customerAddress: req.body.customerAddress,
      customerPoReference,
      items,
      discount: req.body.discount,
      otherDetails: req.body.otherDetails,
      status: status || 'Draft',
      preparedBy: req.user.id
    });

    res.status(201).json({ message: "DC created successfully", dc });
  } catch (error) {
    console.error("Error creating DC:", error);
    res.status(500).json({ message: error.message });
  }
};

