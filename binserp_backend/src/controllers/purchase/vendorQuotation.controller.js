import { vendorQuotationSchema } from "../../models/purchase/index.js";
import { rawMaterialSchema } from "../../models/store/rawMaterial.model.js";
import { boughtOutSchema } from "../../models/store/boughtOut.model.js";
import { consumableItemSchema } from "../../models/store/consumableItem.model.js";
import { rmBoItemSchema } from "../../models/store/rmBoItem.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createVendorQuotation = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const companyId = getCompanyId(req);

  let { 
    quotationNumber, 
    rfq, 
    rfqNumber, 
    vendor, 
    vendorName, 
    vendorAddress, 
    vendorEmail, 
    vendorPhone, 
    vendorGst, 
    date, 
    items, 
    subtotal, 
    totalTax, 
    grandTotal, 
    validUntil, 
    termsAndConditions,
    status
  } = req.body;

  if (!quotationNumber) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    quotationNumber = `VQ-${dateStr}-${randomNum}`;
  }

  const existingQuotation = await VendorQuotation.findOne({ quotationNumber, company: companyId });
  if (existingQuotation) {
    throw new ApiError(400, "Vendor Quotation with this number already exists");
  }

  const newQuotation = await VendorQuotation.create({
    company: companyId,
    quotationNumber,
    rfq: rfq || undefined,
    rfqNumber: rfqNumber || "",
    vendor: vendor || undefined,
    vendorName: vendorName || "Supplier",
    vendorAddress,
    vendorEmail,
    vendorPhone,
    vendorGst,
    date: date || new Date(),
    items: Array.isArray(items) ? items : [],
    subtotal,
    totalTax,
    grandTotal,
    validUntil,
    status: status || "Pending Approval",
    termsAndConditions,
    createdBy: req.user?._id || req.user?.id,
  });

  return res.status(201).json(new ApiResponse(201, newQuotation, "Vendor Quotation created successfully"));
});

export const getVendorQuotations = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
  const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
  const companyId = getCompanyId(req);

  const quotations = await VendorQuotation.find({ company: companyId })
    .populate("vendor")
    .populate("rfq")
    .sort({ createdAt: -1 })
    .lean();

  // Collect all material IDs referenced across Quotations
  const materialIdSet = new Set();
  quotations.forEach(q => {
    (q.items || []).forEach(it => {
      if (it.materialId) {
        materialIdSet.add(it.materialId.toString());
      }
    });
  });

  const materialIds = Array.from(materialIdSet);

  if (materialIds.length > 0) {
    const [rawMaterials, boughtOuts, consumables, rmBoItems] = await Promise.all([
      RawMaterial.find({ _id: { $in: materialIds } }).select("name descriptions unit category standardCost").lean().catch(() => []),
      BoughtOut.find({ _id: { $in: materialIds } }).select("name descriptions unit category standardCost").lean().catch(() => []),
      ConsumableItem.find({ _id: { $in: materialIds } }).select("name descriptions unit category standardCost").lean().catch(() => []),
      RmBoItem.find({ _id: { $in: materialIds } }).select("name description unit category rate").lean().catch(() => []),
    ]);

    const materialMap = new Map();
    [...rawMaterials, ...boughtOuts, ...consumables, ...rmBoItems].forEach(m => {
      if (m && m._id) {
        materialMap.set(m._id.toString(), m);
      }
    });

    quotations.forEach(q => {
      (q.items || []).forEach(it => {
        if (it.materialId) {
          const mat = materialMap.get(it.materialId.toString());
          if (mat) {
            it.material = mat;
            if (!it.materialName || it.materialName === "Material Item") {
              it.materialName = mat.name || it.materialName;
            }
            if (!it.description) {
              it.description = mat.descriptions || mat.description || mat.specification || "";
            }
            if (!it.unit) {
              it.unit = it.uom || mat.unit || "PCS";
            }
          }
        }
      });
    });
  }

  return res.status(200).json(new ApiResponse(200, quotations, "Vendor Quotations fetched successfully"));
});

export const updateVendorQuotation = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const updatedQuotation = await VendorQuotation.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedQuotation) {
    throw new ApiError(404, "Vendor Quotation not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedQuotation, "Vendor Quotation updated successfully"));
});

export const deleteVendorQuotation = asyncHandler(async (req, res) => {
  const VendorQuotation = req.getModel("VendorQuotation", vendorQuotationSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const deletedQuotation = await VendorQuotation.findOneAndDelete({ _id: id, company: companyId });

  if (!deletedQuotation) {
    throw new ApiError(404, "Vendor Quotation not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Vendor Quotation deleted successfully"));
});
