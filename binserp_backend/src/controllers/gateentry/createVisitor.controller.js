import { visitorSchema } from "../../models/visitor/index.js";

// Helper to get company from request (middleware usually attaches it)
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const createVisitor = async (req, res) => {
    try {
        const { name, phone, purpose, visitorPhoto, companyName, whomToMeet, address } = req.body;
        const companyId = getCompanyId(req);
        const Visitor = req.getModel('Visitor', visitorSchema);

        if (!name || !phone) {
            return res.status(400).json({ message: "Name and Phone are required" });
        }

        const newVisitor = new Visitor({
            company: companyId,
            name,
            phone,
            purpose,
            visitorPhoto,
            companyName,
            whomToMeet,
            address,
            createdBy: req.user._id,
            status: "Inside"
        });

        await newVisitor.save();

        res.status(201).json({ message: "Visitor checked in successfully", visitor: newVisitor });
    } catch (error) {
        console.error("Error creating visitor:", error);
        res.status(500).json({ message: "Server error checking in visitor" });
    }
};
