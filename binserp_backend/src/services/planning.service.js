import { inventorySchema, bomSchema } from "../models/store/index.js";
import { machineSchema, manpowerSchema, jobSchema, ppcOrderSchema } from "../models/ppc.model.js";

/**
 * Auto-schedule a PPCOrder with rule-based optimization algorithm
 */
export const autoScheduleOrder = async (req, order, companyId) => {
  try {
    // Initialize Models
    const Inventory = req.getModel('Inventory', inventorySchema);
    const Machine = req.getModel('Machine', machineSchema);
    const Manpower = req.getModel('Manpower', manpowerSchema);
    const Job = req.getModel('Job', jobSchema);
    const Order = req.getModel('PPCOrder', ppcOrderSchema);

    // Step 1: Check RM availability across all items
    const rmAvailabilityCheck = await checkRMAvailability(order, companyId, Inventory);
    if (!rmAvailabilityCheck.available) {
      return {
        success: false,
        message: "Raw materials not available",
        details: rmAvailabilityCheck.missingMaterials,
      };
    }

    const dispatchDate = new Date(order.dispatchDate || order.deliveryDate || new Date());
    let totalJobs = [];
    let earliestStartDate = new Date(dispatchDate);

    // Loop through each item in the order
    for (const item of order.items) {
      if (!item.processSnapshot || item.processSnapshot.length === 0) continue;

      const processes = item.processSnapshot;
      
      // Calculate total production time needed for this item
      let totalTimeMinutes = 0;
      for (const process of processes) {
        totalTimeMinutes += (process.standardTime || 60) * item.quantity;
      }

      // Buffer
      const totalTimeWithBuffer = totalTimeMinutes * 1.2;
      const daysNeeded = Math.ceil(totalTimeWithBuffer / (8 * 60));

      const startDate = new Date(dispatchDate);
      startDate.setDate(startDate.getDate() - daysNeeded);
      if (startDate < earliestStartDate) earliestStartDate = startDate;

      let currentStartDate = new Date(startDate);
      const itemJobs = [];

      for (let i = 0; i < processes.length; i++) {
        const process = processes[i];

        // 1. Assign Machine
        let selectedMachine = null;
        if (process.machine) {
          // Explicit machine assigned in snapshot
          selectedMachine = await Machine.findOne({ _id: process.machine, company: companyId });
        }

        if (!selectedMachine) {
          // Find any available machine if none specified or not found
          const availableMachines = await Machine.find({
            company: companyId,
            status: "Available",
            availability: { $gt: 0 },
          }).sort({ availability: -1 });
          
          if (availableMachines.length > 0) {
            selectedMachine = availableMachines[0];
          }
        }

        if (!selectedMachine && !process.isJobWork) {
          return {
            success: false,
            message: `No available machines found for process: ${process.processName} on item ${item.productName}`,
            details: { process: process.processName, product: item.productName },
          };
        }

        // 2. Assign Manpower
        let availableManpower = await Manpower.find({
          company: companyId,
          status: "Available",
          availability: { $gt: 0 },
        }).populate("employee");

        // Simple assignment: pick the one with lowest load
        let selectedManpower = null;
        if (availableManpower.length > 0 && !process.isJobWork) {
          selectedManpower = availableManpower.sort((a, b) => (a.currentLoad || 0) - (b.currentLoad || 0))[0];
        }

        // Calculate duration
        const operationDurationMinutes = (process.standardTime || 60) * item.quantity;
        const operationEndDate = new Date(currentStartDate);
        operationEndDate.setMinutes(operationEndDate.getMinutes() + operationDurationMinutes);

        // 3. Create Job
        const jobNumber = `JOB-${order.orderNumber}-${item.productName?.substring(0,3).toUpperCase()}-${i + 1}-${Date.now().toString().slice(-4)}`;
        const jobData = {
          company: companyId,
          jobNumber,
          order: order._id,
          product: item.product,
          partName: item.productName,
          operation: {
            operationName: process.processName,
            sequence: i + 1,
            standardTime: process.standardTime,
          },
          scheduledStart: currentStartDate,
          scheduledEnd: operationEndDate,
          quantity: item.quantity,
          status: "Scheduled",
          isJobWork: process.isJobWork || false,
        };

        if (selectedMachine) {
          jobData.assignedMachine = selectedMachine._id;
          
          // Update machine
          selectedMachine.availability = Math.max(0, (selectedMachine.availability || 100) - (operationDurationMinutes / 480) * 100);
          if (selectedMachine.availability < 20) selectedMachine.status = "Busy";
          await selectedMachine.save();
        }

        if (selectedManpower) {
          jobData.assignedManpower = [selectedManpower._id];
          
          // Update manpower
          selectedManpower.currentLoad = (selectedManpower.currentLoad || 0) + (operationDurationMinutes / 480) * 100;
          if (selectedManpower.currentLoad > 80) selectedManpower.status = "Busy";
          await selectedManpower.save();
        }

        const job = await Job.create(jobData);
        itemJobs.push(job._id);
        totalJobs.push(job);

        currentStartDate = new Date(operationEndDate);
      }

      // Link jobs to item
      item.jobs = itemJobs;
    }

    // Update order status and items
    order.status = "Planning";
    await order.save();

    return {
      success: true,
      message: "Order scheduled successfully",
      jobs: totalJobs,
      schedule: {
        startDate: earliestStartDate,
        dispatchDate: dispatchDate,
        operationsCount: totalJobs.length,
      },
    };
  } catch (error) {
    console.error("AutoSchedule Error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Check RM availability from Inventory using item bomSnapshots
 */
const checkRMAvailability = async (order, companyId, Inventory) => {
  try {
    const missingMaterials = [];
    const materialRequirements = {};

    // Aggregate all required materials
    for (const item of order.items) {
      if (!item.bomSnapshot || item.bomSnapshot.length === 0) continue;

      for (const bomItem of item.bomSnapshot) {
        const key = bomItem.item ? bomItem.item.toString() : bomItem.itemName;
        const requiredQty = bomItem.quantity * item.quantity;

        if (!materialRequirements[key]) {
          materialRequirements[key] = {
            itemName: bomItem.itemName,
            itemRef: bomItem.item,
            required: 0
          };
        }
        materialRequirements[key].required += requiredQty;
      }
    }

    // Check against inventory
    for (const key of Object.keys(materialRequirements)) {
      const mat = materialRequirements[key];
      let inventoryQuery = { company: companyId };
      
      // If we have an ObjectId reference, use it, otherwise search by name
      if (mat.itemRef && mat.itemRef.length === 24) {
        // Wait, store inventory uses 'material' ObjectId or 'materialName'?
        inventoryQuery.$or = [
          { material: mat.itemRef },
          { materialName: mat.itemName }
        ];
      } else {
        inventoryQuery.materialName = mat.itemName;
      }

      const inventory = await Inventory.findOne(inventoryQuery);
      const availableQty = inventory ? inventory.currentStock : 0;

      if (availableQty < mat.required) {
        missingMaterials.push({
          materialName: mat.itemName,
          required: mat.required,
          available: availableQty,
          shortage: mat.required - availableQty,
        });
      }
    }

    return {
      available: missingMaterials.length === 0,
      missingMaterials,
    };
  } catch (error) {
    console.error("RMAvailability Error:", error);
    return {
      available: false,
      error: error.message,
    };
  }
};
