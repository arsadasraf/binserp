import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
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


export const createRmBoItem = async (req, res) => {
  try {
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);

    const companyId = getCompanyId(req);
    let { name, descriptions, minimumStock, categoryId, locationId } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!categoryId) {
      return res.status(400).json({ message: "Category is required" });
    }

    // Handle photo uploads if provided
    const photoUrls = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 2) {
        return res.status(400).json({ message: "Maximum 2 photos allowed" });
      }
      try {
        for (const file of req.files) {
          const uploadResult = await uploadOnS3(file.path, "rm-bo-items/photos", companyId);
          if (uploadResult) {
            photoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
      }
    }

    /* 
      Robust check for valid ObjectId format to prevent CastErrors 
      passing straight to Mongoose
    */
    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

    if (!isValidObjectId(categoryId)) {
      return res.status(400).json({ message: "Invalid Category ID format" });
    }

    // Optional: Check locationId too if provided
    if (locationId && !isValidObjectId(locationId) && locationId !== "") {
      // If it's an empty string, let's treat it as undefined/null
      locationId = undefined;
    }

    const rmBoItem = await RmBoItem.create({ 
      name, 
      descriptions, 
      minimumStock, 
      categoryId, 
      locationId, 
      photos: photoUrls, 
      company: companyId 
    });

    // Populate category and location before sending response
    await rmBoItem.populate(['categoryId', 'locationId']);

    res.status(201).json({ message: "RM/BO Item created successfully", rmBoItem });
  } catch (error) {
    console.error("Create RM/BO Item Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Item name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

