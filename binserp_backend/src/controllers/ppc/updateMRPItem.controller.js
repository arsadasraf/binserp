import { materialRequirementSchema } from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

export const updateMRPItem = asyncHandler(async (req, res) => {
  const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);
  const companyId = getCompanyId(req);
  const { itemId } = req.params;
  const { prQuantity, status } = req.body;

  try {
    // Find the document that contains this item
    const requirementDoc = await MaterialRequirement.findOne({
      company: companyId,
      "items._id": itemId
    });

    if (!requirementDoc) {
      return res.status(404).json({ success: false, message: "MRP item not found" });
    }

    // Find the specific item and update it
    const item = requirementDoc.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "MRP item not found inside document" });
    }

    if (prQuantity !== undefined) {
      item.prQuantity = Number(prQuantity);
    }
    
    if (status) {
      item.status = status;
    }

    await requirementDoc.save();

    res.status(200).json({ success: true, message: "MRP item updated successfully", item });
  } catch (error) {
    console.error("Error updating MRP item:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
