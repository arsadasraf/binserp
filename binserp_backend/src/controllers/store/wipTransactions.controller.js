import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "./updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { componentSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

/**
 * Return unused material from Shopfloor WIP back to Main Store
 */
export const returnWipToStore = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { userId, userName } = getUserAudit(req);
  const {
    materialId,
    materialName,
    itemType = "rm", // 'rm', 'bo', 'fg'
    quantity,
    unit = "PCS",
    locationId,
    mrpNumber,
    remarks
  } = req.body;

  const returnQty = Number(quantity);
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Valid return quantity is required");
  }

  if (!materialId && !materialName) {
    throw new ApiError(400, "Material identification is required");
  }

  const docNumber = `WIP-RET-${Date.now()}`;
  const normalizedType = itemType.toLowerCase();

  // If returning FG/Component, increment Component stock
  if (normalizedType === "fg" || normalizedType === "component" || normalizedType === "inhouse") {
    if (materialId && isValidObjectId(materialId.toString())) {
      const Component = req.getModel("Component", componentSchema);
      await Component.findByIdAndUpdate(materialId, { $inc: { quantity: returnQty } });
    }
  } else {
    // If returning RM or BO, increment Main Store Inventory
    const masterType = normalizedType === "bo" ? "BoughtOut" : "RawMaterial";
    await updateInventoryStock(
      req,
      materialId,
      returnQty,
      unit,
      locationId,
      {
        itemType: masterType,
        transactionCategory: "WIP_RETURN_TO_STORE",
        referenceDocType: "WIPReturn",
        referenceDocNumber: docNumber,
        recipientOrSource: "Main Store",
        purpose: remarks || `Unused material returned from Shopfloor WIP${mrpNumber ? ` (MRP #${mrpNumber})` : ""}`,
        performedBy: userId,
        performedByName: userName,
        hasSecondaryUnit: Boolean(req.body.hasSecondaryUnit),
        secondaryUnit: req.body.secondaryUnit,
        secondaryQuantity: Number(req.body.secondaryQuantity) || 0,
        conversionFactor: Number(req.body.conversionFactor) || 1
      }
    );
  }

  // Also log StockTransaction for audit trail
  await recordStockTransaction(req, {
    itemType: normalizedType === "bo" ? "BoughtOut" : (normalizedType === "fg" ? "Component" : "RawMaterial"),
    item: materialId && isValidObjectId(materialId.toString()) ? materialId : undefined,
    itemName: materialName || "Returned Material",
    unit: unit,
    movementType: "INWARD",
    transactionCategory: "WIP_RETURN_TO_STORE",
    quantity: returnQty,
    hasSecondaryUnit: Boolean(req.body.hasSecondaryUnit),
    secondaryUnit: req.body.secondaryUnit,
    secondaryQuantity: Number(req.body.secondaryQuantity) || 0,
    conversionFactor: Number(req.body.conversionFactor) || 1,
    referenceDocType: "WIPReturn",
    referenceDocNumber: docNumber,
    recipientOrSource: "Main Store Stock",
    purpose: remarks || `Unused material returned from Shopfloor WIP${mrpNumber ? ` (MRP #${mrpNumber})` : ""}`,
    performedBy: userId,
    performedByName: userName
  });

  return res.status(200).json(new ApiResponse(200, { docNumber, returnQty }, "Material successfully returned from WIP to Main Store"));
});

/**
 * Record Shopfloor Cutting Scrap / Process Waste Write-off
 */
export const recordWipScrap = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { userId, userName } = getUserAudit(req);
  const {
    materialId,
    materialName,
    itemType = "rm",
    quantity,
    unit = "PCS",
    scrapReason = "Process Waste / Offcut",
    mrpNumber,
    remarks
  } = req.body;

  const scrapQty = Number(quantity);
  if (!scrapQty || scrapQty <= 0) {
    throw new ApiError(400, "Valid scrap quantity is required");
  }

  const docNumber = `WIP-SCRAP-${Date.now()}`;
  const normalizedType = itemType.toLowerCase();

  // Log scrap deduction in StockTransaction
  await recordStockTransaction(req, {
    itemType: normalizedType === "bo" ? "BoughtOut" : (normalizedType === "fg" ? "Component" : "RawMaterial"),
    item: materialId && isValidObjectId(materialId.toString()) ? materialId : undefined,
    itemName: materialName || "Scrapped Material",
    unit: unit,
    movementType: "OUTWARD",
    transactionCategory: "WIP_SCRAP_WRITEOFF",
    quantity: scrapQty,
    hasSecondaryUnit: Boolean(req.body.hasSecondaryUnit),
    secondaryUnit: req.body.secondaryUnit,
    secondaryQuantity: Number(req.body.secondaryQuantity) || 0,
    conversionFactor: Number(req.body.conversionFactor) || 1,
    referenceDocType: "WIPScrap",
    referenceDocNumber: docNumber,
    recipientOrSource: `Shop Floor Scrap Register (${scrapReason})`,
    purpose: remarks ? `${scrapReason} - ${remarks}` : scrapReason,
    performedBy: userId,
    performedByName: userName
  });

  return res.status(200).json(new ApiResponse(200, { docNumber, scrapQty }, "Shopfloor scrap write-off recorded successfully"));
});
