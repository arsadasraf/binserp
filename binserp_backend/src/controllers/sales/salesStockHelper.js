import mongoose from "mongoose";
import {
  fgItemSchema,
  rawMaterialSchema,
  boughtOutSchema,
  consumableItemSchema,
  rmBoItemSchema,
  inventorySchema,
  fgInventoryMonthlySchema
} from "../../models/store/index.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";

/**
 * Validates available stock for Sales DC or Sales Invoice items.
 * Supports FG, Raw Material (RM), Bought-Out (BO), and Consumable items.
 */
export const validateSalesItemsStock = async (req, items, companyId) => {
  if (!Array.isArray(items) || items.length === 0) return { valid: true };

  const FGItem = req.getModel("FGItem", fgItemSchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
  const Material = req.getModel("RmBoItem", rmBoItemSchema);
  const Inventory = req.getModel("Inventory", inventorySchema);

  for (const item of items) {
    const itemType = (item.itemType || "fg").toLowerCase();
    const qtyRequired = Number(item.quantity || 0);
    const itemName = item.materialName || item.itemName || "Item";

    if (qtyRequired <= 0) continue;

    // 1. RAW MATERIAL (RM)
    if (itemType === "rm" || item.rawMaterial) {
      const rmId = item.rawMaterial || item.material || item.fgItem;
      let availableStock = 0;

      if (rmId && mongoose.Types.ObjectId.isValid(rmId)) {
        const invDoc = await Inventory.findOne({
          company: companyId,
          $or: [{ materialId: rmId }, { _id: rmId }, { materialCode: item.itemCode }]
        });
        if (invDoc) {
          availableStock = Number(invDoc.currentStock || 0);
        } else {
          const rmDoc = await RawMaterial.findOne({ _id: rmId, company: companyId });
          if (rmDoc) {
            const byNameInv = await Inventory.findOne({ company: companyId, materialName: rmDoc.name });
            availableStock = byNameInv ? Number(byNameInv.currentStock || 0) : 0;
          }
        }
      }

      if (availableStock < qtyRequired) {
        return {
          valid: false,
          message: `Requested quantity (${qtyRequired} ${item.unit || 'PCS'}) exceeds available Raw Material (RM) stock (${availableStock} ${item.unit || 'PCS'}) for '${itemName}'.`
        };
      }
    }

    // 2. BOUGHT-OUT (BO)
    else if (itemType === "bo" || item.boughtOut) {
      const boId = item.boughtOut || item.material || item.fgItem;
      let availableStock = 0;

      if (boId && mongoose.Types.ObjectId.isValid(boId)) {
        const invDoc = await Inventory.findOne({
          company: companyId,
          $or: [{ materialId: boId }, { _id: boId }, { materialCode: item.itemCode }]
        });
        if (invDoc) {
          availableStock = Number(invDoc.currentStock || 0);
        } else {
          const boDoc = await BoughtOut.findOne({ _id: boId, company: companyId });
          if (boDoc) {
            const byNameInv = await Inventory.findOne({ company: companyId, materialName: boDoc.name });
            availableStock = byNameInv ? Number(byNameInv.currentStock || 0) : 0;
          }
        }
      }

      if (availableStock < qtyRequired) {
        return {
          valid: false,
          message: `Requested quantity (${qtyRequired} ${item.unit || 'PCS'}) exceeds available Bought-Out (BO) stock (${availableStock} ${item.unit || 'PCS'}) for '${itemName}'.`
        };
      }
    }

    // 3. CONSUMABLE
    else if (itemType === "consumable" || item.consumableItem) {
      const conId = item.consumableItem || item.material || item.fgItem;
      let availableStock = 0;

      if (conId && mongoose.Types.ObjectId.isValid(conId)) {
        const invDoc = await Inventory.findOne({
          company: companyId,
          $or: [{ materialId: conId }, { _id: conId }, { materialCode: item.itemCode }]
        });
        if (invDoc) {
          availableStock = Number(invDoc.currentStock || 0);
        } else {
          const conDoc = await ConsumableItem.findOne({ _id: conId, company: companyId });
          if (conDoc) {
            const byNameInv = await Inventory.findOne({ company: companyId, materialName: conDoc.name });
            availableStock = byNameInv ? Number(byNameInv.currentStock || 0) : 0;
          }
        }
      }

      if (availableStock < qtyRequired) {
        return {
          valid: false,
          message: `Requested quantity (${qtyRequired} ${item.unit || 'PCS'}) exceeds available Consumable stock (${availableStock} ${item.unit || 'PCS'}) for '${itemName}'.`
        };
      }
    }

    // 4. FINISHED GOODS (FG)
    else {
      const fgId = item.fgItem || item.material || item.component;
      if (!fgId || !mongoose.Types.ObjectId.isValid(fgId)) {
        return {
          valid: false,
          message: `Item '${itemName}' is not linked to a valid inventory master item.`
        };
      }

      const fgDoc = await FGItem.findOne({ _id: fgId, company: companyId });
      const availableStock = fgDoc ? Number(fgDoc.quantity || 0) : 0;

      if (!fgDoc || availableStock <= 0) {
        return {
          valid: false,
          message: `Cannot dispatch/bill item '${itemName}'. FG inventory stock is zero (0 ${item.unit || 'PCS'}).`
        };
      }

      if (qtyRequired > availableStock) {
        return {
          valid: false,
          message: `Requested quantity (${qtyRequired} ${item.unit || 'PCS'}) exceeds available FG inventory stock (${availableStock} ${item.unit || 'PCS'}) for '${itemName}'.`
        };
      }
    }
  }

  return { valid: true };
};

/**
 * Deducts stock across FG, RM, BO, and Consumable inventory on Sales DC or Invoice creation.
 */
export const deductSalesItemsStock = async (req, items, options) => {
  const {
    companyId,
    refDocType, // "DeliveryChallan" or "Invoice"
    refDocId,
    refDocNumber,
    recipientName = "Customer",
    performedBy
  } = options;

  if (!Array.isArray(items) || items.length === 0) return;

  const FGItem = req.getModel("FGItem", fgItemSchema);
  const RawMaterial = req.getModel("RawMaterial", rawMaterialSchema);
  const BoughtOut = req.getModel("BoughtOut", boughtOutSchema);
  const ConsumableItem = req.getModel("ConsumableItem", consumableItemSchema);
  const Inventory = req.getModel("Inventory", inventorySchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);

  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const txCategory = refDocType === "Invoice" ? "INVOICE_OUTWARD" : "SALES_DC_OUTWARD";

  for (const item of items) {
    const itemType = (item.itemType || "fg").toLowerCase();
    const qty = Number(item.quantity || 0);
    const itemName = item.materialName || item.itemName || "Item";

    if (qty <= 0) continue;

    // 1. RAW MATERIAL (RM)
    if (itemType === "rm" || item.rawMaterial) {
      const rmId = item.rawMaterial || item.material || item.fgItem;
      const invDoc = await Inventory.findOne({
        company: companyId,
        $or: [{ materialId: rmId }, { _id: rmId }, { materialName: itemName }]
      });

      const previousStock = invDoc ? Number(invDoc.currentStock || 0) : 0;
      const newStock = Math.max(0, previousStock - qty);

      if (invDoc) {
        await Inventory.findByIdAndUpdate(invDoc._id, { $set: { currentStock: newStock } });
      }

      await recordStockTransaction(req, {
        itemType: "RawMaterial",
        item: rmId || invDoc?._id,
        itemCode: item.itemCode || invDoc?.materialCode || "",
        itemName,
        unit: item.unit || invDoc?.unit || "PCS",
        movementType: "OUTWARD",
        transactionCategory: txCategory,
        quantity: qty,
        previousStock,
        newStock,
        referenceDocType: refDocType,
        referenceDocId: refDocId,
        referenceDocNumber: refDocNumber,
        recipientOrSource: recipientName,
        purpose: `Sales Dispatch (${refDocType} #${refDocNumber})`,
        performedBy
      });
    }

    // 2. BOUGHT-OUT (BO)
    else if (itemType === "bo" || item.boughtOut) {
      const boId = item.boughtOut || item.material || item.fgItem;
      const invDoc = await Inventory.findOne({
        company: companyId,
        $or: [{ materialId: boId }, { _id: boId }, { materialName: itemName }]
      });

      const previousStock = invDoc ? Number(invDoc.currentStock || 0) : 0;
      const newStock = Math.max(0, previousStock - qty);

      if (invDoc) {
        await Inventory.findByIdAndUpdate(invDoc._id, { $set: { currentStock: newStock } });
      }

      await recordStockTransaction(req, {
        itemType: "BoughtOut",
        item: boId || invDoc?._id,
        itemCode: item.itemCode || invDoc?.materialCode || "",
        itemName,
        unit: item.unit || invDoc?.unit || "PCS",
        movementType: "OUTWARD",
        transactionCategory: txCategory,
        quantity: qty,
        previousStock,
        newStock,
        referenceDocType: refDocType,
        referenceDocId: refDocId,
        referenceDocNumber: refDocNumber,
        recipientOrSource: recipientName,
        purpose: `Sales Dispatch (${refDocType} #${refDocNumber})`,
        performedBy
      });
    }

    // 3. CONSUMABLE
    else if (itemType === "consumable" || item.consumableItem) {
      const conId = item.consumableItem || item.material || item.fgItem;
      const invDoc = await Inventory.findOne({
        company: companyId,
        $or: [{ materialId: conId }, { _id: conId }, { materialName: itemName }]
      });

      const previousStock = invDoc ? Number(invDoc.currentStock || 0) : 0;
      const newStock = Math.max(0, previousStock - qty);

      if (invDoc) {
        await Inventory.findByIdAndUpdate(invDoc._id, { $set: { currentStock: newStock } });
      }

      await recordStockTransaction(req, {
        itemType: "Consumable",
        item: conId || invDoc?._id,
        itemCode: item.itemCode || invDoc?.materialCode || "",
        itemName,
        unit: item.unit || invDoc?.unit || "PCS",
        movementType: "OUTWARD",
        transactionCategory: txCategory,
        quantity: qty,
        previousStock,
        newStock,
        referenceDocType: refDocType,
        referenceDocId: refDocId,
        referenceDocNumber: refDocNumber,
        recipientOrSource: recipientName,
        purpose: `Sales Dispatch (${refDocType} #${refDocNumber})`,
        performedBy
      });
    }

    // 4. FINISHED GOODS (FG)
    else {
      const fgId = item.fgItem || item.material || item.component;
      if (fgId && mongoose.Types.ObjectId.isValid(fgId)) {
        const fgDoc = await FGItem.findById(fgId);
        if (fgDoc) {
          const previousStock = Number(fgDoc.quantity || 0);
          const newStock = Math.max(0, previousStock - qty);

          await FGItem.findByIdAndUpdate(fgId, { $set: { quantity: newStock } });

          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: fgId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: qty } },
              { new: true, upsert: true }
            );
          } catch (mErr) {
            console.error("Monthly FG outward update err:", mErr);
          }

          await recordStockTransaction(req, {
            itemType: "FGItem",
            item: fgId,
            itemCode: fgDoc.code || item.itemCode || "",
            itemName,
            unit: item.unit || fgDoc.unit || "PCS",
            movementType: "OUTWARD",
            transactionCategory: txCategory,
            quantity: qty,
            previousStock,
            newStock,
            referenceDocType: refDocType,
            referenceDocId: refDocId,
            referenceDocNumber: refDocNumber,
            recipientOrSource: recipientName,
            purpose: `Sales Dispatch (${refDocType} #${refDocNumber})`,
            performedBy
          });
        }
      }
    }
  }
};

