import { vendorPriceListSchema } from "../../models/purchase/index.js";
import { vendorSchema, rmBoItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createVendorPriceList = asyncHandler(async (req, res) => {
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const companyId = getCompanyId(req);

  const { vendor, material, price, taxRate, validFrom, validUntil, remarks } = req.body;

  const existingPriceList = await VendorPriceList.findOne({ vendor, material, company: companyId });
  if (existingPriceList) {
    throw new ApiError(400, "Price List for this material and vendor already exists");
  }

  const newPriceList = await VendorPriceList.create({
    company: companyId,
    vendor,
    material,
    price,
    taxRate,
    validFrom,
    validUntil,
    remarks,
    createdBy: req.user.id,
  });

  return res.status(201).json(new ApiResponse(201, newPriceList, "Vendor Price List created successfully"));
});

export const getVendorPriceLists = asyncHandler(async (req, res) => {
  req.getModel('Material', rmBoItemSchema);
  req.getModel('Vendor', vendorSchema);
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const companyId = getCompanyId(req);

  const priceLists = await VendorPriceList.find({ company: companyId })
    .populate('vendor', 'name code')
    .populate('material', 'name code')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, priceLists, "Vendor Price Lists fetched successfully"));
});

export const updateVendorPriceList = asyncHandler(async (req, res) => {
  const VendorPriceList = req.getModel("VendorPriceList", vendorPriceListSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const updatedPriceList = await VendorPriceList.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
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
