import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const userSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      enum: [
        "CEO",
        "MD",
        "Manager",
        "Admin",
        "Store",
        "Store Executive",
        "PPC",
        "PPC Executive",
        "HR",
        "HR Executive",
        "Accounts",
        "Quality",
        "Maintenance",
        "CRM",
        "Security",
        "Employee",
      ],
      required: true,
    },
    roleLevel: {
      type: Number,
      default: 1, // 1 = low-level, 10 = top admin (for flexibility)
    },
    photo: {
      type: String,
      default: ""
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
    // Security Fields
    allowedIP: {
      type: String, // IPv4 or IPv6
      default: ""
    },
    allowedLocation: {
      lat: Number,
      lng: Number,
      radius: { type: Number, default: 500 } // Radius in meters
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activatedAt: {
      type: Date,
    }
  },
  { timestamps: true }
);

// 🔐 Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// 🔑 Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return resetToken;
};

// export const User = mongoose.model("User", userSchema);
