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

export const updateMachineAssignment = async (req, res) => {
  try {
    const MachineAssignment = req.getModel('MachineAssignment', machineAssignmentSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const assignment = await MachineAssignment.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    )
      .populate('machine', 'machineName machineCode')
      .populate('operator', 'name employeeId')
      .populate('helpers', 'name employeeId')
      .populate('job', 'jobNumber partName')
      .populate('process', 'processName');

    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.status(200).json({ success: true, message: "Assignment updated", assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
