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


import { salesOrderSchema } from "../../models/sales/index.js";

export const getAllMaterialRequests = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
    req.getModel('SalesOrder', salesOrderSchema);

    const companyId = getCompanyId(req);
    const { status, department, type, requestedBy, startDate, endDate } = req.query;

    const query = { company: companyId };
    if (status && status !== 'All') query.status = status;
    if (department && department !== 'All') query.department = department;
    if (requestedBy && requestedBy !== 'All') query.requestedBy = requestedBy;

    if (type && type !== 'All') {
      const t = type.toLowerCase();
      if (t === 'rm' || t === 'raw-material') {
        query.type = { $in: ['rm', 'raw-material'] };
      } else if (t === 'bo' || t === 'bought-out') {
        query.type = { $in: ['bo', 'bought-out'] };
      } else if (t === 'fg' || t === 'inhouse') {
        query.type = { $in: ['fg', 'inhouse'] };
      } else if (t === 'consumable') {
        query.type = 'consumable';
      } else {
        query.type = type;
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const materialRequests = await MaterialRequest.find(query)
      .populate("requestedBy", "name userId department email")
      .populate("approvedBy", "name userId department")
      .populate("issuedBy", "name userId department")
      .populate("salesOrder", "orderNumber status customer poReference")
      .lean()
      .sort({ createdAt: -1 });

    const formattedRequests = materialRequests.map((reqItem) => {
      if (!reqItem.requestedBy && (reqItem.createdBy || reqItem.createdByName)) {
        reqItem.requestedBy = {
          _id: reqItem.createdBy,
          id: reqItem.createdBy,
          name: reqItem.createdByName || 'User',
          userId: reqItem.createdBy,
          department: reqItem.department || 'Store'
        };
      }
      return reqItem;
    });

    res.status(200).json({
      materialRequests: formattedRequests,
      count: formattedRequests.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Material Request (Approve/Reject/Issue)
