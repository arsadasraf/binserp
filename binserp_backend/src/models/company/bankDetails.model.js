import mongoose from "mongoose";

export const bankDetailsSchema = new mongoose.Schema({
  accountName: { type: String, default: '' },
  bankName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },
  branch: { type: String, default: '' }
}, { _id: false });
