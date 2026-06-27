import { visitorSchema } from "../../models/visitor/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const checkOutVisitor = async (req, res) => {
    try {
        const { id } = req.params;
        const Visitor = req.getModel('Visitor', visitorSchema);
        const visitor = await Visitor.findById(id);

        if (!visitor) {
            return res.status(404).json({ message: "Visitor not found" });
        }

        if (visitor.status === "Left") {
            return res.status(400).json({ message: "Visitor already checked out" });
        }

        visitor.status = "Left";
        visitor.checkOutTime = new Date();
        await visitor.save();

        res.status(200).json({ message: "Visitor checked out successfully", visitor });
    } catch (error) {
        console.error("Error checking out visitor:", error);
        res.status(500).json({ message: "Server error checking out visitor" });
    }
};
