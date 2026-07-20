import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";

export const getActiveSessions = async (req, res) => {
  try {
    const UserModel = req.getModel("User", userSchema);
    const EmployeeModel = req.getModel("Employee", employeeSchema);

    // Active in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const users = await UserModel.find({
      lastActiveAt: { $gte: thirtyMinutesAgo },
    })
      .select("name userId email department roleLevel lastActiveAt photo")
      .lean();

    const employees = await EmployeeModel.find({
      lastActiveAt: { $gte: thirtyMinutesAgo },
    })
      .select("name employeeId email department roleLevel designation lastActiveAt photo")
      .lean();

    const formattedUsers = users.map(user => ({
      ...user,
      id: user._id,
      type: "user",
    }));

    const formattedEmployees = employees.map(emp => ({
      ...emp,
      id: emp._id,
      userId: emp.employeeId, // Normalize ID field
      type: "employee",
    }));

    const activeSessions = [...formattedUsers, ...formattedEmployees].sort(
      (a, b) => b.lastActiveAt - a.lastActiveAt
    );

    res.status(200).json(activeSessions);
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({ message: error.message });
  }
};
