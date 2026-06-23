import { rmInventoryMonthlySchema, fgInventoryMonthlySchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const updateRMMonthlyInventory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { materialId, month, openingStock, closingStock, totalInwardQuantity, totalOutwardQuantity } = req.body;

    if (!materialId || !month) {
      return res.status(400).json({ success: false, message: "materialId and month are required" });
    }

    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);

    const updateFields = {};
    if (openingStock !== undefined) updateFields.openingStock = openingStock;
    if (closingStock !== undefined) updateFields.closingStock = closingStock;
    if (totalInwardQuantity !== undefined) updateFields.totalInwardQuantity = totalInwardQuantity;
    if (totalOutwardQuantity !== undefined) updateFields.totalOutwardQuantity = totalOutwardQuantity;

    // Upsert the record
    const record = await RMInventoryMonthly.findOneAndUpdate(
      { company: companyId, material: materialId, month },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "RM monthly inventory updated successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error updating RM monthly inventory:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const updateFGMonthlyInventory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { fgItemId, month, openingStock, closingStock, totalInwardQuantity, totalOutwardQuantity } = req.body;

    if (!fgItemId || !month) {
      return res.status(400).json({ success: false, message: "fgItemId and month are required" });
    }

    const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);

    const updateFields = {};
    if (openingStock !== undefined) updateFields.openingStock = openingStock;
    if (closingStock !== undefined) updateFields.closingStock = closingStock;
    if (totalInwardQuantity !== undefined) updateFields.totalInwardQuantity = totalInwardQuantity;
    if (totalOutwardQuantity !== undefined) updateFields.totalOutwardQuantity = totalOutwardQuantity;

    // Upsert the record
    const record = await FGInventoryMonthly.findOneAndUpdate(
      { company: companyId, fgItem: fgItemId, month },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "FG monthly inventory updated successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error updating FG monthly inventory:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
