import mongoose from "mongoose";
import { materialRequestSchema, materialIssueSchema } from "../../models/store/index.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const deleteMaterialRequest = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
    const materialRequest = await MaterialRequest.findOne({ _id: id, company: companyId });

    if (!materialRequest) {
      return res.status(404).json({ message: "Material request not found" });
    }

    // Dynamic time lock governance validation
    const lockCheck = await checkTimeLockGovernance(req, 'materialRequest', materialRequest.createdAt, 'delete');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    // Safeguard check: Block deletion if active issues exist against this request
    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
    const activeIssuesCount = await MaterialIssue.countDocuments({
      company: companyId,
      $or: [
        { materialRequest: materialRequest._id },
        { requestNumber: materialRequest.requestNumber }
      ]
    });

    const hasIssuedQuantities = (materialRequest.items || []).some(it => (Number(it.issuedQuantity) || 0) > 0);

    if (activeIssuesCount > 0 || hasIssuedQuantities || (materialRequest.linkedIssues && materialRequest.linkedIssues.length > 0)) {
      return res.status(400).json({
        message: `Cannot delete Material Request #${materialRequest.requestNumber || ''} because it has active Material Issues linked to it. Please delete or rollback the linked Material Issues first to reverse inventory stock.`
      });
    }

    await MaterialRequest.findByIdAndDelete(materialRequest._id);

    res.status(200).json({
      success: true,
      message: `Material request #${materialRequest.requestNumber} deleted successfully.`,
      requestNumber: materialRequest.requestNumber
    });
  } catch (error) {
    console.error("Error in deleteMaterialRequest:", error);
    res.status(500).json({ message: error.message });
  }
};
