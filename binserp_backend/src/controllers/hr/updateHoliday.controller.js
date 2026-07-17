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

export const updateHoliday = async (req, res) => {
  try {
    const Holiday = req.getModel('Holiday', holidaySchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { name, date, type, isActive } = req.body;

    const holiday = await Holiday.findOneAndUpdate(
      { _id: id, company: companyId },
      { name, date, type, isActive },
      { new: true }
    );

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.status(200).json({ message: "Holiday updated successfully", holiday });
  } catch (error) {
    console.error("Error updating holiday:", error);
    res.status(500).json({ message: "Error updating holiday", error: error.message });
  }
};
