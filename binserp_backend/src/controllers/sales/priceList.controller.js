import mongoose from "mongoose";
import { priceListSchema } from "../../models/sales/index.js";
import { fgItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createOrUpdatePriceList = asyncHandler(async (req, res) => {
  const PriceList = req.getModel("PriceList", priceListSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const companyId = getCompanyId(req);
  const { fgItem, price, taxRate, currency, hsnCode, remarks, pricingUnit, isSecondaryUnit } = req.body;

  if (!fgItem || price === undefined || taxRate === undefined) {
    return res.status(400).json({ message: "FG Item, price, and tax rate are required." });
  }

  const fgItemObjectId = new mongoose.Types.ObjectId(fgItem);
  const fgDoc = await FGItem.findById(fgItemObjectId);

  // Prioritize HSN code from the FG Item Master
  const resolvedHsn = (fgDoc?.hsnCode || hsnCode || "").trim();
  const normalizedCurrency = (currency || "INR").trim().toUpperCase();

  const priceListEntry = await PriceList.findOneAndUpdate(
    { company: companyId, fgItem: fgItemObjectId },
    { 
      price: Number(price), 
      taxRate: Number(taxRate), 
      currency: normalizedCurrency,
      hsnCode: resolvedHsn, 
      remarks,
      pricingUnit: pricingUnit || "",
      isSecondaryUnit: Boolean(isSecondaryUnit),
    },
    { new: true, upsert: true }
  );

  try {
    // Sync sellingPrice, taxRate, and currency to FGItem master
    await FGItem.findByIdAndUpdate(fgItemObjectId, {
      sellingPrice: Number(price),
      taxRate: Number(taxRate),
      currency: normalizedCurrency,
      ...(resolvedHsn && !fgDoc?.hsnCode ? { hsnCode: resolvedHsn } : {}),
    });
  } catch (err) {
    console.error("Failed to sync FGItem sellingPrice", err);
  }

  res.status(200).json({
    message: "Price List saved successfully",
    priceList: priceListEntry,
  });
});

export const getAllPriceLists = asyncHandler(async (req, res) => {
  const PriceList = req.getModel("PriceList", priceListSchema);
  req.getModel("FGItem", fgItemSchema);
  const companyId = getCompanyId(req);

  const priceLists = await PriceList.find({ company: companyId })
    .populate({
      path: "fgItem",
      select: "name code partNumber hsnCode type description descriptions specification unit hasSecondaryUnit secondaryUnit conversionFactor sellingPrice taxRate currency",
    })
    .sort({ updatedAt: -1 });

  res.status(200).json({ priceLists });
});

export const deletePriceList = asyncHandler(async (req, res) => {
  const PriceList = req.getModel("PriceList", priceListSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const deleted = await PriceList.findOneAndDelete({ _id: id, company: companyId });

  if (!deleted) {
    return res.status(404).json({ message: "Price list entry not found" });
  }

  res.status(200).json({ message: "Price list entry deleted successfully" });
});
