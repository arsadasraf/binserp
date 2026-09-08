import mongoose from "mongoose";
import { vendorPriceListSchema } from "../../models/purchase/index.js";
import { vendorSchema, rmBoItemSchema, rawMaterialSchema, boughtOutSchema, consumableItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createVendorPriceList = asyncHandler(async (req, res) => {
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const companyId = getCompanyId(req);

  const { vendor, material, price, taxRate, validFrom, validUntil, remarks, isPreferred } = req.body;

  if (!material) {
    throw new ApiError(400, "Material is required");
  }

  const cleanVendor = (vendor && mongoose.Types.ObjectId.isValid(vendor)) ? vendor : null;

  // If this entry is marked preferred, unset preferred flag on other entries for the same material
  if (isPreferred) {
    await VendorPriceList.updateMany(
      { company: companyId, material },
      { $set: { isPreferred: false } }
    );
  }

  const query = { material, company: companyId };
  if (cleanVendor) {
    query.vendor = cleanVendor;
  } else {
    query.vendor = { $in: [null, undefined] };
  }

  const existingPriceList = await VendorPriceList.findOne(query);
  if (existingPriceList) {
    existingPriceList.price = Number(price);
    existingPriceList.taxRate = Number(taxRate);
    existingPriceList.vendor = cleanVendor;
    if (validFrom !== undefined) existingPriceList.validFrom = validFrom;
    if (validUntil !== undefined) existingPriceList.validUntil = validUntil;
    if (remarks !== undefined) existingPriceList.remarks = remarks;
    if (isPreferred !== undefined) existingPriceList.isPreferred = Boolean(isPreferred);
    
    await existingPriceList.save();
    return res.status(200).json(new ApiResponse(200, existingPriceList, "Price List updated successfully"));
  }

  const newPriceList = await VendorPriceList.create({
    company: companyId,
    vendor: cleanVendor || undefined,
    material,
    price: Number(price),
    taxRate: Number(taxRate),
    validFrom,
    validUntil,
    isPreferred: Boolean(isPreferred),
    remarks,
    createdBy: req.user?.id || req.user?._id,
  });

  return res.status(201).json(new ApiResponse(201, newPriceList, "Price List created successfully"));
});

export const getVendorPriceLists = asyncHandler(async (req, res) => {
  req.getModel('Vendor', vendorSchema);
  const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
  const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
  const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
  const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const companyId = getCompanyId(req);

  // Fetch price lists with populated vendor without relying on Mongoose RmBoItem schema ref for material
  const priceLists = await VendorPriceList.find({ company: companyId })
    .populate('vendor', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  // Collect all unique material IDs
  const materialIds = [
    ...new Set(
      priceLists
        .map((pl) => (pl.material?._id || pl.material)?.toString())
        .filter(Boolean)
    )
  ];

  if (materialIds.length > 0) {
    const validObjectIds = materialIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    // Query separated collections in parallel
    const [rawMaterials, boughtOuts, consumables, rmBoItems] = await Promise.all([
      RawMaterial.find({ company: companyId, _id: { $in: validObjectIds } })
        .select('name code unit category descriptions description specification photos')
        .lean(),
      BoughtOut.find({ company: companyId, _id: { $in: validObjectIds } })
        .select('name code unit category descriptions description specification photos')
        .lean(),
      ConsumableItem.find({ company: companyId, _id: { $in: validObjectIds } })
        .select('name code unit category descriptions description specification photos')
        .lean(),
      RmBoItem.find({ company: companyId, _id: { $in: validObjectIds } })
        .select('name code unit category descriptions description specification photos itemType')
        .lean()
    ]);

    // Build comprehensive material lookup map
    const materialMap = new Map();
    // Legacy fallback first
    rmBoItems.forEach((item) => {
      materialMap.set(item._id.toString(), {
        ...item,
        itemCategory: (item.itemType || '').toLowerCase().includes('bought') ? 'bo' : 'rm'
      });
    });
    // Dedicated collections take precedence
    rawMaterials.forEach((item) => materialMap.set(item._id.toString(), { ...item, itemCategory: 'rm' }));
    boughtOuts.forEach((item) => materialMap.set(item._id.toString(), { ...item, itemCategory: 'bo' }));
    consumables.forEach((item) => materialMap.set(item._id.toString(), { ...item, itemCategory: 'consumable' }));

    // Attach resolved material to each price list
    priceLists.forEach((pl) => {
      const matIdStr = (pl.material?._id || pl.material)?.toString();
      if (matIdStr && materialMap.has(matIdStr)) {
        pl.material = materialMap.get(matIdStr);
      } else if (matIdStr) {
        // Fallback object to guarantee material._id is never lost/null
        pl.material = { _id: matIdStr, name: 'Item', descriptions: '' };
      }
    });
  }

  return res.status(200).json(new ApiResponse(200, priceLists, "Vendor Price Lists fetched successfully"));
});

export const updateVendorPriceList = asyncHandler(async (req, res) => {
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const { vendor, material, price, taxRate, validFrom, validUntil, remarks, isPreferred } = req.body;

  const updateData = {};
  if (price !== undefined) updateData.price = Number(price);
  if (taxRate !== undefined) updateData.taxRate = Number(taxRate);
  if (vendor !== undefined) {
    updateData.vendor = (vendor && mongoose.Types.ObjectId.isValid(vendor)) ? vendor : null;
  }
  if (material) {
    updateData.material = material;
  }
  if (validFrom !== undefined) updateData.validFrom = validFrom;
  if (validUntil !== undefined) updateData.validUntil = validUntil;
  if (remarks !== undefined) updateData.remarks = remarks;
  if (isPreferred !== undefined) updateData.isPreferred = Boolean(isPreferred);

  if (updateData.isPreferred) {
    const existing = await VendorPriceList.findOne({ _id: id, company: companyId });
    if (existing) {
      await VendorPriceList.updateMany(
        { company: companyId, material: existing.material, _id: { $ne: id } },
        { $set: { isPreferred: false } }
      );
    }
  }

  const updatedPriceList = await VendorPriceList.findOneAndUpdate(
    { _id: id, company: companyId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedPriceList) {
    throw new ApiError(404, "Vendor Price List not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedPriceList, "Vendor Price List updated successfully"));
});

export const deleteVendorPriceList = asyncHandler(async (req, res) => {
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const deletedPriceList = await VendorPriceList.findOneAndDelete({ _id: id, company: companyId });

  if (!deletedPriceList) {
    throw new ApiError(404, "Vendor Price List not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Vendor Price List deleted successfully"));
});
