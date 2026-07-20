import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { bankDetailsSchema } from "./bankDetails.model.js";
import { printConfigSchema } from "./printConfig.model.js";

// Define company schema
export const companySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, "Company name is required"],
    unique: true,
    trim: true
  },
  companyType: {
    type: String,
    enum: ["Job Work / Contract Manufacturing", "OEM (Own Product Manufacturer)", "Supplier / Component Supplier"],
    required: [true, "Company type is required"]
  },
  service: {
    type: String,
    enum: [
      "Sheet Metal Fabrication",
      "CNC Machining",
      "Foundry / Casting",
      "Forging",
      "Plastic Injection Molding",
      "Rubber Molding",
      "Electrical & Electronics Manufacturing",
      "Packaging Manufacturing",
      "Textile & Garment Manufacturing",
      "Surface Treatment & Coating"
    ],
    required: [true, "Service type is required"]
  },
  companyId: {
    type: String,
    required: [true, "Company ID is required"],
    unique: true,
    trim: true,
    index: true
  },
  dbName: {
    type: String,
    required: [true, "Database name is required"],
    unique: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
  },
  contactNumber: {
    type: String,
    required: [true, "Contact number is required"],
    unique: true,
    match: [/^\d{10,15}$/, "Contact number must be between 10-15 digits"]
  },
  state: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"]
  },
  pincode: {
    type: String,
    required: false
  },

  logo: {
    type: String,
    default: ""
  },
  // Suspension fields
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String,
    default: ""
  },
  suspendedAt: {
    type: Date,
    default: null
  },
  // Email verification fields
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: ""
  },
  verificationCodeExpires: {
    type: Date,
    default: null
  },
  // Password reset fields
  passwordResetToken: {
    type: String,
    default: ""
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
  }
}, { timestamps: true });


// 🧠 Pre-save Hook — Hash password automatically
companySchema.pre("save", async function (next) {
  // Only hash if password is new or modified
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});



// ... existing schema methods ...

// 🔍 Method to compare password during login
companySchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ... existing schema ...
companySchema.add({
  billingAddress: { type: String, default: '' },
  shippingAddress: { type: String, default: '' },
  qualitySpecs: { type: String, default: '' },
  commercialTerms: { type: String, default: '' },
  bankDetails: { type: bankDetailsSchema, default: () => ({}) },
  printSettings: {
    po: { type: printConfigSchema, default: () => ({}) },
    dc: { type: printConfigSchema, default: () => ({}) },
    invoice: { type: printConfigSchema, default: () => ({}) }
  }
});

// 📧 Generate 6-digit verification code
companySchema.methods.generateVerificationCode = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verificationCode = code;
  this.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return code;
};

// 🔑 Generate password reset token
companySchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return resetToken;
};


export const Company = mongoose.model("Company", companySchema);
