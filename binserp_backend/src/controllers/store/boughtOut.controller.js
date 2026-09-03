import mongoose from "mongoose";
import { boughtOutSchema, categorySchema, locationSchema, inventorySchema, rmBoItemSchema } from "../../models/store/index.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { validateMasterUniqueness, formatDuplicateKeyError } from "../../utils/duplicateValidator.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

/**
 * Create a new Bought Out (BO) item
 */
export const createBoughtOut = async (req, res) => {
  try {
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);

    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { name, code, descriptions, minimumStock, categoryId, locationId, unit } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Bought Out Item Name is required" });
    }
    const cleanName = name.toString().trim();

    // Pre-validate uniqueness
    const uniqueness = await validateMasterUniqueness({
      Model: BoughtOut,
      companyId,
      name: cleanName,
      code,
      masterLabel: "Bought Out Item"
    });
    if (uniqueness.isDuplicate) {
      return res.status(400).json({ message: uniqueness.message });
    }

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
              description: `${catName} Category`,
              createdBy: userId,
              createdByName: userName,
              updatedBy: userId,
              updatedByName: userName
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
      let defaultCat = await Category.findOne({ company: companyId, name: { $regex: /^Bought Out$/i } });
      if (!defaultCat) {
        defaultCat = await Category.findOne({ company: companyId });
      }
      if (!defaultCat) {
        defaultCat = await Category.create({
          company: companyId,
          name: 'Bought Out',
          code: 'CAT-BO',
          unit: 'PCS',
          description: 'Default Bought Out Category',
          createdBy: userId,
          createdByName: userName,
          updatedBy: userId,
          updatedByName: userName
        });
      }
      resolvedCategoryId = defaultCat._id;
      categoryUnit = defaultCat.unit || categoryUnit;
    }

    // 2. Resolve or auto-create Location
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
              description: locName,
              createdBy: userId,
              createdByName: userName,
              updatedBy: userId,
              updatedByName: userName
            });
          } catch {
            loc = await Location.findOne({ company: companyId, name: { $regex: new RegExp(`^${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          }
        }
        if (loc) resolvedLocationId = loc._id;
      }
    }

    // Photo uploads
    const photoUrls = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 2) {
        return res.status(400).json({ message: "Maximum 2 photos allowed" });
      }
      try {
        for (const file of req.files) {
          const uploadResult = await uploadOnS3(file.path, "bought-out/photos", companyId);
          if (uploadResult) {
            photoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
      }
    }

    const generatedCode = code ? code.toString().trim() : `BO-${Math.floor(10000 + Math.random() * 90000)}`;

    const boughtOut = await BoughtOut.create({
      company: companyId,
      name: cleanName,
      code: generatedCode,
      descriptions: descriptions || '',
      minimumStock: Number(minimumStock || 0),
      categoryId: resolvedCategoryId,
      ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
      photos: photoUrls,
      createdBy: userId,
      createdByName: userName,
      updatedBy: userId,
      updatedByName: userName
    });

    // Also sync to legacy RmBoItem for foreign keys compatibility
    try {
      await RmBoItem.findOneAndUpdate(
        { _id: boughtOut._id },
        {
          $set: {
            company: companyId,
            name: cleanName,
            itemType: 'Bought Out',
            descriptions: descriptions || '',
            minimumStock: Number(minimumStock || 0),
            categoryId: resolvedCategoryId,
            ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
            photos: photoUrls,
            createdBy: userId,
            createdByName: userName,
            updatedBy: userId,
            updatedByName: userName
          }
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error("RmBoItem backward compatibility sync error:", e);
    }

    // Sync Inventory Record
    try {
      await Inventory.findOneAndUpdate(
        { company: companyId, materialId: boughtOut._id },
        {
          $setOnInsert: {
            company: companyId,
            materialCode: generatedCode,
            materialName: cleanName,
            itemType: 'Bought Out',
            unit: categoryUnit,
            currentStock: 0,
            reorderLevel: Number(minimumStock || 0),
            reorderQuantity: 0,
            materialId: boughtOut._id,
            ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
            ...(resolvedLocationId ? { locationId: resolvedLocationId } : {})
          }
        },
        { upsert: true, new: true }
      );
    } catch (invErr) {
      console.error("Inventory sync error on boughtOut create:", invErr);
    }

    await boughtOut.populate(['categoryId', 'locationId']);
    res.status(201).json({ message: "Bought Out Item created successfully", boughtOut, rmBoItem: boughtOut });
  } catch (error) {
    console.error("Create Bought Out Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "Bought Out Item", cleanName: req.body?.name })
      });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all Bought Out (BO) items
 */
export const getAllBoughtOuts = async (req, res) => {
  try {
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Category', categorySchema);
    req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    
    // Fetch from BoughtOut collection
    let boughtOuts = await BoughtOut.find({ company: companyId })
      .populate('categoryId')
      .populate('locationId')
      .sort({ name: 1 });

    // Fallback if BoughtOut is empty: fetch from legacy RmBoItem where itemType === 'Bought Out'
    if (boughtOuts.length === 0) {
      const legacyItems = await RmBoItem.find({
        company: companyId,
        $or: [
          { itemType: 'Bought Out' },
          { itemType: 'BO' },
          { itemType: 'bought-out' }
        ]
      })
        .populate('categoryId')
        .populate('locationId')
        .sort({ name: 1 });

      if (legacyItems.length > 0) {
        boughtOuts = legacyItems;
      }
    }

    const Inventory = req.getModel('Inventory', inventorySchema);
    const inventories = await Inventory.find({ company: companyId });
    const invMap = new Map();
    inventories.forEach(inv => {
      if (inv.materialId) invMap.set(String(inv.materialId), inv);
      if (inv.materialCode) invMap.set(String(inv.materialCode), inv);
    });

    const enriched = boughtOuts.map(bo => {
      const boObj = bo.toObject ? bo.toObject() : { ...bo };
      const inv = invMap.get(String(boObj._id)) || invMap.get(String(boObj.code));
      const stock = inv ? Number(inv.currentStock || 0) : Number(boObj.quantity || 0);
      const qcStock = inv ? Number(inv.qcPendingStock || 0) : 0;
      const hasTransactions = stock > 0 || qcStock > 0 || Boolean(boObj.hasTransactions);
      return {
        ...boObj,
        quantity: stock,
        currentStock: stock,
        qcPendingStock: qcStock,
        hasTransactions,
        status: boObj.status || (boObj.isActive === false ? 'Inactive' : 'Active'),
        isActive: boObj.isActive !== false && boObj.status !== 'Inactive' && boObj.status !== 'Deactivated'
      };
    });

    res.status(200).json({ boughtOuts: enriched, rmBoItems: enriched, count: enriched.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get Bought Out item by ID
 */
export const getBoughtOutById = async (req, res) => {
  try {
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Category', categorySchema);
    req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    let item = await BoughtOut.findOne({ _id: id, company: companyId })
      .populate('categoryId')
      .populate('locationId');

    if (!item) {
      item = await RmBoItem.findOne({ _id: id, company: companyId })
        .populate('categoryId')
        .populate('locationId');
    }

    if (!item) {
      return res.status(404).json({ message: "Bought Out Item not found" });
    }

    res.status(200).json({ boughtOut: item, rmBoItem: item });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update Bought Out item
 */
export const updateBoughtOut = async (req, res) => {
  try {
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    // Resolve Category if string
    if (req.body.categoryId && !isValidObjectId(req.body.categoryId)) {
      const catName = req.body.categoryId.toString().trim();
      let cat = await Category.findOne({
        company: companyId,
        $or: [
          { name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { code: catName }
        ]
      });
      if (!cat) {
        cat = await Category.create({
          company: companyId,
          name: catName,
          code: `CAT-${Math.floor(100 + Math.random() * 900)}`,
          unit: req.body.unit || 'PCS',
          description: `${catName} Category`
        });
      }
      req.body.categoryId = cat._id;
    }

    // Resolve Location if string
    if (req.body.locationId && !isValidObjectId(req.body.locationId)) {
      const locName = req.body.locationId.toString().trim();
      let loc = await Location.findOne({
        company: companyId,
        $or: [
          { name: { $regex: new RegExp(`^${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { code: locName }
        ]
      });
      if (!loc) {
        loc = await Location.create({
          company: companyId,
          name: locName,
          code: `LOC-${Math.floor(100 + Math.random() * 900)}`,
          type: 'Rack',
          description: locName
        });
      }
      req.body.locationId = loc._id;
    }

    // Handle Photos
    let existingPhotos = [];
    if (req.body.existingPhotos) {
      existingPhotos = Array.isArray(req.body.existingPhotos) ? req.body.existingPhotos : [req.body.existingPhotos];
    } else if (req.body.photos && typeof req.body.photos === 'string') {
      existingPhotos = [req.body.photos];
    }

    const newPhotoUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await uploadOnS3(file.path, "bought-out/photos", companyId);
        if (uploadResult) newPhotoUrls.push(uploadResult.secure_url);
      }
    }

    const finalPhotos = [...existingPhotos, ...newPhotoUrls];
    if (finalPhotos.length > 2) {
      return res.status(400).json({ message: "Maximum 2 photos allowed" });
    }
    req.body.photos = finalPhotos;

    const { userId, userName } = getUserAudit(req);
    req.body.updatedBy = userId;
    req.body.updatedByName = userName;

    // Pre-validate uniqueness if name or code is being updated
    if (req.body.name || req.body.code) {
      const uniqueness = await validateMasterUniqueness({
        Model: BoughtOut,
        companyId,
        excludeId: id,
        name: req.body.name,
        code: req.body.code,
        masterLabel: "Bought Out Item"
      });
      if (uniqueness.isDuplicate) {
        return res.status(400).json({ message: uniqueness.message });
      }
    }

    let boughtOut = await BoughtOut.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: req.body },
      { new: true }
    ).populate(['categoryId', 'locationId']);

    if (!boughtOut) {
      // Try updating legacy RmBoItem
      boughtOut = await RmBoItem.findOneAndUpdate(
        { _id: id, company: companyId },
        { $set: { ...req.body, itemType: 'Bought Out' } },
        { new: true }
      ).populate(['categoryId', 'locationId']);
    }

    if (!boughtOut) return res.status(404).json({ message: "Bought Out Item not found" });

    // Sync to legacy RmBoItem
    await RmBoItem.findOneAndUpdate(
      { _id: id },
      { $set: { ...req.body, itemType: 'Bought Out' } },
      { upsert: true }
    );

    res.status(200).json({ message: "Bought Out Item updated successfully", boughtOut, rmBoItem: boughtOut });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "Bought Out Item", cleanName: req.body?.name })
      });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete Bought Out item
 */
export const deleteBoughtOut = async (req, res) => {
  try {
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const inv = await Inventory.findOne({ materialId: id, company: companyId });
    if (inv && (inv.currentStock > 0 || inv.qcPendingStock > 0)) {
      return res.status(400).json({ 
        message: `Cannot delete "${inv.materialName}": It has active store stock of ${inv.currentStock} ${inv.unit}. Please issue or transfer the stock first.` 
      });
    }

    await BoughtOut.findOneAndDelete({ _id: id, company: companyId });
    await RmBoItem.findOneAndDelete({ _id: id, company: companyId });
    await Inventory.findOneAndDelete({ materialId: id, company: companyId });

    res.status(200).json({ message: "Bought Out Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
