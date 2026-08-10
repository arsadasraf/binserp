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


export const createInvoice = async (req, res) => {
  try {
    const Invoice = req.getModel('Invoice', invoiceSchema);

    const companyId = getCompanyId(req);
    console.log("Creating Invoice:", req.body.invoiceNumber);

    let { customerPoReference, items, customer } = req.body;

    // Clean empty string ObjectIds to prevent Mongoose CastErrors
    if (!customerPoReference || customerPoReference === "" || !mongoose.Types.ObjectId.isValid(customerPoReference)) {
      customerPoReference = undefined;
      req.body.customerPoReference = undefined;
    }

    if (!customer || customer === "" || !mongoose.Types.ObjectId.isValid(customer)) {
      req.body.customer = undefined;
    }

    // Clean items payload
    if (Array.isArray(items)) {
      req.body.items = items.map(item => {
        const cleaned = { ...item };
        if (!cleaned.material || cleaned.material === "" || !mongoose.Types.ObjectId.isValid(cleaned.material)) delete cleaned.material;
        if (!cleaned.component || cleaned.component === "" || !mongoose.Types.ObjectId.isValid(cleaned.component)) delete cleaned.component;
        if (!cleaned.fgItem || cleaned.fgItem === "" || !mongoose.Types.ObjectId.isValid(cleaned.fgItem)) delete cleaned.fgItem;
        return cleaned;
      });
    }

    if (customerPoReference) {
      const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);
      const po = await IncomingPO.findOne({ _id: customerPoReference, company: companyId });
      
      if (po && Array.isArray(items)) {
        // Validate quantities
        for (const invoiceItem of items) {
          const poItem = po.items.find(i => i.productName === invoiceItem.materialName || (invoiceItem.fgItem && i.fgItem?.toString() === invoiceItem.fgItem.toString()));
          if (poItem) {
            const remainingQty = poItem.quantity - (poItem.billedQuantity || 0);
            if (invoiceItem.quantity > remainingQty) {
              return res.status(400).json({ 
                message: `Cannot bill more than PO quantity for item: ${poItem.productName}. Remaining: ${remainingQty}, Requested: ${invoiceItem.quantity}` 
              });
            }
            // Update billed quantity
            poItem.billedQuantity = (poItem.billedQuantity || 0) + Number(invoiceItem.quantity);
          }
        }
        await po.save();
      }
    }

    const invoice = await Invoice.create({
      company: companyId,
      ...req.body,
      preparedBy: req.user?.id || req.user?._id
    });
    res.status(201).json({ message: "Invoice created successfully", invoice });
  } catch (error) {
    console.error("Error creating Invoice:", error);
    res.status(500).json({ message: error.message || "Failed to create Invoice" });
  }
};

