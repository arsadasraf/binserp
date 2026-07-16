import { salesOrderSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const planSalesOrder = asyncHandler(async (req, res) => {
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);
  const orderId = req.params.id;

  const order = await SalesOrder.findOne({ _id: orderId, company: companyId }).populate("items.fgItem");

  if (!order) {
    return res.status(404).json({ success: false, message: "Sales order not found" });
  }

  if (order.isPlanned) {
    return res.status(400).json({ success: false, message: "Sales order is already planned" });
  }

  try {
    const { generateMRPForSalesOrder } = await import("../purchase/salesOrderMRP.controller.js");
    await generateMRPForSalesOrder(req, order);
    
    const { generateProductionOrderForSalesOrder } = await import("../ppc/createProductionOrderFromSales.controller.js");
    await generateProductionOrderForSalesOrder(req, order);
  } catch(err) {
    console.error("Failed to generate MRP/ProductionOrder", err);
    return res.status(500).json({ success: false, message: "Failed to plan order: " + err.message });
  }

  order.isPlanned = true;
  await order.save();

  res.status(200).json({ success: true, message: "Sales order successfully planned", order });
});
