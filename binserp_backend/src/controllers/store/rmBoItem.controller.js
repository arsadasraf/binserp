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


export const createRmBoItem = async (req, res) => {
  try {
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);

    const companyId = getCompanyId(req);
    let { name, descriptions, minimumStock, categoryId, locationId, unit } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const cleanName = name.toString().trim();

    const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    // 1. Resolve or auto-create Category
    let resolvedCategoryId = null;
    let categoryUnit = unit || 'PCS';

    if (categoryId) {
      if (isValidObjectId(categoryId)) {
        const existingCat = await Category.findOne({ _id: categoryId, company: companyId });
        if (existingCat) {
          resolvedCategoryId = existingCat._id;
          categoryUnit = existingCat.unit || categoryUnit;
        }
      }
      
      if (!resolvedCategoryId) {
        const catName = categoryId.toString().trim();
        let cat = await Category.findOne({
          company: companyId,
          $or: [
            { name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { code: catName }
          ]
        });

        if (!cat) {
          const genCode = `CAT-${Math.floor(100 + Math.random() * 900)}`;
          try {
            cat = await Category.create({
              company: companyId,
              name: catName,
              code: genCode,
              unit: unit || 'PCS',
              description: `${catName} Category`
            });
          } catch {
            cat = await Category.findOne({ company: companyId, name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          }
        }

        if (cat) {
          resolvedCategoryId = cat._id;
          categoryUnit = cat.unit || categoryUnit;
        }
      }
    }

    if (!resolvedCategoryId) {
      let defaultCat = await Category.findOne({ company: companyId, name: { $regex: /^Raw Material$/i } });
      if (!defaultCat) {
        defaultCat = await Category.findOne({ company: companyId });
      }
      if (!defaultCat) {
        defaultCat = await Category.create({
          company: companyId,
          name: 'Raw Material',
          code: 'CAT-RM',
          unit: 'PCS',
          description: 'Default Raw Material Category'
        });
      }
      resolvedCategoryId = defaultCat._id;
      categoryUnit = defaultCat.unit || categoryUnit;
    }

    // 2. Resolve or auto-create Location (optional)
    let resolvedLocationId = undefined;
    if (locationId) {
      if (isValidObjectId(locationId)) {
        const existingLoc = await Location.findOne({ _id: locationId, company: companyId });
        if (existingLoc) resolvedLocationId = existingLoc._id;
      }

      if (!resolvedLocationId && locationId.toString().trim()) {
        const locName = locationId.toString().trim();
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
        if (loc) resolvedLocationId = loc._id;
      }
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

    const rmBoItem = await RmBoItem.create({ 
      name: cleanName, 
      descriptions: descriptions || '', 
      minimumStock: Number(minimumStock || 0), 
      categoryId: resolvedCategoryId, 
      ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}), 
      photos: photoUrls, 
      company: companyId 
    });

    // Also ensure Inventory record exists
    try {
      const matCode = `RM-${Math.floor(10000 + Math.random() * 90000)}`;
      await Inventory.findOneAndUpdate(
        { company: companyId, materialId: rmBoItem._id },
        {
          $setOnInsert: {
            company: companyId,
            materialCode: matCode,
            materialName: cleanName,
            unit: categoryUnit,
            currentStock: 0,
            reorderLevel: Number(minimumStock || 0),
            reorderQuantity: 0,
            materialId: rmBoItem._id,
            ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
            ...(resolvedLocationId ? { locationId: resolvedLocationId } : {})
          }
        },
        { upsert: true, new: true }
      );
    } catch (invErr) {
      console.error("Inventory sync error on rmBoItem create:", invErr);
    }

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

