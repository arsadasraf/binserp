import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { signPhotos } from "../../utils/s3.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const computeIsSessionActive = (entity) => {
  if (!entity.refreshToken) return false;
  if (entity.isActive === false) return false;
  if (entity.status && entity.status !== "Active") return false;

  const accessMode = entity.currentDevice?.accessMode || "Browser";
  if (accessMode === "App") {
    // Installed App sessions are permanent until explicit logout or another device login
    return true;
  }

  // Web Browser sessions expire after 24 hours
  const loggedInAt = entity.currentDevice?.loggedInAt
    ? new Date(entity.currentDevice.loggedInAt).getTime()
    : (entity.lastActiveAt ? new Date(entity.lastActiveAt).getTime() : 0);

  if (!loggedInAt) return true;
  return Date.now() - loggedInAt < DAY_MS;
};

export const getActiveSessions = async (req, res) => {
  try {
    const UserModel = req.getModel("User", userSchema);
    const EmployeeModel = req.getModel("Employee", employeeSchema);

    const [users, employees] = await Promise.all([
      UserModel.find({})
        .select("name userId email department roleLevel isActive refreshToken lastActiveAt currentDevice lastDevice photo")
        .lean(),
      EmployeeModel.find({})
        .select("name employeeId email department roleLevel designation status isActive refreshToken lastActiveAt currentDevice lastDevice photo")
        .lean(),
    ]);

    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const isOnline = computeIsSessionActive(user);
        const signedPhoto = user.photo ? (await signPhotos([user.photo]))[0] : "";
        return {
          id: user._id,
          _id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          department: user.department,
          roleLevel: user.roleLevel,
          photo: signedPhoto,
          type: "user",
          isActiveAccount: user.isActive !== false,
          isOnline,
          lastActiveAt: user.lastActiveAt || user.currentDevice?.loggedInAt || null,
          currentDevice: isOnline ? (user.currentDevice || null) : null,
          lastDevice: user.lastDevice || user.currentDevice || null,
        };
      })
    );

    const formattedEmployees = await Promise.all(
      employees.map(async (emp) => {
        const isOnline = computeIsSessionActive(emp);
        const signedPhoto = emp.photo ? (await signPhotos([emp.photo]))[0] : "";
        return {
          id: emp._id,
          _id: emp._id,
          userId: emp.employeeId,
          name: emp.name,
          email: emp.email,
          department: emp.department,
          designation: emp.designation,
          roleLevel: emp.roleLevel,
          photo: signedPhoto,
          type: "employee",
          isActiveAccount: emp.isActive !== false && emp.status === "Active",
          isOnline,
          lastActiveAt: emp.lastActiveAt || emp.currentDevice?.loggedInAt || null,
          currentDevice: isOnline ? (emp.currentDevice || null) : null,
          lastDevice: emp.lastDevice || emp.currentDevice || null,
        };
      })
    );

    const allSessions = [...formattedUsers, ...formattedEmployees].sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }
      const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    res.status(200).json(allSessions);
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({ message: error.message });
  }
};
