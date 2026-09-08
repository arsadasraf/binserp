import mongoose from "mongoose";
import { purchaseRFQSchema } from "../../models/purchase/index.js";
import { userSchema } from "../../models/user/index.js";
import { vendorSchema, rawMaterialSchema, boughtOutSchema, consumableItemSchema, rmBoItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createPurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  req.getModel("User", userSchema);
  const companyId = getCompanyId(req);
  const userId = req.user?._id || req.user?.id;

  const { rfqNumber, date, dueDate, vendorName, vendorEmail, vendorPhone, vendorIds, items, remarks } = req.body;

  if (!rfqNumber) {
    throw new ApiError(400, "RFQ Number is required");
  }

  const existingRFQ = await PurchaseRFQ.findOne({ rfqNumber, company: companyId });
  if (existingRFQ) {
    throw new ApiError(400, "RFQ with this number already exists");
  }

  const newRFQ = await PurchaseRFQ.create({
    company: companyId,
    rfqNumber,
    date: date || new Date(),
    dueDate,
    vendorName: vendorName || "Multiple Vendors",
    vendorEmail,
    vendorPhone,
    vendorIds: Array.isArray(vendorIds) ? vendorIds : [],
    items: Array.isArray(items) ? items : [],
    remarks,
    status: "Sent",
    createdBy: userId,
    updatedBy: userId,
    statusHistory: [{ status: "Sent", updatedBy: userId, updatedAt: new Date() }],
  });

  const populatedRFQ = await PurchaseRFQ.findById(newRFQ._id)
    .populate("vendorIds")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role");

  return res.status(201).json(new ApiResponse(201, populatedRFQ, "Purchase RFQ created successfully"));
});

export const getPurchaseRFQs = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
  const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
  req.getModel("User", userSchema);
  req.getModel("Vendor", vendorSchema);
  const companyId = getCompanyId(req);

  const rfqs = await PurchaseRFQ.find({ company: companyId })
    .populate("vendorIds")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("statusHistory.updatedBy", "name email role")
    .sort({ createdAt: -1 })
    .lean();

  // Collect all material IDs referenced across RFQs
  const materialIdSet = new Set();
  rfqs.forEach(rfq => {
    if (Array.isArray(rfq.items)) {
      rfq.items.forEach(it => {
        const matVal = typeof it.materialId === 'object' && it.materialId !== null ? it.materialId._id : it.materialId;
        if (matVal && mongoose.Types.ObjectId.isValid(String(matVal))) {
          materialIdSet.add(matVal.toString());
        }
      });
    }
  });

  const validObjectIds = Array.from(materialIdSet);

  // Parallel multi-collection query
  const [rawMaterials, boughtOuts, consumables, rmBoItems] = await Promise.all([
    validObjectIds.length > 0
      ? RawMaterial.find({ company: companyId, _id: { $in: validObjectIds } })
          .select('name code unit category descriptions description specification photos')
          .populate('categoryId', 'name unit')
          .lean()
      : [],
    validObjectIds.length > 0
      ? BoughtOut.find({ company: companyId, _id: { $in: validObjectIds } })
          .select('name code unit category descriptions description specification photos')
          .populate('categoryId', 'name unit')
          .lean()
      : [],
    validObjectIds.length > 0
      ? ConsumableItem.find({ company: companyId, _id: { $in: validObjectIds } })
          .select('name code unit category descriptions description specification photos')
          .populate('categoryId', 'name unit')
          .lean()
      : [],
    validObjectIds.length > 0
      ? RmBoItem.find({ company: companyId, _id: { $in: validObjectIds } })
          .select('name code unit category descriptions description specification photos itemType')
          .populate('categoryId', 'name unit')
          .lean()
      : []
  ]);

  // Build unified lookup map
  const materialMap = new Map();
  rmBoItems.forEach(item => {
    materialMap.set(item._id.toString(), {
      ...item,
      itemCategory: (item.itemType || '').toLowerCase().includes('bought') ? 'bo' : 'rm'
    });
  });
  rawMaterials.forEach(item => materialMap.set(item._id.toString(), { ...item, itemCategory: 'rm' }));
  boughtOuts.forEach(item => materialMap.set(item._id.toString(), { ...item, itemCategory: 'bo' }));
  consumables.forEach(item => materialMap.set(item._id.toString(), { ...item, itemCategory: 'consumable' }));

  const rfqsFormatted = rfqs.map(rfq => {
    const rfqObj = { ...rfq };
    if (Array.isArray(rfqObj.items)) {
      rfqObj.items = rfqObj.items.map(it => {
        const matIdStr = it.materialId ? (typeof it.materialId === 'object' ? it.materialId._id?.toString() : it.materialId.toString()) : null;
        const resolved = matIdStr ? materialMap.get(matIdStr) : null;

        const resolvedMatObj = resolved ? {
          _id: resolved._id,
          name: resolved.name,
          code: resolved.code || '',
          unit: resolved.unit || (typeof resolved.categoryId === 'object' ? resolved.categoryId?.unit : '') || 'PCS',
          category: typeof resolved.category === 'object' ? resolved.category?.name : (resolved.category || (typeof resolved.categoryId === 'object' ? resolved.categoryId?.name : '')),
          description: resolved.descriptions || resolved.description || '',
          descriptions: resolved.descriptions || resolved.description || '',
          specification: resolved.specification || '',
          itemCategory: resolved.itemCategory || 'rm'
        } : (typeof it.materialId === 'object' && it.materialId !== null ? it.materialId : null);

        const materialName = it.materialName || resolvedMatObj?.name || 'Material Item';
        const description = it.description || resolvedMatObj?.descriptions || resolvedMatObj?.description || '';
        const unit = it.unit || it.uom || resolvedMatObj?.unit || 'PCS';
        const itemType = it.itemType || resolvedMatObj?.itemCategory || 'rm';

        return {
          ...it,
          materialId: resolvedMatObj ? resolvedMatObj._id : it.materialId,
          material: resolvedMatObj || undefined,
          materialName,
          description,
          descriptions: description,
          unit,
          uom: unit,
          itemType
        };
      });
    }
    return rfqObj;
  });

  return res.status(200).json(new ApiResponse(200, rfqsFormatted, "Purchase RFQs fetched successfully"));
});

export const updatePurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  req.getModel("User", userSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);
  const userId = req.user?._id || req.user?.id;

  const existingRFQ = await PurchaseRFQ.findOne({ _id: id, company: companyId });
  if (!existingRFQ) {
    throw new ApiError(404, "Purchase RFQ not found");
  }

  const updatePayload = { ...req.body, updatedBy: userId };

  // Track status change audit history
  if (req.body.status && req.body.status !== existingRFQ.status) {
    updatePayload.$push = {
      statusHistory: {
        status: req.body.status,
        updatedBy: userId,
        updatedAt: new Date(),
      }
    };
  }

  const updatedRFQ = await PurchaseRFQ.findOneAndUpdate(
    { _id: id, company: companyId },
    updatePayload,
    { new: true, runValidators: true }
  )
    .populate("vendorIds")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("statusHistory.updatedBy", "name email role");

  return res.status(200).json(new ApiResponse(200, updatedRFQ, "Purchase RFQ updated successfully"));
});

export const deletePurchaseRFQ = asyncHandler(async (req, res) => {
  const PurchaseRFQ = req.getModel("PurchaseRFQ", purchaseRFQSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const deletedRFQ = await PurchaseRFQ.findOneAndDelete({ _id: id, company: companyId });

  if (!deletedRFQ) {
    throw new ApiError(404, "Purchase RFQ not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Purchase RFQ deleted successfully"));
});
