import { fgItemSchema } from "../../models/store/index.js";
import { uploadOnS3 } from "../../utils/s3.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    let { name, type, description, customer, category, location, unit, bom, revisionNumber } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Name and Type are required" });
    }

    // Quick fix: Drop the deprecated unique index on `code` if it exists for this tenant
    try {
      await FGItem.collection.dropIndex('company_1_code_1');
    } catch (e) {
      // Ignore error if index doesn't exist
    }

    // Parse bom if it's a string (from FormData)
    if (typeof bom === 'string') {
      try { bom = JSON.parse(bom); } catch(e) { console.error("Failed to parse bom", e); }
    }

    // Handle photo uploads
    const photoUrls = [];
    let filesToUpload = [];
    if (Array.isArray(req.files)) {
      filesToUpload = req.files;
    } else if (req.files && req.files['photos']) {
      filesToUpload = req.files['photos'];
    }

    if (filesToUpload.length > 0) {
      for (const file of filesToUpload) {
        try {
          const uploadResult = await uploadOnS3(file.path, "fg-items", companyId);
          if (uploadResult) photoUrls.push(uploadResult.secure_url);
        } catch (e) { console.error("Photo upload error", e); }
      }
    }

    const newFGItem = await FGItem.create({
      company: companyId,
      name,
      type,
      description,
      customer,
      category,
      location,
      unit: unit || "Nos",
      bom: bom || [],
      revisionNumber,
      photos: photoUrls
    });

    res.status(201).json({ message: "FG Item created successfully", fgItem: newFGItem });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A unique constraint was violated. If you just encountered an error, please try again as the deprecated index was just removed." });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllFGItems = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);

    const fgItems = await FGItem.find({ company: companyId })
      .populate('category', 'name code')
      .populate('location', 'name')
      .populate('customer', 'name')
      .populate('bom.item', 'name componentName code componentCode') 
      .sort({ createdAt: -1 });

    res.status(200).json({ fgItems, count: fgItems.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    
    let { name, type, description, customer, category, location, unit, bom, revisionNumber } = req.body;

    // Parse bom if it's a string
    if (typeof bom === 'string') {
      try { bom = JSON.parse(bom); } catch(e) { console.error("Failed to parse bom", e); }
    }

    let updateData = { name, type, description, customer, category, location, unit, bom, revisionNumber };
    
    // Handle photo uploads
    let filesToUpload = [];
    if (Array.isArray(req.files)) {
      filesToUpload = req.files;
    } else if (req.files && req.files['photos']) {
      filesToUpload = req.files['photos'];
    }

    if (filesToUpload.length > 0) {
      const photoUrls = [];
      for (const file of filesToUpload) {
        try {
          const uploadResult = await uploadOnS3(file.path, "fg-items", companyId);
          if (uploadResult) photoUrls.push(uploadResult.secure_url);
        } catch (e) { console.error("Photo upload error", e); }
      }
      updateData.photos = photoUrls;
    }

    // Clean up undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const fgItem = await FGItem.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true }
    );

    if (!fgItem) return res.status(404).json({ message: "FG Item not found" });

    res.status(200).json({ message: "FG Item updated successfully", fgItem });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteFGItem = async (req, res) => {
  try {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const fgItem = await FGItem.findOneAndDelete({ _id: id, company: companyId });
    if (!fgItem) return res.status(404).json({ message: "FG Item not found" });

    res.status(200).json({ message: "FG Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
