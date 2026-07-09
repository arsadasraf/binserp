import mongoose from "mongoose";

export const manpowerAllotmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // Link to HR Employee
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    shift: {
      type: String,
      required: true,
    },
    startTime: String, // "HH:MM", required for Custom, auto-filled for others
    endTime: String,   // "HH:MM"
    machines: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
    }],
    remarks: String,
  },
  { timestamps: true }
);

// Indexes


// export const PPCOrder = mongoose.model("PPCOrder", ppcOrderSchema);
// export const Order = mongoose.model("Order", orderSchema);
// export const RouteCard = mongoose.model("RouteCard", routeCardSchema);
// export const Machine = mongoose.model("Machine", machineSchema);
// export const Manpower = mongoose.model("Manpower", manpowerSchema);
// export const Job = mongoose.model("Job", jobSchema);
// export const Component = mongoose.model("Component", componentSchema);

// Indexes
manpowerAllotmentSchema.index({ company: 1, employee: 1, date: 1, shift: 1 }, { unique: true }); // One allotment per shift per day per employee
