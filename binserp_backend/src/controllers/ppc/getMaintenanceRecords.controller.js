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

export const getMaintenanceRecords = async (req, res) => {
  try {
    const MachineMaintenance = req.getModel('MachineMaintenance', machineMaintenanceSchema);
    const companyId = getCompanyId(req);
    const { machine, status, type } = req.query;

    const filter = { company: companyId };
    if (machine) filter.machine = machine;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const records = await MachineMaintenance.find(filter)
      .populate('machine', 'machineName machineCode machineType')
      .populate('reportedBy', 'name employeeId')
      .populate('resolvedBy', 'name employeeId')
      .sort({ reportedAt: -1 });

    res.status(200).json({ success: true, records, count: records.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
