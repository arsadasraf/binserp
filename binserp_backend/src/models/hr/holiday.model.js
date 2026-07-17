import mongoose from "mongoose";

export const holidaySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['Public', 'Optional', 'Company'],
        default: 'Public'
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });
