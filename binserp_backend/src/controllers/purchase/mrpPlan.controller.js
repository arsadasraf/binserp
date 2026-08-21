import mongoose from "mongoose";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { bomSchema, inventorySchema, rmBoItemSchema, categorySchema, fgItemSchema } from "../../models/store/index.js";
import { userSchema } from "../../models/user/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createMRPPlan = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const BOM = req.getModel("BOM", bomSchema);
    const Inventory = req.getModel("Inventory", inventorySchema);
    const RmBoItem = req.getModel("RmBoItem", rmBoItemSchema);
    const Category = req.getModel("Category", categorySchema);
    const FGItem = req.getModel("FGItem", fgItemSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const {
      mrpNumber: customMrpNumber,
      customerPoNumber = "",
      customerPo,
      customerName = "",
      targetDate,
      remarks = "",
      fgItems = [],
    } = req.body;

    if (!Array.isArray(fgItems) || fgItems.length === 0) {
      return res.status(400).json({ message: "At least one Finished Goods (FG) item is required for MRP calculation." });
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const mrpNumber = customMrpNumber || `MRP-${dateStr}-${randomSuffix}`;

    // Maps to aggregate RM, BO and Consumables across all FG items
    const rmMap = new Map();
    const boMap = new Map();
    const consumableMap = new Map();

    // Cache inventory, RM/BO items, BOMs and FG items for fast hierarchy explosion
    const allInventories = await Inventory.find({ company: companyId });
    const allRmBoItems = await RmBoItem.find({ company: companyId }).populate("categoryId");
    const allBOMs = await BOM.find({ company: companyId });
    const allFGItems = await FGItem.find({ company: companyId });

    const enrichedFgItems = [];

    // Helper to find BOM for a product
    const findBOM = (pName, pCode, bId) => {
      if (bId) {
        const found = allBOMs.find((b) => b._id.toString() === bId.toString());
        if (found) return found;
      }
      if (pName) {
        const cleanPName = pName.trim().toLowerCase();
        const found = allBOMs.find((b) => b.productName && b.productName.trim().toLowerCase() === cleanPName);
        if (found) return found;
      }
      if (pCode) {
        const cleanPCode = pCode.trim().toLowerCase();
        const found = allBOMs.find((b) => b.productCode && b.productCode.trim().toLowerCase() === cleanPCode);
        if (found) return found;
      }
      return null;
    };

    // Recursive BOM explosion function
    const explodeItemTree = (itemName, itemCode, multiplierQty, parentName, level, nestedList) => {
      const subBOM = findBOM(itemName, itemCode);
      if (subBOM && Array.isArray(subBOM.items) && subBOM.items.length > 0 && level <= 5) {
        for (const subItem of subBOM.items) {
          const sName = (subItem.materialName || "").trim();
          const sCode = (subItem.materialCode || "").trim();
          const perQty = Number(subItem.quantity) || 1;
          const grossQty = perQty * multiplierQty;
          const unit = subItem.unit || "PCS";

          // Stock lookup
          const inv = allInventories.find(
            (i) =>
              (sCode && i.materialCode && i.materialCode.toLowerCase() === sCode.toLowerCase()) ||
              (i.materialName && i.materialName.toLowerCase() === sName.toLowerCase())
          );
          const currentStock = inv ? Number(inv.currentStock || 0) : 0;
          const shortage = Math.max(0, grossQty - currentStock);

          // RM/BO lookup
          const rmBo = allRmBoItems.find(
            (r) =>
              (sCode && r.code && r.code.toLowerCase() === sCode.toLowerCase()) ||
              (r.name && r.name.toLowerCase() === sName.toLowerCase())
          );

          // Check if this subItem itself is a sub-assembly (has a BOM or is in FGItems)
          const nestedSubBOM = findBOM(sName, sCode);
          const isSubAssembly = Boolean(nestedSubBOM);

          nestedList.push({
            materialName: sName,
            materialCode: sCode,
            itemType: isSubAssembly ? "SubAssembly" : (rmBo?.categoryId?.name ? "Material" : "Component"),
            category: rmBo?.categoryId?.name || (isSubAssembly ? "Sub Assembly" : "RM / BO"),
            quantityPerFG: perQty,
            totalRequired: grossQty,
            currentStock: currentStock,
            shortage: shortage,
            unit: unit,
            parentItemName: parentName,
            level: level,
          });

          // Consolidate into global rmMap (if it's a leaf material/component)
          const itemKey = (sCode || sName).toLowerCase();
          if (!rmMap.has(itemKey)) {
            rmMap.set(itemKey, {
              material: rmBo?._id,
              materialName: sName,
              materialCode: sCode,
              category: rmBo?.categoryId?.name || (isSubAssembly ? "Sub Assembly" : "RM / BO Material"),
              itemType: isSubAssembly ? "SubAssembly" : "RM/BO",
              requiredQuantity: 0,
              currentStock: currentStock,
              shortage: 0,
              unit: unit,
              sourceFGName: parentName,
              sourceFGNames: [],
              status: "Pending",
            });
          }
          const existing = rmMap.get(itemKey);
          existing.requiredQuantity += grossQty;
          existing.shortage = Math.max(0, existing.requiredQuantity - existing.currentStock);
          const fgLabel = `${parentName} (${grossQty} ${unit})`;
          if (!existing.sourceFGNames.includes(fgLabel)) {
            existing.sourceFGNames.push(fgLabel);
          }

          // If it has sub-components, recurse into next level
          if (isSubAssembly) {
            explodeItemTree(sName, sCode, grossQty, sName, level + 1, nestedList);
          }
        }
      }
    };

    for (const fg of fgItems) {
      const fgQty = Number(fg.quantity) || 1;
      const fgName = fg.fgItemName || fg.name || "";
      const fgCode = fg.fgItemCode || fg.code || "";
      const fgDesc = fg.description || "";
      const fgTargetDate = fg.targetDate ? new Date(fg.targetDate) : undefined;
      const fgId = fg.fgItem || fg._id;

      const bomDoc = findBOM(fgName, fgCode, fg.bomId);
      const nestedMaterials = [];

      // Explode nested tree
      explodeItemTree(fgName, fgCode, fgQty, fgName, 1, nestedMaterials);

      enrichedFgItems.push({
        fgItem: fgId,
        fgItemName: fgName,
        fgItemCode: fgCode,
        description: fgDesc,
        quantity: fgQty,
        unit: fg.unit || "PCS",
        targetDate: fgTargetDate,
        bomId: bomDoc?._id,
        bomNumber: bomDoc?.bomNumber || "BOM-Auto",
        nestedMaterials: nestedMaterials,
      });
    }

    const rmRequirements = Array.from(rmMap.values());
    const boRequirements = [];
    const consumableRequirements = [];

    const newPlan = await MRPPlan.create({
      company: companyId,
      mrpNumber,
      customerPoNumber,
      customerPo: customerPo || undefined,
      customerName,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      remarks,
      status: "Planned",
      fgItems: enrichedFgItems,
      rmRequirements,
      boRequirements,
      consumableRequirements,
      createdBy: req.user?.id || req.user?._id,
      createdByName: req.user?.name || req.user?.username || "Planner",
    });

    res.status(201).json({
      success: true,
      message: "MRP Plan created successfully with RM & BO calculation",
      mrpPlan: newPlan,
    });
  } catch (error) {
    console.error("Error creating MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to create MRP plan" });
  }
};

