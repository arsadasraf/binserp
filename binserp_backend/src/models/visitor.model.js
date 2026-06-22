import mongoose from "mongoose";

export const visitorSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
        },
        purpose: {
            type: String,
            default: "",
        },

        companyName: {
            type: String,
            default: "",
        },
        whomToMeet: {
            type: String,
            default: "", // Could be Employee Name or specific person
        },
        address: {
            type: String, // Visitor's address
            default: "",
        },
        visitorPhoto: {
            type: String, // URL/Base64
            default: "",
        },

        checkInTime: {
            type: Date,
            default: Date.now,
        },
        checkOutTime: {
            type: Date,
        },
        status: {
            type: String,
            enum: ["Inside", "Left"],
            default: "Inside",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },
    { timestamps: true }
);

visitorSchema.index({ company: 1, status: 1 });
visitorSchema.index({ company: 1, checkInTime: -1 });

// export const Visitor = mongoose.model("Visitor", visitorSchema);
