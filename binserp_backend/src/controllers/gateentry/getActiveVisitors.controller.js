import { visitorSchema } from "../../models/visitor/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const getActiveVisitors = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const Visitor = req.getModel('Visitor', visitorSchema);
        const visitors = await Visitor.find({ company: companyId, status: "Inside" })
            .sort({ checkInTime: -1 });

        res.status(200).json({ visitors });
    } catch (error) {
        console.error("Error fetching active visitors:", error);
        res.status(500).json({ message: "Server error fetching visitors" });
    }
};
