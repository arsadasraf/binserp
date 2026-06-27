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

export const deleteMachineAssignment = async (req, res) => {
  try {
    const MachineAssignment = req.getModel('MachineAssignment', machineAssignmentSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const rec = await MachineAssignment.findOneAndDelete({ _id: id, company: companyId });
    if (!rec) return res.status(404).json({ message: "Assignment not found" });
    res.status(200).json({ success: true, message: "Assignment deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== MACHINE MAINTENANCE MANAGEMENT ==========
