import mongoose from "mongoose";
import { fgItemSchema, inventorySchema, rmBoItemSchema, customerSchema } from "../../models/store/index.js";
import { salesOrderSchema } from "../../models/sales/index.js";
import { componentSchema } from "../../models/ppc/index.js";

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
 * Perform Recursive Multi-Level BOM Explosion for a Sales Order
 * Returns both Hierarchical Tree View and Consolidated Aggregated View
 */
export const explodeSalesOrderMRP = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { salesOrderId } = req.body;

    if (!salesOrderId) {
      return res.status(400).json({ success: false, message: "Sales Order ID is required for MRP explosion." });
    }

    const SalesOrder = getModel(req, "SalesOrder", salesOrderSchema);
    const FGItem = getModel(req, "FGItem", fgItemSchema);
    const Material = getModel(req, "Material", rmBoItemSchema);
    const Inventory = getModel(req, "Inventory", inventorySchema);
    const Component = getModel(req, "Component", componentSchema);
    getModel(req, "Customer", customerSchema);

    const salesOrder = await SalesOrder.findOne({
      _id: salesOrderId,
      ...(companyId ? { company: companyId } : {})
    })
      .populate("customer", "name companyName")
      .populate({
        path: "items.fgItem",
        populate: {
          path: "bom.item"
        }
      });

    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales Order not found." });
    }

    // Helper: Recursively explode BOM
    async function explodeBOMNode(itemObj, requiredQty, parentName = "Root", level = 0, treePath = "") {
      const node = {
        level,
        parentName,
        treePath,
        itemId: itemObj._id || itemObj.id,
        itemType: itemObj.itemType || itemObj.type || "FGItem",
        name: itemObj.name || itemObj.itemName || itemObj.materialName || "Item",
        unit: itemObj.unit || "Nos",
        requiredQty,
        allocatedQty: itemObj.allocatedFgQty || 0,
        currentStock: itemObj.quantity || 0,
        availableStock: Math.max(0, (itemObj.quantity || 0) - (itemObj.allocatedQuantity || 0)),
        netDeficit: Math.max(0, requiredQty - Math.max(0, (itemObj.quantity || 0) - (itemObj.allocatedQuantity || 0))),
        children: [],
        routingAction: "NONE"
      };

      // Determine routing action
      if (node.itemType === "Material" || node.itemType === "Component" || (!itemObj.bom || itemObj.bom.length === 0)) {
        node.routingAction = "PURCHASE_RFQ_PO";
      } else {
        node.routingAction = "PPC_INTAKE";
      }

      // If it has a BOM, recurse into children
      if (itemObj.bom && Array.isArray(itemObj.bom) && itemObj.bom.length > 0) {
        for (const childBOM of itemObj.bom) {
          const childQtyMultiplier = Number(childBOM.quantity || 1);
          const childGrossQty = requiredQty * childQtyMultiplier;
          const childItemType = childBOM.itemType || "Material";

          let loadedChildDoc = childBOM.item;

          // Fetch full child document if not populated
          if (!loadedChildDoc || !loadedChildDoc.name) {
            if (childItemType === "FGItem") {
              loadedChildDoc = await FGItem.findOne({ _id: childBOM.item, ...(companyId ? { company: companyId } : {}) }).populate("bom.item");
            } else if (childItemType === "Material") {
              loadedChildDoc = await Material.findOne({ _id: childBOM.item, ...(companyId ? { company: companyId } : {}) });
            } else if (childItemType === "Component") {
              loadedChildDoc = await Component.findOne({ _id: childBOM.item, ...(companyId ? { company: companyId } : {}) });
            }
          }

          if (loadedChildDoc) {
            const childDocObj = loadedChildDoc.toObject ? loadedChildDoc.toObject() : loadedChildDoc;
            childDocObj.itemType = childItemType;
            childDocObj.itemName = childBOM.itemName || childDocObj.name;

            // Fetch live RM stock if Material
            if (childItemType === "Material") {
              const inv = await Inventory.findOne({ item: loadedChildDoc._id, ...(companyId ? { company: companyId } : {}) });
              childDocObj.quantity = inv ? inv.quantity : (loadedChildDoc.quantity || 0);
              childDocObj.allocatedQuantity = 0;
            }

            const childNode = await explodeBOMNode(
              childDocObj,
              childGrossQty,
              node.name,
              level + 1,
              `${treePath} > ${childDocObj.itemName}`
            );
            node.children.push(childNode);
          }
        }
      }

      return node;
    }

    const treeView = [];
    const consolidatedMap = new Map();

    for (const soItem of salesOrder.items) {
      const orderQty = Number(soItem.quantity || 0);
      const allocatedQty = Number(soItem.allocatedFgQty || 0);
      const unfulfilledQty = Math.max(0, orderQty - allocatedQty);

      let fgDoc = soItem.fgItem;
      if (!fgDoc || !fgDoc.name) {
        fgDoc = await FGItem.findOne({ _id: soItem.fgItem, ...(companyId ? { company: companyId } : {}) }).populate("bom.item");
      }

      if (fgDoc) {
        const fgDocObj = fgDoc.toObject ? fgDoc.toObject() : fgDoc;
        fgDocObj.itemType = "FGItem";
        fgDocObj.name = soItem.name || fgDocObj.name;
        fgDocObj.allocatedFgQty = allocatedQty;

        const rootNode = await explodeBOMNode(fgDocObj, unfulfilledQty, "Sales Order #" + salesOrder.orderNumber, 0, fgDocObj.name);
        treeView.push(rootNode);
      }
    }

    // Helper: Flatten tree to build Consolidated Map
    function buildConsolidatedMap(nodes) {
      for (const node of nodes) {
        const key = `${node.itemType}_${node.itemId || node.name}`;
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            itemId: node.itemId,
            itemType: node.itemType,
            name: node.name,
            unit: node.unit,
            totalRequiredQty: 0,
            availableStock: node.availableStock,
            totalNetDeficit: 0,
            routingAction: node.routingAction
          });
        }

        const current = consolidatedMap.get(key);
        current.totalRequiredQty += node.requiredQty;
        current.totalNetDeficit = Math.max(0, current.totalRequiredQty - current.availableStock);

        if (node.children && node.children.length > 0) {
          buildConsolidatedMap(node.children);
        }
      }
    }

    buildConsolidatedMap(treeView);
    const consolidatedView = Array.from(consolidatedMap.values());

    return res.status(200).json({
      success: true,
      data: {
        salesOrder: {
          _id: salesOrder._id,
          orderNumber: salesOrder.orderNumber,
          customerName: salesOrder.customerName || salesOrder.customer?.name || salesOrder.customer?.companyName || "-",
          targetDate: salesOrder.targetDate,
          fulfillmentStatus: salesOrder.fulfillmentStatus
        },
        treeView,
        consolidatedView
      }
    });
  } catch (error) {
    console.error("Error in explodeSalesOrderMRP controller:", error);
    return res.status(500).json({ success: false, message: "Server error performing nested MRP explosion.", error: error.message });
  }
};
