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


export const updateRmBoItem = async (req, res) => {
  try {
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    // Resolve Category if provided
    if (req.body.categoryId) {
      if (!isValidObjectId(req.body.categoryId)) {
        const catName = req.body.categoryId.toString().trim();
        let cat = await Category.findOne({
          company: companyId,
          $or: [
            { name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { code: catName }
          ]
        });
        if (!cat) {
          try {
            cat = await Category.create({
              company: companyId,
              name: catName,
              code: `CAT-${Math.floor(100 + Math.random() * 900)}`,
              unit: req.body.unit || 'PCS',
              description: `${catName} Category`
            });
          } catch {
            cat = await Category.findOne({ company: companyId, name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          }
        }
        if (cat) req.body.categoryId = cat._id;
      }
    }

    // Resolve Location if provided
    if (req.body.locationId) {
      if (!isValidObjectId(req.body.locationId)) {
        const locName = req.body.locationId.toString().trim();
        let loc = await Location.findOne({
          company: companyId,
          $or: [
            { name: { $regex: new RegExp(`^${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { code: locName }
          ]
        });
        if (!loc) {
          try {
            loc = await Location.create({
              company: companyId,
              name: locName,
              code: `LOC-${Math.floor(100 + Math.random() * 900)}`,
              type: 'Rack',
              description: locName
            });
          } catch {
            loc = await Location.findOne({ company: companyId, name: { $regex: new RegExp(`^${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          }
        }
        if (loc) req.body.locationId = loc._id;
      }
    }

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

