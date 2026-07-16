import { purchaseOrderSchema } from "../../models/purchase/index.js";
import { vendorSchema } from "../../models/store/index.js";
import { rmBoItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createPO = asyncHandler(async (req, res) => {
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);

  const {
    poNumber,
    date,
    vendor,
    material,
    component,
    materialName,
    quantity,
    unit,
    rate,
    amount,
    category,
    items,
    totalAmount,
    status
  } = req.body;

  if (!poNumber || !vendor) {
    throw new ApiError(400, "PO number and vendor are required");
  }

  const poData = {
    company: companyId,
    poNumber,
    date: date || new Date(),
    vendor,
    createdBy: req.user.id,
    status: status || "Released",
  };

  if (items && items.length > 0) {
    poData.items = items;
    poData.totalAmount = totalAmount || items.reduce((sum, item) => sum + (item.amount || 0), 0);
  } else if (material || component || materialName) {
    poData.material = material;
    poData.component = component;
    poData.materialName = materialName;
    poData.quantity = quantity;
    poData.unit = unit;
    poData.rate = rate;
    poData.amount = amount;
    poData.category = category;
    poData.totalAmount = amount || (quantity * rate);
  } else {
    throw new ApiError(400, "Either items array or single material details are required");
  }

  const po = await PurchaseOrder.create(poData);

  res.status(201).json(new ApiResponse(201, po, "Purchase Order created successfully"));
});

export const getAllPOs = asyncHandler(async (req, res) => {
  req.getModel('RmBoItem', rmBoItemSchema);
  req.getModel('Vendor', vendorSchema);
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);

  const companyId = getCompanyId(req);
  const pos = await PurchaseOrder.find({ company: companyId })
    .populate("vendor", "name code email phone")
    .populate("material", "name code")
    .populate("items.material", "name code")
    .sort({ createdAt: -1 });

  const posWithVendorName = pos.map(po => {
    const poObj = po.toObject();
    if (poObj.vendor) {
      poObj.vendorName = poObj.vendor.name;
    }
    return poObj;
  });

  // Keep format consistent with original response for POTable
  res.status(200).json({ pos: posWithVendorName, count: pos.length });
});

export const updatePO = asyncHandler(async (req, res) => {
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const po = await PurchaseOrder.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  );

  if (!po) {
    throw new ApiError(404, "PO not found");
  }

  res.status(200).json(new ApiResponse(200, po, "PO updated successfully"));
});

export const deletePO = asyncHandler(async (req, res) => {
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const po = await PurchaseOrder.findOneAndDelete({ _id: id, company: companyId });

  if (!po) {
    throw new ApiError(404, "PO not found");
  }

  res.status(200).json(new ApiResponse(200, {}, "PO deleted successfully"));
});
