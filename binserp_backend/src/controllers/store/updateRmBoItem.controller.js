import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, rawMaterialSchema, boughtOutSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { resolveBackendUomRatios } from "../../utils/dualUomHelper.js";
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
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const currentDoc = await RmBoItem.findOne({ _id: id, company: companyId }).lean()
      || await RawMaterial.findOne({ _id: id, company: companyId }).lean()
      || await BoughtOut.findOne({ _id: id, company: companyId }).lean();

    const isDualUomUpdate = (
      req.body.hasSecondaryUnit !== undefined ||
      req.body.conversionFactor !== undefined ||
      req.body.primaryRatio !== undefined ||
      req.body.secondaryRatio !== undefined ||
      req.body.secondaryUnit !== undefined
    );

    if (isDualUomUpdate) {
      const mergedUomItem = {
        hasSecondaryUnit: req.body.hasSecondaryUnit !== undefined ? req.body.hasSecondaryUnit : currentDoc?.hasSecondaryUnit,
        secondaryUnit: req.body.secondaryUnit !== undefined ? req.body.secondaryUnit : currentDoc?.secondaryUnit,
        conversionFactor: req.body.conversionFactor !== undefined ? req.body.conversionFactor : currentDoc?.conversionFactor,
        primaryRatio: req.body.primaryRatio !== undefined ? req.body.primaryRatio : currentDoc?.primaryRatio,
        secondaryRatio: req.body.secondaryRatio !== undefined ? req.body.secondaryRatio : currentDoc?.secondaryRatio,
        unit: req.body.unit !== undefined ? req.body.unit : currentDoc?.unit,
      };
      const uomRatios = resolveBackendUomRatios(mergedUomItem);
      req.body.hasSecondaryUnit = uomRatios.hasSecondaryUnit;
      req.body.secondaryUnit = uomRatios.secondaryUnit;
      req.body.conversionFactor = uomRatios.conversionFactor;
      req.body.primaryRatio = uomRatios.primaryRatio;
      req.body.secondaryRatio = uomRatios.secondaryRatio;
    }

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

    // Sync to RawMaterial or BoughtOut if they exist
    try {
      await RawMaterial.findOneAndUpdate({ _id: id, company: companyId }, { $set: req.body });
      await BoughtOut.findOneAndUpdate({ _id: id, company: companyId }, { $set: req.body });
    } catch (syncErr) {
      console.warn("Sync to RM/BO error in updateRmBoItem:", syncErr.message);
    }

    // Sync to Inventory
    try {
      const invUpdates = {};
      if (req.body.unit) invUpdates.unit = req.body.unit.toString().trim();
      if (req.body.name) invUpdates.materialName = req.body.name.toString().trim();
      if (req.body.minimumStock !== undefined) invUpdates.reorderLevel = Number(req.body.minimumStock);
      if (isDualUomUpdate || req.body.hasSecondaryUnit !== undefined) {
        invUpdates.hasSecondaryUnit = rmBoItem.hasSecondaryUnit;
        invUpdates.secondaryUnit = rmBoItem.secondaryUnit;
        invUpdates.conversionFactor = rmBoItem.conversionFactor;
        invUpdates.primaryRatio = rmBoItem.primaryRatio;
        invUpdates.secondaryRatio = rmBoItem.secondaryRatio;
      }

      if (Object.keys(invUpdates).length > 0) {
        const idMatches = [{ materialId: id }];
        if (mongoose.Types.ObjectId.isValid(id)) {
          idMatches.push({ materialId: new mongoose.Types.ObjectId(id) });
        }
        if (rmBoItem.code) {
          idMatches.push({ materialCode: rmBoItem.code });
        }
        if (rmBoItem.name) {
          idMatches.push({ materialName: rmBoItem.name });
        }
        if (currentDoc?.name && currentDoc.name !== rmBoItem.name) {
          idMatches.push({ materialName: currentDoc.name });
        }

        await Inventory.updateMany(
          { company: companyId, $or: idMatches },
          { $set: invUpdates }
        );
      }
    } catch (invErr) {
      console.warn("Inventory sync error in updateRmBoItem:", invErr.message);
    }

    res.status(200).json({ message: "RM/BO Item updated successfully", rmBoItem });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Item name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