export const getAllMRPPlans = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const { status, search } = req.query;

    const query = { company: companyId };
    if (status && status !== "All") {
      query.status = status;
    }
    if (search) {
      const s = search.trim();
      query.$or = [
        { mrpNumber: { $regex: s, $options: "i" } },
        { customerPoNumber: { $regex: s, $options: "i" } },
        { customerName: { $regex: s, $options: "i" } },
        { "fgItems.fgItemName": { $regex: s, $options: "i" } },
      ];
    }

    const mrpPlans = await MRPPlan.find(query)
      .populate("createdBy", "name username email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: mrpPlans.length,
      mrpPlans,
    });
  } catch (error) {
    console.error("Error fetching MRP plans:", error);
    res.status(500).json({ message: error.message || "Failed to fetch MRP plans" });
  }
};

export const getMRPPlanById = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const mrpPlan = await MRPPlan.findOne({ _id: id, company: companyId })
      .populate("createdBy", "name username email")
      .populate("fgItems.fgItem")
      .populate("rmRequirements.material")
      .populate("boRequirements.material");

    if (!mrpPlan) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    res.status(200).json({
      success: true,
      mrpPlan,
    });
  } catch (error) {
    console.error("Error fetching MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to fetch MRP plan" });
  }
};

export const deleteMRPPlan = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const deleted = await MRPPlan.findOneAndDelete({ _id: id, company: companyId });
    if (!deleted) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    res.status(200).json({
      success: true,
      message: "MRP Plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting MRP plan:", error);
    res.status(500).json({ message: error.message || "Failed to delete MRP plan" });
  }
};

export const updateMRPPlanStatus = async (req, res) => {
  try {
    const MRPPlan = req.getModel("MRPPlan", mrpPlanSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status } = req.body;

    const updated = await MRPPlan.findOneAndUpdate(
      { _id: id, company: companyId },
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "MRP Plan not found" });
    }

    res.status(200).json({
      success: true,
      message: `MRP Plan status updated to ${status}`,
      mrpPlan: updated,
    });
  } catch (error) {
    console.error("Error updating MRP plan status:", error);
    res.status(500).json({ message: error.message || "Failed to update MRP plan status" });
  }
};
