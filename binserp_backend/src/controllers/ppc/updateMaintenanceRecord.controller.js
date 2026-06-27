import {
  machineSchema,
  machineAssignmentSchema,
  machineMaintenanceSchema,
} from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

// ========== MACHINE ASSIGNMENT MANAGEMENT ==========

export const updateMaintenanceRecord = async (req, res) => {
  try {
    const MachineMaintenance = req.getModel('MachineMaintenance', machineMaintenanceSchema);
    const Machine = req.getModel('Machine', machineSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const updates = { ...req.body };

    // If resolving/closing, set resolvedAt and restore machine to Available
    if (updates.status === 'Resolved' || updates.status === 'Closed') {
      if (!updates.resolvedAt) updates.resolvedAt = new Date();
      const existing = await MachineMaintenance.findById(id).lean();
      if (existing) await Machine.findByIdAndUpdate(existing.machine, { status: 'Available' });
    }

    const record = await MachineMaintenance.findOneAndUpdate(
      { _id: id, company: companyId },
      updates,
      { new: true, runValidators: true }
    )
      .populate('machine', 'machineName machineCode')
      .populate('reportedBy', 'name employeeId')
      .populate('resolvedBy', 'name employeeId');

    if (!record) return res.status(404).json({ message: "Record not found" });
    res.status(200).json({ success: true, message: "Record updated", record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
