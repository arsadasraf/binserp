import mongoose from "mongoose";

export const sessionHistorySchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  userType: { 
    type: String, 
    enum: ["user", "employee", "company"], 
    required: true 
  },
  action: { 
    type: String, 
    enum: ["login", "logout"], 
    required: true 
  },
  ipAddress: { 
    type: String,
    default: "Unknown"
  },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    city: { type: String, default: null },
    region: { type: String, default: null },
    country: { type: String, default: null }
  }
}, { timestamps: true });

// We won't globally register this model because it belongs in the tenant database
