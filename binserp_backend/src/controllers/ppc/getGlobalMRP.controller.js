import { materialRequirementSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

export const getGlobalMRP = asyncHandler(async (req, res) => {
  const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);
  const companyId = getCompanyId(req);

  try {
    // Fetch all requirements
    const requirements = await MaterialRequirement.find({
      company: companyId
    })
    .populate('order', 'orderNumber targetMonth createdAt')
    .sort({ createdAt: -1 })
    .lean();

    // Flatten items
    const mrpItems = [];
    
    for (const reqDoc of requirements) {
      if (!reqDoc.items || reqDoc.items.length === 0) continue;
      
      for (const item of reqDoc.items) {
        mrpItems.push({
          reqId: reqDoc._id,
          itemId: item._id,
          orderNumber: reqDoc.order ? reqDoc.order.orderNumber : 'N/A',
          targetMonth: reqDoc.order ? reqDoc.order.targetMonth : 'N/A',
          orderDate: reqDoc.order ? reqDoc.order.createdAt : reqDoc.createdAt,
          material: item.material,
          materialName: item.materialName,
          requiredQuantity: item.requiredQuantity,
          unit: item.unit,
          stockAvailable: item.stockAvailable,
          shortage: item.shortage,
          prQuantity: item.prQuantity || 0,
          status: item.status
        });
      }
    }

    res.status(200).json({ success: true, items: mrpItems });
  } catch (error) {
    console.error("Error fetching global MRP:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
