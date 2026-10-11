import { ppcOrderSchema, productionOrderSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

export const moveProductionToManufacturing = asyncHandler(async (req, res) => {
  const ProductionOrder = req.getModel("ProductionOrder", productionOrderSchema);
  const PPCOrder = req.getModel("PPCOrder", ppcOrderSchema);
  
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { itemsToMove } = req.body; // Array of { productId, productName, quantity, trackingType }

  // 1. Locate source order from either PPCOrder (e.g. MRP Demand Intake) or ProductionOrder
  let sourceOrder = await PPCOrder.findOne({ _id: id, company: companyId });
  let isFromPPCOrder = true;

  if (!sourceOrder) {
    sourceOrder = await ProductionOrder.findOne({ _id: id, company: companyId });
    isFromPPCOrder = false;
  }

  if (!sourceOrder) {
    return res.status(404).json(new ApiResponse(404, null, "Origin Order not found"));
  }

  // Generate unique, clean MO Order Number upfront
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const cleanRef = (sourceOrder.mrpNumber || sourceOrder.poReference || 'GEN')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 16);
  const ppcOrderNumber = `MO-${cleanRef}-${randomSuffix}`;

  // 2. Build items array for the new Manufacturing Order based on selection
  const ppcItems = [];

  for (let idx = 0; idx < sourceOrder.items.length; idx++) {
    const item = sourceOrder.items[idx];
    const pId = item.product?._id ? item.product._id.toString() : (item.product ? item.product.toString() : null);
    const pName = item.productName || item.materialName;
    const itemIdStr = item._id ? item._id.toString() : null;

    // Match top-level item by subdocument itemId, productId, productName, or item index
    const moveReq = itemsToMove?.find(i => 
      !i.isSubAssembly && (
        (itemIdStr && i.itemId && i.itemId.toString() === itemIdStr) ||
        (pId && i.productId && i.productId.toString() === pId) ||
        (i.productName && pName && i.productName.trim().toLowerCase() === pName.trim().toLowerCase()) ||
        (i.itemIndex !== undefined && Number(i.itemIndex) === idx)
      )
    );

    const moveQty = moveReq ? Number(moveReq.quantity) : 0;
    const trackingType = moveReq?.trackingType || item.trackingType || "Individual";
    
    if (moveQty > 0) {
      ppcItems.push({
        ...item.toObject(),
        quantity: moveQty,
        trackingType,
        jobs: [] // Route card jobs generated during planning/shopfloor release
      });

      // Update source item tracking
      item.movedQuantity = (Number(item.movedQuantity) || 0) + moveQty;
      item.linkedMoNumber = ppcOrderNumber;
      item.linkedMoId = null; // Will link after MO save
      item.moStatus = (item.movedQuantity || 0) >= item.quantity ? "MO Created" : "Partially Created";
    }

    // Check nested materials if a sub-assembly was selected for MO creation
    if (Array.isArray(item.nestedMaterials)) {
      for (const nested of item.nestedMaterials) {
        const nName = (nested.materialName || nested.itemName || "").trim().toLowerCase();
        const nestedReq = itemsToMove?.find(i => 
          (i.isSubAssembly || i.itemType === "SubAssembly" || i.itemType === "Component") &&
          i.productName && i.productName.trim().toLowerCase() === nName
        );

        if (nestedReq && Number(nestedReq.quantity) > 0) {
          const subQty = Number(nestedReq.quantity);
          ppcItems.push({
            productName: nested.materialName || nested.itemName,
            productCode: nested.materialCode || "",
            itemType: nested.itemType || "SubAssembly",
            description: nested.description || "",
            unit: nested.unit || "PCS",
            quantity: subQty,
            trackingType: nestedReq.trackingType || "Individual",
            jobs: []
          });

          nested.movedQuantity = (Number(nested.movedQuantity) || 0) + subQty;
          nested.linkedMoNumber = ppcOrderNumber;
          nested.moStatus = (nested.movedQuantity || 0) >= (Number(nested.totalRequired) || subQty) ? "MO Created" : "Partially Created";
        }
      }
    }
  }

  // Also handle any directly provided itemsToMove marked as subassemblies
  if (Array.isArray(itemsToMove)) {
    for (const directItem of itemsToMove) {
      if (directItem.isSubAssembly && !ppcItems.some(p => p.productName?.toLowerCase() === directItem.productName?.toLowerCase())) {
        const directQty = Number(directItem.quantity) || 0;
        if (directQty > 0) {
          ppcItems.push({
            productName: directItem.productName,
            productCode: directItem.productCode || "",
            itemType: directItem.itemType || "SubAssembly",
            description: directItem.description || "",
            unit: directItem.unit || "PCS",
            quantity: directQty,
            trackingType: directItem.trackingType || "Individual",
            jobs: []
          });
        }
      }
    }
  }

  if (ppcItems.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, "No quantities selected to move."));
  }

  // 4. Create dedicated Manufacturing Order with end-to-end traceability
  const ppcOrder = new PPCOrder({
    company: companyId,
    orderNumber: ppcOrderNumber,
    poReference: sourceOrder.poReference || sourceOrder.mrpNumber || "DIRECT",
    customer: sourceOrder.customer,
    customerName: sourceOrder.customerName || "Internal Production Demand",
    mrpNumber: sourceOrder.mrpNumber || sourceOrder.originMrpNumber || "",
    originMrpNumber: sourceOrder.mrpNumber || sourceOrder.originMrpNumber || "",
    originOrderId: sourceOrder._id,
    sourceType: "MANUFACTURING_ORDER",
    deliveryDate: sourceOrder.deliveryDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: "Pending", // Planned / Pending shopfloor execution
    items: ppcItems,
    createdBy: req.user?.id || req.user?._id,
    remarks: `Manufacturing Order created for ${ppcItems.length} item(s) from ${sourceOrder.mrpNumber ? `MRP #${sourceOrder.mrpNumber}` : sourceOrder.orderNumber}`
  });

  await ppcOrder.save();

  // Link ppcOrder._id back to source items
  for (const item of sourceOrder.items) {
    if (item.linkedMoNumber === ppcOrderNumber) {
      item.linkedMoId = ppcOrder._id;
    }
  }

  // Update source order overall status
  const isFullyMoved = sourceOrder.items.every(item => (Number(item.movedQuantity) || 0) >= item.quantity);
  if (isFullyMoved) {
    sourceOrder.status = "Confirmed";
  } else {
    sourceOrder.status = "InProgress";
  }

  sourceOrder.markModified('items');
  await sourceOrder.save();

  return res.status(201).json({
    success: true,
    statusCode: 201,
    order: ppcOrder,
    data: ppcOrder,
    message: `Successfully generated Manufacturing Order #${ppcOrderNumber}`
  });
});

/**
 * Fetch all dedicated Manufacturing Orders
 */
export const getAllManufacturingOrders = asyncHandler(async (req, res) => {
  const PPCOrder = req.getModel("PPCOrder", ppcOrderSchema);
  const companyId = getCompanyId(req);

  const orders = await PPCOrder.find({
    company: companyId,
    $or: [
      { sourceType: "MANUFACTURING_ORDER" },
      { orderNumber: { $regex: /^MO-/i } },
      { orderNumber: { $regex: /^MFG-/i } }
    ]
  })
    .populate("items.product")
    .populate("customer")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    statusCode: 200,
    orders,
    data: { orders },
    message: "Manufacturing orders retrieved successfully"
  });
});
