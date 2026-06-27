import mongoose from "mongoose";

// Spare Parts Inventory Schema
export const sparePartSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        partName: {
            type: String,
            required: true,
        },
        partCode: {
            type: String,
            required: true,
        },
        category: String, // e.g., "Electrical", "Mechanical"
        specifications: String,
        currentStock: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        minStockLevel: {
            type: Number,
            default: 5, // Alert threshold
        },
        unitPrice: {
            type: Number,
            default: 0,
        },
        location: String, // Rack/Bin number
        compatibleMachines: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Machine",
            },
        ],
        supplier: String,
    },
    { timestamps: true }
);

// Indexes
sparePartSchema.index({ company: 1, partCode: 1 });