/**
 * Reverses stock deductions when a Sales DC or Invoice is deleted or cancelled.
 */
export const reverseSalesItemsStock = async (req, items, options) => {
  const {
    companyId,
    refDocType,
    refDocId,
    refDocNumber,
    recipientName = "Customer",
    performedBy
  } = options;

  if (!Array.isArray(items) || items.length === 0) return;

  const FGItem = req.getModel("FGItem", fgItemSchema);
  const Inventory = req.getModel("Inventory", inventorySchema);
  const FGInventoryMonthly = req.getModel("FGInventoryMonthly", fgInventoryMonthlySchema);

  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  for (const item of items) {
    const itemType = (item.itemType || "fg").toLowerCase();
    const qty = Number(item.quantity || 0);
    const itemName = item.materialName || item.itemName || "Item";

    if (qty <= 0) continue;

    // 1. RM / BO / Consumable
    if (itemType === "rm" || itemType === "bo" || itemType === "consumable" || item.rawMaterial || item.boughtOut || item.consumableItem) {
      const targetId = item.rawMaterial || item.boughtOut || item.consumableItem || item.material || item.fgItem;
      const invDoc = await Inventory.findOne({
        company: companyId,
        $or: [{ materialId: targetId }, { _id: targetId }, { materialName: itemName }]
      });

      if (invDoc) {
        const previousStock = Number(invDoc.currentStock || 0);
        const newStock = previousStock + qty;

        await Inventory.findByIdAndUpdate(invDoc._id, { $set: { currentStock: newStock } });

        await recordStockTransaction(req, {
          itemType: itemType === "rm" ? "RawMaterial" : itemType === "bo" ? "BoughtOut" : "Consumable",
          item: targetId || invDoc._id,
          itemCode: item.itemCode || invDoc.materialCode || "",
          itemName,
          unit: item.unit || invDoc.unit || "PCS",
          movementType: "INWARD",
          transactionCategory: "STOCK_ADJUSTMENT",
          quantity: qty,
          previousStock,
          newStock,
          referenceDocType: refDocType,
          referenceDocId: refDocId,
          referenceDocNumber: refDocNumber,
          recipientOrSource: recipientName,
          purpose: `Reversal of ${refDocType} #${refDocNumber} cancellation`,
          performedBy
        });
      }
    }

    // 2. FG Item
    else {
      const fgId = item.fgItem || item.material || item.component;
      if (fgId && mongoose.Types.ObjectId.isValid(fgId)) {
        const fgDoc = await FGItem.findById(fgId);
        if (fgDoc) {
          const previousStock = Number(fgDoc.quantity || 0);
          const newStock = previousStock + qty;

          await FGItem.findByIdAndUpdate(fgId, { $set: { quantity: newStock } });

          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: fgId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -qty } }
            );
          } catch (mErr) {
            console.error("Monthly FG outward reversal err:", mErr);
          }

          await recordStockTransaction(req, {
            itemType: "FGItem",
            item: fgId,
            itemCode: fgDoc.code || item.itemCode || "",
            itemName,
            unit: item.unit || fgDoc.unit || "PCS",
            movementType: "INWARD",
            transactionCategory: "STOCK_ADJUSTMENT",
            quantity: qty,
            previousStock,
            newStock,
            referenceDocType: refDocType,
            referenceDocId: refDocId,
            referenceDocNumber: refDocNumber,
            recipientOrSource: recipientName,
            purpose: `Reversal of ${refDocType} #${refDocNumber} cancellation`,
            performedBy
          });
        }
      }
    }
  }
};
