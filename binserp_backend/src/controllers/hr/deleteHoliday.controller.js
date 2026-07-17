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

export const deleteHoliday = async (req, res) => {
  try {
    const Holiday = req.getModel('Holiday', holidaySchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const holiday = await Holiday.findOneAndDelete({ _id: id, company: companyId });

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.status(200).json({ message: "Holiday deleted successfully" });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    res.status(500).json({ message: "Error deleting holiday", error: error.message });
  }
};
