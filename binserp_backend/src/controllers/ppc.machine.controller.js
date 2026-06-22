import {
  machineSchema,
  machineAssignmentSchema,
  machineMaintenanceSchema,
} from "../models/ppc.model.js";

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

export const createMaintenanceRecord = async (req, res) => {
  try {
    const MachineMaintenance = req.getModel('MachineMaintenance', machineMaintenanceSchema);
    const Machine = req.getModel('Machine', machineSchema);
    const companyId = getCompanyId(req);

    const { machine, type, reportedBy, description, severity, sparesUsed, photos, remarks } = req.body;

    if (!machine || !type || !description) {
      return res.status(400).json({ message: "Machine, type and description are required" });
    }

    const record = await MachineMaintenance.create({
      company: companyId,
      machine, type, reportedBy, description,
      severity: severity || 'Medium',
      sparesUsed: sparesUsed || [],
      photos: photos || [],
      remarks,
      reportedAt: new Date()
    });

    // Auto-update machine status
    if (type === 'Breakdown') {
      await Machine.findByIdAndUpdate(machine, { status: 'Breakdown' });
    } else if (['Preventive', 'Corrective', 'Inspection'].includes(type)) {
      await Machine.findByIdAndUpdate(machine, { status: 'Maintenance' });
    }

    const populated = await MachineMaintenance.findById(record._id)
      .populate('machine', 'machineName machineCode')
      .populate('reportedBy', 'name employeeId');

    res.status(201).json({ success: true, message: "Maintenance record created", record: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
