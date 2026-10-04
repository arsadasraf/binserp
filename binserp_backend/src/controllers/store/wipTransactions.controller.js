import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "./updateInventoryStock.controller.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { componentSchema } from "../../models/ppc/index.js";
import { rawMaterialSchema, boughtOutSchema, rmBoItemSchema, fgItemSchema } from "../../models/store/index.js";

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

/**
 * Convert Shopfloor RM / BO WIP into In-house FG Component WIP
 * (Enables cutting, blanking, pre-machining to create a Component in WIP,
 * which can then be dispatched on a WIP-to-WIP Returnable DC)
 */
export const convertWipMaterialToComponent = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { userId, userName } = getUserAudit(req);
  const {
    materialId,
    materialName,
    itemType = "rm", // 'rm' or 'bo'
    quantity, // source RM/BO quantity consumed from WIP
    unit = "PCS",
    hasSecondaryUnit,
    secondaryUnit,
    secondaryQuantity,
    conversionFactor,
    targetComponentId,
    targetComponentName,
    targetComponentCode,
    targetDescription,
    targetType = "Component",
    targetQuantity, // produced FG/Component quantity in WIP
    targetUnit = "PCS",
    targetHasSecondaryUnit,
    targetSecondaryUnit,
    targetSecondaryQuantity,
    targetConversionFactor,
    remarks,
    mrpNumber
  } = req.body;

  const sourceQty = Number(quantity);
  if (!sourceQty || sourceQty <= 0) {
    throw new ApiError(400, "Valid source quantity consumed from WIP is required");
  }

  const producedQty = Number(targetQuantity);
  if (!producedQty || producedQty <= 0) {
    throw new ApiError(400, "Valid target quantity produced is required");
  }

  const cleanTargetName = (targetComponentName || "").trim();
  if (!cleanTargetName) {
    throw new ApiError(400, "Target Component / Sub-assembly name is required");
  }

  // Sanitize source materialId (strip 'rm_' or 'bo_' prefixes from virtual WIP keys)
  let cleanMaterialId = materialId;
  if (typeof cleanMaterialId === 'string' && cleanMaterialId.includes('_')) {
    cleanMaterialId = cleanMaterialId.split('_').slice(1).join('_');
  }

  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const Component = req.getModel("Component", componentSchema);

  if (!cleanMaterialId || !isValidObjectId(cleanMaterialId.toString())) {
    const foundDoc = await RawMaterial.findOne({ company: companyId, name: materialName })
      || await BoughtOut.findOne({ company: companyId, name: materialName })
      || await RmBoItem.findOne({ company: companyId, name: materialName })
      || await Component.findOne({ company: companyId, componentName: materialName })
      || await FGItem.findOne({ company: companyId, name: materialName });
    if (foundDoc) {
      cleanMaterialId = foundDoc._id;
    }
  }

  let resolvedComponentId = null;
  let resolvedItemType = "Component";

  // Sanitize targetComponentId if passed with prefix (e.g. 'fg_...' or 'comp_...')
  let cleanTargetCompId = targetComponentId;
  if (typeof cleanTargetCompId === 'string' && cleanTargetCompId.includes('_')) {
    cleanTargetCompId = cleanTargetCompId.split('_').slice(1).join('_');
  }

  let existingTarget = null;
  if (cleanTargetCompId && isValidObjectId(cleanTargetCompId.toString())) {
    existingTarget = await FGItem.findOne({ _id: cleanTargetCompId, company: companyId })
      || await Component.findOne({ _id: cleanTargetCompId, company: companyId });
  }

  if (!existingTarget) {
    // 1. Check FGItem master catalog first to prevent duplicate component creation
    existingTarget = await FGItem.findOne({
      company: companyId,
      $or: [
        { name: new RegExp(`^${cleanTargetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
        ...(targetComponentCode ? [{ code: new RegExp(`^${targetComponentCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }] : [])
      ]
    });
  }

  if (!existingTarget) {
    // 2. Check Component catalog
    existingTarget = await Component.findOne({
      company: companyId,
      $or: [
        { componentName: new RegExp(`^${cleanTargetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
        ...(targetComponentCode ? [{ componentCode: new RegExp(`^${targetComponentCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }] : [])
      ]
    });
  }

  if (existingTarget) {
    resolvedComponentId = existingTarget._id;
    resolvedItemType = (existingTarget.name && !existingTarget.componentName) ? "FGItem" : "Component";
    // NOTE: Conversion is an in-process Shopfloor WIP event.
    // Do NOT mutate warehouse stock (existingTarget.quantity). WIP stock is increased via StockTransaction below.
  } else {
    // Only if not found in any master catalog, create a new Component catalog reference with quantity: 0 (WIP only)
    const compCode = targetComponentCode?.trim() || `COMP-${Date.now().toString().slice(-6)}`;
    const newComp = await Component.create({
      company: companyId,
      componentCode: compCode,
      componentName: cleanTargetName,
      description: targetDescription || `In-house WIP Component converted from ${materialName || "Material"}`,
      type: targetType || "Component",
      unit: targetUnit || "PCS",
      hasSecondaryUnit: Boolean(targetHasSecondaryUnit),
      secondaryUnit: targetSecondaryUnit || "",
      conversionFactor: Number(targetConversionFactor) || 1,
      quantity: 0, // 0 warehouse inventory; WIP stock is tracked via WIP_COMPONENT_CONVERT_INWARD
      isInventoryItem: true
    });
    resolvedComponentId = newComp._id;
    resolvedItemType = "Component";
  }

  const docNumber = `WIP-CONV-${Date.now()}`;
  const normalizedType = (itemType || "rm").toLowerCase();
  let sourceCategory = "RawMaterial";
  if (normalizedType === "bo" || normalizedType === "boughtout") {
    sourceCategory = "BoughtOut";
  } else if (normalizedType === "fg" || normalizedType === "component" || normalizedType === "subassembly") {
    sourceCategory = "Component";
  }

  // 1. Log Outward RM/BO/FG deduction from Shopfloor WIP
  await recordStockTransaction(req, {
    itemType: sourceCategory,
    item: cleanMaterialId && isValidObjectId(cleanMaterialId.toString()) ? cleanMaterialId : undefined,
    itemName: materialName || "Shopfloor WIP Item",
    unit: unit,
    movementType: "OUTWARD",
    transactionCategory: "WIP_RM_CONVERT_OUTWARD",
    quantity: sourceQty,
    hasSecondaryUnit: Boolean(hasSecondaryUnit),
    secondaryUnit: secondaryUnit,
    secondaryQuantity: Number(secondaryQuantity) || 0,
    conversionFactor: Number(conversionFactor) || 1,
    referenceDocType: "WIPConversion",
    referenceDocNumber: docNumber,
    recipientOrSource: `Shopfloor Component WIP (${cleanTargetName})`,
    purpose: remarks || `Converted ${sourceQty} ${unit} into ${producedQty} ${targetUnit} ${cleanTargetName}${mrpNumber ? ` (MRP #${mrpNumber})` : ""}`,
    performedBy: userId,
    performedByName: userName
  });

  // 2. Log Inward Component addition into Shopfloor WIP (Increases WIP Stock Only)
  await recordStockTransaction(req, {
    itemType: resolvedItemType,
    item: resolvedComponentId,
    itemName: cleanTargetName,
    unit: targetUnit || "PCS",
    movementType: "INWARD",
    transactionCategory: "WIP_COMPONENT_CONVERT_INWARD",
    quantity: producedQty,
    hasSecondaryUnit: Boolean(targetHasSecondaryUnit),
    secondaryUnit: targetSecondaryUnit,
    secondaryQuantity: Number(targetSecondaryQuantity) || 0,
    conversionFactor: Number(targetConversionFactor) || 1,
    referenceDocType: "WIPConversion",
    referenceDocNumber: docNumber,
    recipientOrSource: `Shopfloor Conversion (${materialName || "Material"})`,
    purpose: remarks || `In-house WIP Component produced from ${sourceQty} ${unit} of ${materialName || "Material"}${mrpNumber ? ` (MRP #${mrpNumber})` : ""}`,
    performedBy: userId,
    performedByName: userName
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        docNumber,
        sourceConsumedQty: sourceQty,
        producedQty: producedQty,
        targetComponentId: resolvedComponentId,
        targetComponentName: cleanTargetName
      },
      `Successfully converted ${sourceQty} ${unit} of ${materialName} into ${producedQty} ${targetUnit} of ${cleanTargetName} in Shopfloor WIP`
    )
  );
});

