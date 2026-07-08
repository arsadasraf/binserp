import mongoose from "mongoose";

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

// Models (retrieved via req.getModel in multitenant setup)
// Fulfillments: "StoreOrderFulfillment"
// Inventories: "FGInventoryMonthly"
// MRP: "StoreMRP"

const getCurrentMonthString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getFulfillments = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment");
    const FGInventoryMonthly = req.getModel("FGInventoryMonthly");
    
    // Find all pending/partial fulfillments
    const fulfillments = await StoreOrderFulfillment.find({ company: companyId })
      .populate('storeOrder', 'orderNumber status customerName createdAt')
      .populate('fgItem', 'name code unit')
      .sort({ createdAt: -1 });

    const currentMonth = getCurrentMonthString();
    
    // Attach available stock to each fulfillment dynamically
    const enrichedFulfillments = await Promise.all(
      fulfillments.map(async (fulfillment) => {
        const inventory = await FGInventoryMonthly.findOne({
          company: companyId,
          fgItem: fulfillment.fgItem._id,
          month: currentMonth
        });

        const closingStock = inventory ? inventory.closingStock : 0;
        const totalReservedQuantity = inventory ? (inventory.totalReservedQuantity || 0) : 0;
        const availableStock = Math.max(0, closingStock - totalReservedQuantity);

        return {
          ...fulfillment.toObject(),
          availableStock,
          closingStock,
          totalReservedQuantity
        };
      })
    );

    res.status(200).json({ success: true, data: enrichedFulfillments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reserveQuantity = async (req, res) => {
  try {
    const { id } = req.params; // Fulfillment ID
    const { quantity } = req.body;
    const companyId = getCompanyId(req);
    
    const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment");
    const FGInventoryMonthly = req.getModel("FGInventoryMonthly");

    const fulfillment = await StoreOrderFulfillment.findOne({ _id: id, company: companyId });
    if (!fulfillment) return res.status(404).json({ success: false, message: "Fulfillment not found" });

    // Calculate remaining quantity that actually needs reservation
    const remainingToFulfill = fulfillment.orderedQuantity - fulfillment.dispatchedQuantity - fulfillment.mrpMovedQuantity;
    const requestedReserve = Math.min(Number(quantity), remainingToFulfill);

    if (requestedReserve <= 0) {
      return res.status(400).json({ success: false, message: "Invalid reservation quantity" });
    }

    const currentMonth = getCurrentMonthString();
    let inventory = await FGInventoryMonthly.findOne({
      company: companyId,
      fgItem: fulfillment.fgItem,
      month: currentMonth
    });

    if (!inventory) {
      return res.status(400).json({ success: false, message: "No inventory available for this item" });
    }

    const availableStock = inventory.closingStock - (inventory.totalReservedQuantity || 0);
    
    // The amount we are adding to reservation
    const actualReserveIncrement = Math.min(requestedReserve, availableStock);
    
    if (actualReserveIncrement <= 0) {
      return res.status(400).json({ success: false, message: "Not enough available stock to reserve" });
    }

    // Update fulfillment record
    fulfillment.reservedQuantity = (fulfillment.reservedQuantity || 0) + actualReserveIncrement;
    await fulfillment.save();

    // Update inventory reservation pool
    inventory.totalReservedQuantity = (inventory.totalReservedQuantity || 0) + actualReserveIncrement;
    await inventory.save();

    res.status(200).json({ success: true, message: `Successfully reserved ${actualReserveIncrement} units.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const moveToMRP = async (req, res) => {
  try {
    const { id } = req.params; // Fulfillment ID
    const { quantity } = req.body;
    const companyId = getCompanyId(req);
    
    const StoreOrderFulfillment = req.getModel("StoreOrderFulfillment");
    const StoreMRP = req.getModel("StoreMRP");

    const fulfillment = await StoreOrderFulfillment.findOne({ _id: id, company: companyId });
    if (!fulfillment) return res.status(404).json({ success: false, message: "Fulfillment not found" });

    const remainingToFulfill = fulfillment.orderedQuantity - fulfillment.dispatchedQuantity - fulfillment.mrpMovedQuantity - fulfillment.reservedQuantity;
    
    if (remainingToFulfill <= 0) {
      return res.status(400).json({ success: false, message: "No remaining shortage to push to MRP." });
    }

    const mrpQuantity = Math.min(Number(quantity), remainingToFulfill);
    
    if (mrpQuantity <= 0) {
       return res.status(400).json({ success: false, message: "Invalid MRP quantity." });
    }

    const newMRP = await StoreMRP.create({
      company: companyId,
      storeOrder: fulfillment.storeOrder,
      fgItem: fulfillment.fgItem,
      requiredQuantity: mrpQuantity,
      dueDate: fulfillment.targetDate || new Date(),
      status: "Pending",
      createdBy: req.user._id,
      remarks: `Generated from Store Order shortage`
    });

    fulfillment.mrpMovedQuantity = (fulfillment.mrpMovedQuantity || 0) + mrpQuantity;
    await fulfillment.save();

    res.status(201).json({ success: true, message: `Sent ${mrpQuantity} units to MRP queue.`, data: newMRP });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreMRPs = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const StoreMRP = req.getModel("StoreMRP");

    const mrps = await StoreMRP.find({ company: companyId })
      .populate('storeOrder', 'orderNumber customerName')
      .populate('fgItem', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: mrps });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
