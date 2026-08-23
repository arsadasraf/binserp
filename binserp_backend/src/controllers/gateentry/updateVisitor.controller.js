import { visitorSchema } from "../../models/visitor/index.js";

// Helper to get company from request
const getCompanyId = (req) => {
    if (req.userType === "company") return req.user._id;
    return req.user.company?._id || req.user.company;
};

export const updateVisitor = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const Visitor = req.getModel('Visitor', visitorSchema);

        const visitor = await Visitor.findOne({ _id: id, company: companyId });
        if (!visitor) {
            return res.status(404).json({ message: "Visitor log not found" });
        }

        // Check 5-minute window from creation / check-in
        const referenceTime = visitor.createdAt || visitor.checkInTime;
        const diffMins = (Date.now() - new Date(referenceTime).getTime()) / (60 * 1000);

        if (diffMins > 5) {
            return res.status(400).json({
                message: `Edit window (5 minutes) has expired. This log was created ${Math.floor(diffMins)} minutes ago and can no longer be edited.`
            });
        }

        const { name, phone, purpose, companyName, whomToMeet, address, visitorPhoto } = req.body;

        if (name) visitor.name = name.trim();
        if (phone) visitor.phone = phone.trim();
        if (purpose !== undefined) visitor.purpose = purpose;
        if (companyName !== undefined) visitor.companyName = companyName.trim();
        if (whomToMeet !== undefined) visitor.whomToMeet = whomToMeet.trim();
        if (address !== undefined) visitor.address = address.trim();
        if (visitorPhoto !== undefined) visitor.visitorPhoto = visitorPhoto;

        await visitor.save();

        res.status(200).json({ message: "Visitor log updated successfully", visitor });
    } catch (error) {
        console.error("Error updating visitor log:", error);
        res.status(500).json({ message: "Server error updating visitor log" });
    }
};
