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
  const { itemsToMove } = req.body; // Array of { productId, quantity }

  const productionOrder = await ProductionOrder.findOne({ _id: id, company: companyId });
  if (!productionOrder) {
    return res.status(404).json(new ApiResponse(404, null, "Production Order not found"));
  }

  // Create items array for PPCOrder based on selection
  const ppcItems = [];
  let fullyMoved = true;

  for (const item of productionOrder.items) {
    const moveReq = itemsToMove?.find(i => i.productId === item.product.toString());
    const moveQty = moveReq ? Number(moveReq.quantity) : 0;
    
    if (moveQty > 0) {
      ppcItems.push({
        ...item.toObject(),
        quantity: moveQty,
        jobs: [] // Jobs will be generated in PPCOrder later
      });
    }

    if (!moveReq || moveQty < item.quantity) {
       fullyMoved = false;
    }
    
    // Update the original item's quantity if partially moved?
    // Actually, it's better to just keep it as is, but mark the moved quantity somewhere if we want partial tracking in ProductionOrder.
    // For simplicity, we just change the status of ProductionOrder if fully moved.
    // We could add a 'movedQuantity' to ProductionOrder items.
    if (moveQty > 0) {
      item.movedQuantity = (item.movedQuantity || 0) + moveQty;
    }
  }

  if (ppcItems.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, "No quantities selected to move."));
  }

  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ppcOrderNumber = `MFG-${productionOrder.poReference}-${randomSuffix}`;

  const ppcOrder = new PPCOrder({
    company: companyId,
    orderNumber: ppcOrderNumber,
    poReference: productionOrder.poReference,
    customer: productionOrder.customer,
    customerName: productionOrder.customerName,
    deliveryDate: productionOrder.deliveryDate,
    status: "Pending", // Pending execution in shop floor
    items: ppcItems,
    createdBy: req.user.id,
    remarks: "Moved from Production Order"
  });

  await ppcOrder.save();

  // Update Production Order Status
  // If all items' movedQuantity >= quantity, mark as 'Confirmed' or 'Moved'.
  // Let's use "Confirmed" to hide it from the intake list.
  const isFullyMoved = productionOrder.items.every(item => (item.movedQuantity || 0) >= item.quantity);
  
  if (isFullyMoved) {
    productionOrder.status = "Confirmed";
  } else {
    // If partial, maybe keep it 'Pending' but user knows some are moved
    productionOrder.status = "InProgress"; 
  }
  
  await productionOrder.save();

  return res.status(201).json(new ApiResponse(201, ppcOrder, "Successfully moved to Manufacturing Order"));
});
