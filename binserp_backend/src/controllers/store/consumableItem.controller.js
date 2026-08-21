import mongoose from "mongoose";
import {
  consumableItemSchema,
  categorySchema,
  locationSchema,
  inventorySchema,
} from "../../models/store/index.js";
import { uploadOnS3 } from "../../utils/s3.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

// ========== Create Consumable Item ==========
export const createConsumableItem = async (req, res) => {
  try {
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);

    const companyId = getCompanyId(req);
    let { name, descriptions, minimumStock, categoryId, locationId, unit } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const cleanName = name.toString().trim();

    // 1. Resolve or auto-create Category
    let resolvedCategoryId = null;
    let categoryUnit = unit || 'PCS';

    if (categoryId && categoryId.toString().trim() && categoryId !== 'Select Category' && categoryId !== 'null' && categoryId !== 'undefined') {
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
      let defaultCat = await Category.findOne({
        company: companyId,
        name: { $regex: /^Consumables?$/i }
      });
      if (!defaultCat) {
        defaultCat = await Category.findOne({ company: companyId });
      }
      if (!defaultCat) {
        defaultCat = await Category.create({
          company: companyId,
          name: 'Consumables',
          code: 'CAT-CON',
          unit: 'PCS',
          description: 'Default Consumables Category'
        });
      }
      resolvedCategoryId = defaultCat._id;
      categoryUnit = defaultCat.unit || categoryUnit;
    }

    // 2. Resolve or auto-create Location (optional)
    let resolvedLocationId = undefined;
    if (locationId && locationId.toString().trim() && locationId !== 'Select Location' && locationId !== 'null' && locationId !== 'undefined') {
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

    // 3. Handle photo uploads
    const photoUrls = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 2) {
        return res.status(400).json({ message: "Maximum 2 photos allowed" });
      }
      try {
        for (const file of req.files) {
          const uploadResult = await uploadOnS3(file.path, "consumables/photos", companyId);
          if (uploadResult) {
            photoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
      }
    }

    const consumableItem = await ConsumableItem.create({
      name: cleanName,
      descriptions: descriptions || '',
      minimumStock: Number(minimumStock || 0),
      categoryId: resolvedCategoryId,
      unit: unit || categoryUnit || 'PCS',
      ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
      photos: photoUrls,
      company: companyId,
    });

    // Ensure Inventory entry exists
    try {
      const matCode = `CON-${Math.floor(10000 + Math.random() * 90000)}`;
      await Inventory.findOneAndUpdate(
        { company: companyId, materialId: consumableItem._id },
        {
          $setOnInsert: {
            company: companyId,
            materialId: consumableItem._id,
            materialName: cleanName,
            materialCode: matCode,
            unit: unit || categoryUnit || 'PCS',
            currentStock: 0,
            reorderLevel: Number(minimumStock || 0),
            categoryId: resolvedCategoryId,
            ...(resolvedLocationId ? { locationId: resolvedLocationId } : {})
          }
        },
        { upsert: true, new: true }
      );
    } catch (invErr) {
      console.warn("Auto inventory create skipped:", invErr.message);
    }

    const populated = await ConsumableItem.findById(consumableItem._id).populate(['categoryId', 'locationId']);
    res.status(201).json({ message: "Consumable Item created successfully", consumableItem: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Consumable Item name already exists" });
    }
    console.error("Create Consumable Error:", error);
    res.status(500).json({ message: error.message || "Failed to create Consumable Item" });
  }
};

// ========== Get All Consumable Items ==========
export const getAllConsumableItems = async (req, res) => {
  try {
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    req.getModel('Category', categorySchema);
    req.getModel('Location', locationSchema);
    const companyId = getCompanyId(req);

    const consumableItems = await ConsumableItem.find({ company: companyId })
      .populate('categoryId')
      .populate('locationId')
      .sort({ name: 1 });

    res.status(200).json({ consumableItems, count: consumableItems.length });
  } catch (error) {
    console.error("Get Consumables Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ========== Update Consumable Item ==========
export const updateConsumableItem = async (req, res) => {
  try {
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    // Resolve Category if provided
    if (req.body.categoryId) {
      if (!isValidObjectId(req.body.categoryId)) {
        const catName = req.body.categoryId.toString().trim();
        if (catName && catName !== 'Select Category' && catName !== 'null' && catName !== 'undefined') {
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
          else delete req.body.categoryId;
        } else {
          delete req.body.categoryId;
        }
      }
    } else {
      delete req.body.categoryId;
    }

    // Resolve Location if provided
    if (req.body.locationId) {
      if (!isValidObjectId(req.body.locationId)) {
        const locName = req.body.locationId.toString().trim();
        if (locName && locName !== 'Select Location' && locName !== 'null' && locName !== 'undefined') {
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
          else delete req.body.locationId;
        } else {
          delete req.body.locationId;
        }
      }
    } else {
      delete req.body.locationId;
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
          const uploadResult = await uploadOnS3(file.path, "consumables/photos", companyId);
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

    const consumableItem = await ConsumableItem.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    ).populate(['categoryId', 'locationId']);

    if (!consumableItem) return res.status(404).json({ message: "Consumable Item not found" });
    res.status(200).json({ message: "Consumable Item updated successfully", consumableItem });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Item name already exists" });
    }
    console.error("Update Consumable Error:", error);
    res.status(500).json({ message: error.message || "Failed to update Consumable Item" });
  }
};

// ========== Delete Consumable Item ==========
export const deleteConsumableItem = async (req, res) => {
  try {
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const consumableItem = await ConsumableItem.findOneAndDelete({ _id: id, company: companyId });
    if (!consumableItem) return res.status(404).json({ message: "Consumable Item not found" });

    res.status(200).json({ message: "Consumable Item deleted successfully" });
  } catch (error) {
    console.error("Delete Consumable Error:", error);
    res.status(500).json({ message: error.message });
  }
};
