import mongoose from "mongoose";

const policySchema = new mongoose.Schema({
  module: { type: String, required: true },
  tabs: [{
    name: { type: String, required: true },
    actions: [{ type: String, enum: ['read', 'create', 'update', 'delete', 'all'] }]
  }]
});

export const roleSchema = new mongoose.Schema(
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
    description: {
      type: String,
      default: "",
    },
    policies: [policySchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

// export const Role = mongoose.model("Role", roleSchema);
