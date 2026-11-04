import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { sessionHistorySchema } from "../../models/user/sessionHistory.model.js";

export const forceLogoutUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.body || {};

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const UserModel = req.getModel("User", userSchema);
    const EmployeeModel = req.getModel("Employee", employeeSchema);
    const SessionHistoryModel = req.getModel("SessionHistory", sessionHistorySchema);

    let targetDoc = null;
    let resolvedType = userType || "user";

    if (userType === "employee") {
      targetDoc = await EmployeeModel.findById(id).catch(() => null);
      if (!targetDoc) {
        targetDoc = await EmployeeModel.findOne({ employeeId: id });
      }
      resolvedType = "employee";
    } else {
      targetDoc = await UserModel.findById(id).catch(() => null);
      if (!targetDoc) {
        targetDoc = await UserModel.findOne({ userId: id });
      }
      if (!targetDoc) {
        targetDoc = await EmployeeModel.findById(id).catch(() => null);
        if (!targetDoc) {
          targetDoc = await EmployeeModel.findOne({ employeeId: id });
        }
        if (targetDoc) resolvedType = "employee";
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ message: "User or Employee not found" });
    }

    const prevDevice = targetDoc.currentDevice || targetDoc.lastDevice || {};
    targetDoc.refreshToken = null;
    targetDoc.currentDevice = undefined;
    targetDoc.tokenVersion = (targetDoc.tokenVersion || 0) + 1;
    await targetDoc.save({ validateBeforeSave: false });

    const clientIP = req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "Unknown";
    await SessionHistoryModel.create({
      userId: resolvedType === "user" ? targetDoc.userId : targetDoc.employeeId,
      userType: resolvedType,
      action: "force_logout",
      ipAddress: String(clientIP).split(",")[0].trim(),
      deviceInfo: prevDevice,
    });

    return res.status(200).json({
      message: `${targetDoc.name} has been forcefully logged out from all active devices.`,
    });
  } catch (error) {
    console.error("Error forcing user logout:", error);
    return res.status(500).json({ message: error.message });
  }
};

