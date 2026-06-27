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

export const createMachineAssignment = async (req, res) => {
  try {
    const MachineAssignment = req.getModel('MachineAssignment', machineAssignmentSchema);
    const companyId = getCompanyId(req);
    const {
      machine, date, shift, startTime, endTime,
      operator, helpers, job, jobDetail, targetQuantity, process, processName, remarks
    } = req.body;

    if (!machine || !date || !shift || !operator) {
      return res.status(400).json({ message: "Machine, date, shift and operator are required" });
    }

    const assignment = await MachineAssignment.create({
      company: companyId,
      machine, date, shift, startTime, endTime,
      operator, helpers: helpers || [], job, jobDetail, targetQuantity,
      process, processName, remarks
    });

    const populated = await MachineAssignment
      .findById(assignment._id)
      .populate('machine', 'machineName machineCode')
      .populate('operator', 'name employeeId')
      .populate('helpers', 'name employeeId')
      .populate('job', 'jobNumber partName')
      .populate('process', 'processName');

    res.status(201).json({ success: true, message: "Assignment created", assignment: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
