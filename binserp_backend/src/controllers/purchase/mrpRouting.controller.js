import mongoose from "mongoose";
import { materialRequestSchema } from "../../models/store/index.js";
import { salesOrderSchema } from "../../models/sales/index.js";
import { workOrderSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? (req.user?._id || req.user?.id) : (req.user?.company?._id || req.user?.company));
};

const getModel = (req, modelName, schema) => {
  if (req.getModel && schema) {
    try {
      return req.getModel(modelName, schema);
    } catch (e) {}
  }
  return mongoose.models[modelName] || mongoose.model(modelName, schema);
};

/**
 * Create Purchase Indent / Requisition or RFQ from MRP Raw Material Items
 */
export const createIndentFromMRP = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?._id || req.user?.id;
    const { salesOrderId, items } = req.body;

    if (!salesOrderId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Sales Order ID and items array are required." });
    }

    const SalesOrder = getModel(req, "SalesOrder", salesOrderSchema);
    const MaterialRequest = getModel(req, "MaterialRequest", materialRequestSchema);

    const salesOrder = await SalesOrder.findOne({ _id: salesOrderId, ...(companyId ? { company: companyId } : {}) });
    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales Order not found." });
    }

    const indentNumber = `IND-MRP-${Date.now().toString().slice(-6)}`;

    const materialItems = items.map((i) => ({
      materialName: i.name,
      materialCode: i.itemId || i.code || "RM-001",
      requestedQuantity: Number(i.netDeficit || i.quantity || 1),
      unit: i.unit || "PCS",
      remarks: `Auto-generated via MRP for Sales Order #${salesOrder.orderNumber}`
    }));

    const indent = new MaterialRequest({
      company: companyId || salesOrder.company,
      requestNumber: indentNumber,
      department: "Production / Purchase MRP",
      requestedBy: userId,
      status: "Pending",
      items: materialItems,
      remarks: `MRP Requisition for Sales Order #${salesOrder.orderNumber}`
    });

    await indent.save();

    salesOrder.status = "Moved MRP";
    await salesOrder.save();

    return res.status(201).json({
      success: true,
      message: `Successfully created Purchase Indent #${indentNumber} for ${items.length} raw material items.`,
      data: indent
    });
  } catch (error) {
    console.error("Error creating Indent from MRP:", error);
    return res.status(500).json({ success: false, message: "Server error creating Indent from MRP.", error: error.message });
  }
};

/**
 * Create PPC Work Orders / Job Cards from MRP Manufactured FG & Sub-Assembly Items
 */
export const createWorkOrderFromMRP = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user?._id || req.user?.id;
    const { salesOrderId, items } = req.body;

    if (!salesOrderId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Sales Order ID and items array are required." });
    }

    const SalesOrder = getModel(req, "SalesOrder", salesOrderSchema);
    const WorkOrder = getModel(req, "WorkOrder", workOrderSchema);

    const salesOrder = await SalesOrder.findOne({ _id: salesOrderId, ...(companyId ? { company: companyId } : {}) });
    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales Order not found." });
    }

    const createdWorkOrders = [];

    for (const item of items) {
      const woNumber = `WO-MRP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
      const wo = new WorkOrder({
        company: companyId || salesOrder.company,
        workOrderNumber: woNumber,
        salesOrder: salesOrder._id,
        salesOrderNumber: salesOrder.orderNumber,
        productName: item.name,
        targetQuantity: Number(item.requiredQty || item.netDeficit || 1),
        startDate: new Date(),
        targetCompletionDate: salesOrder.targetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "Planned",
        createdBy: userId,
        remarks: `Auto-generated via PPC Intake from Sales Order #${salesOrder.orderNumber}`
      });

      await wo.save();
      createdWorkOrders.push(wo);

      salesOrder.workOrderIds = salesOrder.workOrderIds || [];
      salesOrder.workOrderIds.push(woNumber);
    }

    salesOrder.fulfillmentStatus = "In Production";
    await salesOrder.save();

    return res.status(201).json({
      success: true,
      message: `Successfully sent ${createdWorkOrders.length} item(s) to PPC Intake / Work Orders.`,
      data: createdWorkOrders
    });
  } catch (error) {
    console.error("Error creating Work Orders from MRP:", error);
    return res.status(500).json({ success: false, message: "Server error creating Work Orders from MRP.", error: error.message });
  }
};
