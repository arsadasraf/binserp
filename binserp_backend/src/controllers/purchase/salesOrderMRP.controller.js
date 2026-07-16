import { salesOrderMRPSchema } from "../../models/purchase/index.js";
import { fgItemSchema, inventorySchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

// Recursive function to resolve BOM down to RM/BO items
async function resolveBOM(req, bomArray, multiplierQuantity, materialMap) {
  const FGItemModel = req.getModel('FGItem', fgItemSchema);
  
  if (!bomArray || bomArray.length === 0) return;
  
  for (const bomItem of bomArray) {
    if (!bomItem || !bomItem.item) continue;
    const requiredQty = bomItem.quantity * multiplierQuantity;
    const matId = bomItem.item.toString();
    
    // Check item model type
    const itemModel = bomItem.itemModel || bomItem.itemType;
    
    if (itemModel === 'FGItem') {
      // It's a sub-assembly, resolve its BOM
      const fgItem = await FGItemModel.findById(bomItem.item).lean();
      if (fgItem && fgItem.bom && fgItem.bom.length > 0) {
        await resolveBOM(req, fgItem.bom, requiredQty, materialMap);
      }
    } else {
      // It's RM or BO Item
      if (materialMap.has(matId)) {
        materialMap.get(matId).requiredQuantity += requiredQty;
      } else {
        materialMap.set(matId, {
          material: bomItem.item,
          materialName: bomItem.itemName,
          unit: bomItem.unit,
          requiredQuantity: requiredQty
        });
      }
    }
  }
}

export const generateMRPForSalesOrder = async (req, order) => {
  const SalesOrderMRP = req.getModel('SalesOrderMRP', salesOrderMRPSchema);
  const Inventory = req.getModel('Inventory', inventorySchema);
  const FGItemModel = req.getModel('FGItem', fgItemSchema);
  const companyId = getCompanyId(req);

  try {
    // 1. Clean up any existing MRP for this Sales Order
    await SalesOrderMRP.deleteMany({ salesOrder: order._id, company: companyId });

    const materialMap = new Map();

    // 2. Loop through Sales Order items to resolve BOM
    for (const item of order.items) {
      if (!item.fgItem) continue;
      
      const fgItem = await FGItemModel.findById(item.fgItem).lean();
      if (fgItem && fgItem.bom && fgItem.bom.length > 0) {
        await resolveBOM(req, fgItem.bom, item.quantity, materialMap);
      }
    }

    // 3. Aggregate requirements and check inventory
    const requirementItems = [];
    for (const [key, val] of materialMap.entries()) {
      const inventory = await Inventory.findOne({ company: companyId, materialId: key });
      const currentStock = inventory ? inventory.currentStock : 0;
      const shortage = Math.max(0, val.requiredQuantity - currentStock);
      
      requirementItems.push({
        material: val.material,
        materialName: val.materialName,
        requiredQuantity: val.requiredQuantity,
        stockAvailable: currentStock,
        shortage: shortage,
        status: shortage > 0 ? 'Pending' : 'Fulfilled'
      });
    }

    // 4. Create the MRP record
    if (requirementItems.length > 0) {
      await SalesOrderMRP.create({
        company: companyId,
        salesOrder: order._id,
        orderNumber: order.orderNumber,
        targetDate: order.targetDate,
        items: requirementItems,
        status: 'Open'
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error generating MRP for Sales Order:", error);
    throw error;
  }
};

export const getAllSalesOrderMRPs = asyncHandler(async (req, res) => {
  const SalesOrderMRP = req.getModel('SalesOrderMRP', salesOrderMRPSchema);
  const companyId = getCompanyId(req);

  const mrps = await SalesOrderMRP.find({ company: companyId })
    .populate('salesOrder', 'orderNumber targetDate customer')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, mrps });
});
