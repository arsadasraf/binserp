import { visitorSchema } from "../models/visitor.model.js";

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

export const getAllVisitors = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const Visitor = req.getModel('Visitor', visitorSchema);
        const { start, end } = req.query;

        const query = { company: companyId };
        if (start && end) {
            query.checkInTime = { $gte: new Date(start), $lte: new Date(end) };
        }

        const visitors = await Visitor.find(query)
            .sort({ checkInTime: -1 });

        res.status(200).json({ visitors });
    } catch (error) {
        console.error("Error fetching all visitors:", error);
        res.status(500).json({ message: "Server error fetching visitors" });
    }
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
