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

export const getMachineAssignments = async (req, res) => {
  try {
    const MachineAssignment = req.getModel('MachineAssignment', machineAssignmentSchema);
    const companyId = getCompanyId(req);
    const { machine, date, startDate, endDate, shift } = req.query;

    const filter = { company: companyId };
    if (machine) filter.machine = machine;
    if (shift) filter.shift = shift;
    if (date) {
      const d = new Date(date);
      const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
      const dayEnd   = new Date(d); dayEnd.setHours(23,59,59,999);
      filter.date = { $gte: dayStart, $lte: dayEnd };
    } else if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const assignments = await MachineAssignment.find(filter)
      .populate('machine', 'machineName machineCode machineType')
      .populate('operator', 'name employeeId')
      .populate('helpers', 'name employeeId')
      .populate('job', 'jobNumber partName status')
      .populate('process', 'processName processCode')
      .sort({ date: 1, shift: 1 });

    res.status(200).json({ success: true, assignments, count: assignments.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
