import mongoose from "mongoose";

export const vehicleSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        name: { // Driver Name
            type: String,
            required: true,
            trim: true,
        },
        phone: { // Driver Phone
            type: String,
            required: true,
        },
        vehicleNumber: {
            type: String,
            required: true,
        },
        companyName: { // Logistics/Vendor company
            type: String,
            default: "",
        },
        goodsType: {
            type: String,
            default: "",
        },
        purpose: { // Remarks
            type: String,
            default: "",
        },
        address: {
            type: String,
            default: "",
        },
        documentPhotos: { // Document/ID Photos
            type: [String],
            default: [],
        },
        vehiclePhotos: { // Vehicle Photos
            type: [String],
            default: [],
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
        direction: {
            type: String,
            enum: ["Inward", "Outward"],
            default: "Inward",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        checkedOutBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },
    { timestamps: true }
);

vehicleSchema.index({ company: 1, status: 1 });
vehicleSchema.index({ company: 1, checkInTime: -1 });

// export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
