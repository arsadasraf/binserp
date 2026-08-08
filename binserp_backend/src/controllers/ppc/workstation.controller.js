import {
  workstationSchema,
  machineSchema,
  processSchema,
  machineLocationSchema,
  machineCategorySchema
} from "../../models/ppc/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

// Generate workstation code if missing
const generateWorkstationCode = async (Workstation, companyId) => {
  const count = await Workstation.countDocuments({ company: companyId });
  return `WS-${String(count + 1).padStart(3, '0')}`;
};

export const createWorkstation = asyncHandler(async (req, res) => {
  const Workstation = req.getModel('Workstation', workstationSchema);
  const companyId = getCompanyId(req);

  let { workstationCode, workstationName, workstationType, location, category, machines, processes, hourlyRate, capacityHoursPerDay, status, description } = req.body;

  if (!workstationName || !workstationName.trim()) {
    return res.status(400).json({ success: false, message: "Workstation Name is required" });
  }

  if (!workstationCode || !workstationCode.trim()) {
    workstationCode = await generateWorkstationCode(Workstation, companyId);
  }

  // Parse JSON strings if passed as string
  if (typeof machines === 'string') machines = JSON.parse(machines);
  if (typeof processes === 'string') processes = JSON.parse(processes);

  const workstationData = {
    company: companyId,
    workstationCode: workstationCode.trim(),
    workstationName: workstationName.trim(),
    workstationType: workstationType || "INDIVIDUAL_MACHINE",
    location: location || undefined,
    category: category || undefined,
    machines: Array.isArray(machines) ? machines.filter(Boolean) : [],
    processes: Array.isArray(processes) ? processes.filter(Boolean) : [],
    hourlyRate: Number(hourlyRate || 0),
    capacityHoursPerDay: Number(capacityHoursPerDay || 8),
    status: status || "Active",
    description: description || ""
  };

  const newWorkstation = await Workstation.create(workstationData);
  res.status(201).json({ success: true, workstation: newWorkstation });
});

export const getWorkstations = asyncHandler(async (req, res) => {
  req.getModel('Machine', machineSchema);
  req.getModel('Process', processSchema);
  req.getModel('MachineLocation', machineLocationSchema);
  req.getModel('MachineCategory', machineCategorySchema);

  const Workstation = req.getModel('Workstation', workstationSchema);
  const companyId = getCompanyId(req);

  const workstations = await Workstation.find({ company: companyId })
    .populate('machines', 'machineCode machineName machineType status make')
    .populate('processes', 'processCode processName description defaultCycleTime')
    .populate('location', 'locationCode locationName')
    .populate('category', 'categoryCode categoryName')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, workstations, count: workstations.length });
});

export const getWorkstationById = asyncHandler(async (req, res) => {
  req.getModel('Machine', machineSchema);
  req.getModel('Process', processSchema);
  req.getModel('MachineLocation', machineLocationSchema);
  req.getModel('MachineCategory', machineCategorySchema);

  const Workstation = req.getModel('Workstation', workstationSchema);
  const companyId = getCompanyId(req);

  const workstation = await Workstation.findOne({ _id: req.params.id, company: companyId })
    .populate('machines')
    .populate('processes')
    .populate('location')
    .populate('category');

  if (!workstation) {
    return res.status(404).json({ success: false, message: "Workstation not found" });
  }

  res.status(200).json({ success: true, workstation });
});

export const updateWorkstation = asyncHandler(async (req, res) => {
  const Workstation = req.getModel('Workstation', workstationSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  let { workstationCode, workstationName, workstationType, location, category, machines, processes, hourlyRate, capacityHoursPerDay, status, description } = req.body;

  if (typeof machines === 'string') machines = JSON.parse(machines);
  if (typeof processes === 'string') processes = JSON.parse(processes);

  const updateData = {};
  if (workstationCode) updateData.workstationCode = workstationCode.trim();
  if (workstationName) updateData.workstationName = workstationName.trim();
  if (workstationType) updateData.workstationType = workstationType;
  if (location !== undefined) updateData.location = location || undefined;
  if (category !== undefined) updateData.category = category || undefined;
  if (Array.isArray(machines)) updateData.machines = machines.filter(Boolean);
  if (Array.isArray(processes)) updateData.processes = processes.filter(Boolean);
  if (hourlyRate !== undefined) updateData.hourlyRate = Number(hourlyRate);
  if (capacityHoursPerDay !== undefined) updateData.capacityHoursPerDay = Number(capacityHoursPerDay);
  if (status) updateData.status = status;
  if (description !== undefined) updateData.description = description;

  const updatedWorkstation = await Workstation.findOneAndUpdate(
    { _id: id, company: companyId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedWorkstation) {
    return res.status(404).json({ success: false, message: "Workstation not found" });
  }

  res.status(200).json({ success: true, workstation: updatedWorkstation });
});

export const deleteWorkstation = asyncHandler(async (req, res) => {
  const Workstation = req.getModel('Workstation', workstationSchema);
  const companyId = getCompanyId(req);

  const deletedWorkstation = await Workstation.findOneAndDelete({ _id: req.params.id, company: companyId });

  if (!deletedWorkstation) {
    return res.status(404).json({ success: false, message: "Workstation not found" });
  }

  res.status(200).json({ success: true, message: "Workstation deleted successfully" });
});
