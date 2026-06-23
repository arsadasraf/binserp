import { rmInventoryMonthlySchema, fgInventoryMonthlySchema, materialSchema, fgItemSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getRMMonthlyInventory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { month, materialId } = req.query;
    
    const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
    const Material = req.getModel('Material', materialSchema); // Register for population
    
    let query = { company: companyId };
    if (month) query.month = month;
    if (materialId) query.material = materialId;
    
    const data = await RMInventoryMonthly.find(query).populate('material');
    
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching RM monthly inventory:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getFGMonthlyInventory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { month, fgItemId } = req.query;
    
    const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
    const FGItem = req.getModel('FGItem', fgItemSchema); // Register for population
    
    let query = { company: companyId };
    if (month) query.month = month;
    if (fgItemId) query.fgItem = fgItemId;
    
    const data = await FGInventoryMonthly.find(query).populate('fgItem');
    
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching FG monthly inventory:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
