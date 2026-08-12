import asyncHandler from "express-async-handler";
import { Company } from "../../models/company/index.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";
import { employeeSchema } from "../../models/hr/index.js";

/**
 * 📊 Get SaaS Admin Dashboard Stats
 * GET /api/saasadmin/dashboard-stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get company counts
  const totalCompanies = await Company.countDocuments();
  const verifiedCompanies = await Company.countDocuments({ isVerified: true });
  const unverifiedCompanies = await Company.countDocuments({ isVerified: false });
  const suspendedCompanies = await Company.countDocuments({ isSuspended: true });

  // Calculate total system users across all tenant databases
  let totalUsers = 0;
  try {
    const allCompanies = await Company.find({}).select("_id dbName");
    for (const comp of allCompanies) {
      try {
        const dbName = comp.dbName || comp._id.toString();
        const UserModel = getTenantModel(dbName, "User", userSchema);
        const EmployeeModel = getTenantModel(dbName, "Employee", employeeSchema);

        const uCount = await UserModel.countDocuments().catch(() => 0);
        const eCount = await EmployeeModel.countDocuments().catch(() => 0);

        totalUsers += uCount + eCount;
      } catch (e) {
        /* Ignore single tenant DB error */
      }
    }
  } catch (err) {
    console.warn("Could not calculate total users for dashboard stats:", err.message);
  }

  // Get companies registered in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCompanies = await Company.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Get companies by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const companiesByMonth = await Company.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
  ]);

  // Get recent registrations (last 5)
  const recentRegistrations = await Company.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("companyName email city createdAt isVerified isSuspended companyId");

  const stats = {
    totalCompanies,
    verifiedCompanies,
    unverifiedCompanies,
    suspendedCompanies,
    totalUsers,
    recentCompanies,
    companiesByMonth,
    recentRegistrations,
  };

  res.status(200).json(new ApiResponse(200, stats, "Dashboard stats retrieved successfully"));
});
