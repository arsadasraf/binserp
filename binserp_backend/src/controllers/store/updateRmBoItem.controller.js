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


export const updateRmBoItem = async (req, res) => {
  try {
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    let existingPhotos = [];
    if (req.body.photos) {
      if (Array.isArray(req.body.photos)) {
        existingPhotos = req.body.photos;
      } else {
        existingPhotos = [req.body.photos];
      }
    }

    const newPhotoUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          const uploadResult = await uploadOnS3(file.path, "rm-bo-items/photos", companyId);
          if (uploadResult) {
            newPhotoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
      }
    }

    const finalPhotos = [...existingPhotos, ...newPhotoUrls];

    if (finalPhotos.length > 2) {
      return res.status(400).json({ message: "Maximum 2 photos allowed" });
    }
    
    req.body.photos = finalPhotos;

    const rmBoItem = await RmBoItem.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    ).populate(['categoryId', 'locationId']);
    if (!rmBoItem) return res.status(404).json({ message: "RM/BO Item not found" });
    res.status(200).json({ message: "RM/BO Item updated successfully", rmBoItem });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Item name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

