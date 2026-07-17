import { holidaySchema } from "../../models/hr/index.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  if (!req.user) throw new Error("User context missing in request");
  if (req.userType === "company") return req.user.id;
  if (req.userType === "user" || req.userType === "saasadmin" || req.userType === "employee") {
    if (req.user.company && req.user.company._id) return req.user.company._id;
    if (req.user.company) return req.user.company;
  }
  throw new Error("Could not modify company ID from request context");
};

export const getAllHolidays = async (req, res) => {
  try {
    const Holiday = req.getModel('Holiday', holidaySchema);
    const companyId = getCompanyId(req);
    
    // Optional filtering by year/month if passed in query
    const { year, month } = req.query;
    
    let query = { company: companyId, isActive: true };
    
    if (year) {
      const startDate = new Date(year, month ? parseInt(month) - 1 : 0, 1);
      const endDate = new Date(year, month ? parseInt(month) : 12, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const holidays = await Holiday.find(query).sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    res.status(500).json({ message: "Error fetching holidays", error: error.message });
  }
};
