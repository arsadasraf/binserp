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


export const getAllDCs = async (req, res) => {
  try {
    req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Customer', customerSchema);
    const DeliveryChallan = req.getModel('DeliveryChallan', deliveryChallanSchema);

    const companyId = getCompanyId(req);
    console.log("Fetching DCs for company:", companyId);

    const dcs = await DeliveryChallan.find({ company: companyId })
      .populate('items.material')
      .populate('customer')
      .populate('createdBy', 'name email username')
      .populate('updatedBy', 'name email username')
      .populate('preparedBy', 'name email username')
      .sort({ createdAt: -1 }); // Newest first

    const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);
    const poList = await IncomingPO.find({ company: companyId }, 'poNumber _id');
    const poMap = new Map();
    poList.forEach(p => poMap.set(p._id.toString(), p.poNumber));

    const formattedDcs = dcs.map(dc => {
      const docObj = dc.toObject ? dc.toObject() : { ...dc };
      if (docObj.customerPoReference && mongoose.Types.ObjectId.isValid(docObj.customerPoReference)) {
        const resolvedPoNumber = poMap.get(docObj.customerPoReference.toString());
        if (resolvedPoNumber) {
          docObj.customerPoReference = resolvedPoNumber;
        }
      }
      return docObj;
    });

    console.log(`Found ${dcs.length} DCs`);

    res.status(200).json({ data: formattedDcs, count: formattedDcs.length });
  } catch (error) {
    console.error("Error fetching DCs:", error);
    res.status(500).json({ message: error.message });
  }
};

