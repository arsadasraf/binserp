import mongoose from "mongoose";
import { priceListSchema } from "../../models/sales/index.js";
import { fgItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createOrUpdatePriceList = asyncHandler(async (req, res) => {
  const PriceList = req.getModel("PriceList", priceListSchema);
  const companyId = getCompanyId(req);
  const { fgItem, price, taxRate, remarks } = req.body;

  if (!fgItem || price === undefined || taxRate === undefined) {
    return res.status(400).json({ message: "FG Item, price, and tax rate are required." });
  }

  // Ensure fgItem is an ObjectId
  const fgItemObjectId = new mongoose.Types.ObjectId(fgItem);

  // Upsert the price list entry for this company and fgItem
  const priceListEntry = await PriceList.findOneAndUpdate(
    { company: companyId, fgItem: fgItemObjectId },
    { price, taxRate, remarks },
    { new: true, upsert: true }
  );

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
    .populate("fgItem")
    .sort({ updatedAt: -1 });

  console.log("PRICE LISTS RETURNED:", JSON.stringify(priceLists, null, 2));

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
