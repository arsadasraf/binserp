import express from "express";
import { upload } from "../middlewares/multer.middleware.js";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  createRouteCard,
  getAllRouteCards,
  getRouteCardById,
  updateRouteCard,
  createMachine,
  getAllMachines,
  updateMachine,
  deleteMachine,
  createManpower,
  getAllManpower,
  getManpowerMasterList,
  updateManpower,
  deleteManpower,
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
  createJob,
  getAllJobs,
  updateJob,
  autoSchedule,
  createComponent,
  getAllComponents,
  getComponentById,
  updateComponent,
  deleteComponent,
  promoteToInventory,
  createWorkOrder,
  getAllWorkOrders,
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
  getMachineSchedules,
  getEmployeeSchedules,
  createProcess,
  getAllProcesses,
  updateProcess,
  deleteProcess,
  createMachineCategory,
  getAllMachineCategories,
  updateMachineCategory,
  deleteMachineCategory,
  createMachineLocation,
  getAllMachineLocations,
  updateMachineLocation,
  deleteMachineLocation,
  createPPCOrder,
  getAllPPCOrders,
  createAllotment,
  getAllotments,
  deleteAllotment,

  upsertMachinePlan,
  getMachinePlans,
  createShift,
  getShifts,
  updateShift,
  deleteShift,
  confirmPPCOrder,
  getOrderMaterialPlan,
  getOrderJobs,
  updateMaterialRequirementStatus,
  getPlanningBacklog,
  getMachineSchedule,
  assignJobProcess,
  getProcurementDashboard,
  getPendingOutsourcedJobs,
  getDispatchQueue,
  markOrderAsDispatched,
  startJobProcess,
  completeJobProcess,
  getProductionReports
} from "../controllers/ppc.controller.js";
import {
  createMachineAssignment,
  getMachineAssignments,
  updateMachineAssignment,
  deleteMachineAssignment,
  createMaintenanceRecord,
  getMaintenanceRecords,
  updateMaintenanceRecord,
} from "../controllers/ppc.machine.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Order Routes
router.route("/order").post(upload.array("photos", 5), createOrder).get(getAllOrders);
router.route("/order/:id").get(getOrderById).put(updateOrder).delete(deleteOrder);

// Enhanced Order Routes
router.route("/ppc-order").post(upload.array("photos", 5), createPPCOrder).get(getAllPPCOrders);
router.route("/ppc-order/:id").put(upload.array("photos", 5), updateOrder).delete(deleteOrder);
router.route("/ppc-order/:id/confirm").post(confirmPPCOrder);
router.route("/ppc-order/:id/material-plan").get(getOrderMaterialPlan);
router.route("/ppc-order/:id/jobs").get(getOrderJobs);
router.route("/material-requirement/:id/item/:itemId").put(updateMaterialRequirementStatus);

// Planning Board Routes
router.route("/planning/backlog").get(getPlanningBacklog);
router.route("/planning/machine-schedule").get(getMachineSchedule);
router.route("/planning/assign").post(assignJobProcess);
router.route("/job/process/start").post(startJobProcess);
router.route("/job/process/complete").post(completeJobProcess);

// Procurement Dashboard
router.route("/procurement/dashboard").get(getProcurementDashboard);

// Job Work / Outsourcing
router.route("/jobwork/pending").get(getPendingOutsourcedJobs);

// Dispatch
router.route("/dispatch/queue").get(getDispatchQueue);
router.route("/dispatch/confirm").post(markOrderAsDispatched);

// Reports
router.route("/reports/production").get(getProductionReports);

// Auto-scheduling
router.route("/auto-schedule/:orderId").post(autoSchedule);

// Route Card Routes
router.route("/route-card").post(createRouteCard).get(getAllRouteCards);
router.route("/route-card/:id").get(getRouteCardById).put(updateRouteCard);

// Machine Routes
router.route("/machine").post(upload.array("photos", 5), createMachine).get(getAllMachines);
router.route("/machine/:id").put(upload.array("photos", 5), updateMachine).delete(deleteMachine);

// Process Routes
router.route("/process").post(createProcess).get(getAllProcesses);
router.route("/process/:id").put(updateProcess).delete(deleteProcess);

// Machine Category Routes
router.route("/machine-category").post(createMachineCategory).get(getAllMachineCategories);
router.route("/machine-category/:id").put(updateMachineCategory).delete(deleteMachineCategory);

// Machine Location Routes
router.route("/machine-location").post(createMachineLocation).get(getAllMachineLocations);
router.route("/machine-location/:id").put(updateMachineLocation).delete(deleteMachineLocation);

// Manpower Routes
router.route("/manpower").post(createManpower).get(getAllManpower);
router.route("/manpower/:id").put(updateManpower).delete(deleteManpower);
router.route("/manpower-master").get(getManpowerMasterList); // New Route for master list

// Manpower Allotment (Roster) Routes
router.route("/allotment").post(createAllotment).get(getAllotments);
router.route("/allotment/:id").delete(deleteAllotment);

// Skill Routes
router.route("/skill").post(createSkill).get(getAllSkills);
router.route("/skill/:id").put(updateSkill).delete(deleteSkill);

// Job Routes
router.route("/job").post(createJob).get(getAllJobs);
router.route("/job/:id").put(updateJob);

// Component Routes
router.post("/component", upload.any(), createComponent);
router.get("/component", getAllComponents);
router.get("/component/:id", getComponentById);
router.put("/component/:id", upload.any(), updateComponent);
router.delete("/component/:id", deleteComponent);
router.post("/component/:id/promote", promoteToInventory);

// Work Order Routes
router.route("/work-order").post(createWorkOrder).get(getAllWorkOrders);
router.route("/work-order/:id").get(getWorkOrderById).put(updateWorkOrder).delete(deleteWorkOrder);

// Schedule Query Routes
router.get("/machine/:id/schedules", getMachineSchedules);
router.get("/employee/:id/schedules", getEmployeeSchedules);

router.post("/machine-category", createMachineCategory);
router.get("/machine-category", getAllMachineCategories);
router.put("/machine-category/:id", updateMachineCategory);
router.delete("/machine-category/:id", deleteMachineCategory);

// Machine Plan Routes
// Machine Plan Routes
router.route("/machine-plan").post(upsertMachinePlan).get(getMachinePlans);

// Shift Management Routes
router.route("/shift").post(createShift).get(getShifts);
router.route("/shift/:id").put(updateShift).delete(deleteShift);

// Machine Assignment Routes (Planning tab - shift-wise operator+job assignment)
router.route("/machine-assignment").post(createMachineAssignment).get(getMachineAssignments);
router.route("/machine-assignment/:id").put(updateMachineAssignment).delete(deleteMachineAssignment);

// Machine Maintenance Routes
router.route("/machine-maintenance").post(createMaintenanceRecord).get(getMaintenanceRecords);
router.route("/machine-maintenance/:id").put(updateMaintenanceRecord);

export default router;
