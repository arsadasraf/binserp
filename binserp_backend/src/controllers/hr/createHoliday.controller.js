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

export const createHoliday = async (req, res) => {
  try {
    const Holiday = req.getModel('Holiday', holidaySchema);
    const companyId = getCompanyId(req);
    const { name, date, type } = req.body;

    if (!name || !date) {
      return res.status(400).json({ message: "Name and date are required" });
    }

    // Optional: Check if a holiday with same date exists
    const existing = await Holiday.findOne({ company: companyId, date: new Date(date) });
    if (existing) {
      return res.status(400).json({ message: "A holiday is already defined for this date" });
    }

    const holiday = await Holiday.create({
      company: companyId,
      name,
      date: new Date(date),
      type: type || 'Public'
    });

    res.status(201).json({ message: "Holiday created successfully", holiday });
  } catch (error) {
    console.error("Error creating holiday:", error);
    res.status(500).json({ message: "Error creating holiday", error: error.message });
  }
};
