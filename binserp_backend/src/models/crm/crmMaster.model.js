import mongoose from "mongoose";

export const crmMasterSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["source", "stage", "industry", "lossReason", "product", "team"],
            trim: true
        },
        name: { type: String, required: true, trim: true },
        code: { type: String, trim: true },
        color: { type: String, default: "#3b82f6" },
        order: { type: Number, default: 0 },
        probability: { type: Number, default: 0, min: 0, max: 100 }, // for stages
        description: { type: String, trim: true },
        unitPrice: { type: Number, default: 0 }, // for product catalog
        unit: { type: String, default: "PCS" }, // for product catalog
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },
    { timestamps: true }
);

crmMasterSchema.index({ company: 1, type: 1, name: 1 }, { unique: true });
