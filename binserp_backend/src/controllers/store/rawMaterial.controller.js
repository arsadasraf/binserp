import mongoose from "mongoose";
import { rawMaterialSchema, categorySchema, locationSchema, inventorySchema, rmBoItemSchema } from "../../models/store/index.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { validateMasterUniqueness, formatDuplicateKeyError } from "../../utils/duplicateValidator.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

/**
 * Create a new Raw Material (RM)
 */
export const createRawMaterial = async (req, res) => {
  try {
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);

    const companyId = getCompanyId(req);
    const { userId, userName } = getUserAudit(req);
    let { name, code, descriptions, minimumStock, categoryId, locationId, unit } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: "Raw Material Name is required" });
    }
    const cleanName = name.toString().trim();

    // Pre-validate uniqueness
    const uniqueness = await validateMasterUniqueness({
      Model: RawMaterial,
      companyId,
      name: cleanName,
      code,
      masterLabel: "Raw Material"
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
          description: 'Default Raw Material Category',
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
    let resolvedLocationId = null;
    if (locationId) {
      if (isValidObjectId(locationId)) {
        const existingLoc = await Location.findOne({ _id: locationId, company: companyId });
        if (existingLoc) resolvedLocationId = existingLoc._id;
      }

      if (!resolvedLocationId) {
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
          const uploadResult = await uploadOnS3(file.path, "raw-materials/photos", companyId);
          if (uploadResult) {
            photoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
      }
    }

    const generatedCode = code ? code.toString().trim() : `RM-${Math.floor(10000 + Math.random() * 90000)}`;

    const rawMaterial = await RawMaterial.create({
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
        { _id: rawMaterial._id },
        {
          $set: {
            company: companyId,
            name: cleanName,
            itemType: 'Raw Material',
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
        { company: companyId, materialId: rawMaterial._id },
        {
          $setOnInsert: {
            company: companyId,
            materialCode: generatedCode,
            materialName: cleanName,
            itemType: 'Raw Material',
            unit: categoryUnit,
            currentStock: 0,
            reorderLevel: Number(minimumStock || 0),
            reorderQuantity: 0,
            materialId: rawMaterial._id,
            ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
            ...(resolvedLocationId ? { locationId: resolvedLocationId } : {})
          }
        },
        { upsert: true, new: true }
      );
    } catch (invErr) {
      console.error("Inventory sync error on rawMaterial create:", invErr);
    }

    await rawMaterial.populate(['categoryId', 'locationId']);
    res.status(201).json({ message: "Raw Material created successfully", rawMaterial, rmBoItem: rawMaterial });
  } catch (error) {
    console.error("Create Raw Material Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "Raw Material", cleanName: req.body?.name })
      });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all Raw Materials (RM)
 */
export const getAllRawMaterials = async (req, res) => {
  try {
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Category', categorySchema);
    req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    
    // Fetch from RawMaterial collection
    let rawMaterials = await RawMaterial.find({ company: companyId })
      .populate('categoryId')
      .populate('locationId')
      .sort({ name: 1 });

    // Fallback if RawMaterial is empty: fetch from legacy RmBoItem where itemType !== 'Bought Out'
    if (rawMaterials.length === 0) {
      const legacyItems = await RmBoItem.find({
        company: companyId,
        $or: [
          { itemType: 'Raw Material' },
          { itemType: { $exists: false } },
          { itemType: null },
          { itemType: { $ne: 'Bought Out' } }
        ]
      })
        .populate('categoryId')
        .populate('locationId')
        .sort({ name: 1 });

      if (legacyItems.length > 0) {
        rawMaterials = legacyItems;
      }
    }

    const Inventory = req.getModel('Inventory', inventorySchema);
    const inventories = await Inventory.find({ company: companyId });
    const invMap = new Map();
    inventories.forEach(inv => {
      if (inv.materialId) invMap.set(String(inv.materialId), inv);
      if (inv.materialCode) invMap.set(String(inv.materialCode), inv);
    });

    const enriched = rawMaterials.map(rm => {
      const rmObj = rm.toObject ? rm.toObject() : { ...rm };
      const inv = invMap.get(String(rmObj._id)) || invMap.get(String(rmObj.code));
      const stock = inv ? Number(inv.currentStock || 0) : Number(rmObj.quantity || 0);
      const qcStock = inv ? Number(inv.qcPendingStock || 0) : 0;
      const hasTransactions = stock > 0 || qcStock > 0 || Boolean(rmObj.hasTransactions);
      return {
        ...rmObj,
        quantity: stock,
        currentStock: stock,
        qcPendingStock: qcStock,
        hasTransactions,
        status: rmObj.status || (rmObj.isActive === false ? 'Inactive' : 'Active'),
        isActive: rmObj.isActive !== false && rmObj.status !== 'Inactive' && rmObj.status !== 'Deactivated'
      };
    });

    res.status(200).json({ rawMaterials: enriched, rmBoItems: enriched, count: enriched.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get Raw Material by ID
 */
export const getRawMaterialById = async (req, res) => {
  try {
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Category', categorySchema);
    req.getModel('Location', locationSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    let item = await RawMaterial.findOne({ _id: id, company: companyId })
      .populate('categoryId')
      .populate('locationId');

    if (!item) {
      item = await RmBoItem.findOne({ _id: id, company: companyId })
        .populate('categoryId')
        .populate('locationId');
    }

    if (!item) {
      return res.status(404).json({ message: "Raw Material not found" });
    }

    res.status(200).json({ rawMaterial: item, rmBoItem: item });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update Raw Material
 */
export const updateRawMaterial = async (req, res) => {
  try {
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
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
        const uploadResult = await uploadOnS3(file.path, "raw-materials/photos", companyId);
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
        Model: RawMaterial,
        companyId,
        excludeId: id,
        name: req.body.name,
        code: req.body.code,
        masterLabel: "Raw Material"
      });
      if (uniqueness.isDuplicate) {
        return res.status(400).json({ message: uniqueness.message });
      }
    }

    let rawMaterial = await RawMaterial.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: req.body },
      { new: true }
    ).populate(['categoryId', 'locationId']);

    if (!rawMaterial) {
      // Try updating legacy RmBoItem
      rawMaterial = await RmBoItem.findOneAndUpdate(
        { _id: id, company: companyId },
        { $set: { ...req.body, itemType: 'Raw Material' } },
        { new: true }
      ).populate(['categoryId', 'locationId']);
    }

    if (!rawMaterial) return res.status(404).json({ message: "Raw Material not found" });

    // Sync to legacy RmBoItem
    await RmBoItem.findOneAndUpdate(
      { _id: id },
      { $set: { ...req.body, itemType: 'Raw Material' } },
      { upsert: true }
    );

    res.status(200).json({ message: "Raw Material updated successfully", rawMaterial, rmBoItem: rawMaterial });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: formatDuplicateKeyError(error, { masterLabel: "Raw Material", cleanName: req.body?.name })
      });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete Raw Material
 */
export const deleteRawMaterial = async (req, res) => {
  try {
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
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

    await RawMaterial.findOneAndDelete({ _id: id, company: companyId });
    await RmBoItem.findOneAndDelete({ _id: id, company: companyId });
    await Inventory.findOneAndDelete({ materialId: id, company: companyId });

    res.status(200).json({ message: "Raw Material deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
