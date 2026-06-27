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
