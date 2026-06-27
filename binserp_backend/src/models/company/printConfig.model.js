import mongoose from "mongoose";

export const printConfigSchema = new mongoose.Schema({
  headerAlignment: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'center'
  },
  headerText: { type: String, default: '' },
  showCompanyDetails: { type: Boolean, default: true },
  footerText: { type: String, default: '' },
  termsAndConditions: { type: String, default: '' }
}, { _id: false });
