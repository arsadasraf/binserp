import { getTenantModel } from "../../db/tenant.js";
import { sessionHistorySchema } from "../../models/user/sessionHistory.model.js";

export const getSessionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // `req.company` should be set by verifyJWT if logged in as company
    const company = req.company;
    if (!company) {
      return res.status(404).json({ message: "Company not found for this request" });
    }

    const SessionHistoryModel = getTenantModel(company.dbName, "SessionHistory", sessionHistorySchema);

    // Fetch the last 5 records
    const history = await SessionHistoryModel.find({ userId })
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(5)
      .lean();

    res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching session history:", error);
    res.status(500).json({ message: error.message });
  }
};
