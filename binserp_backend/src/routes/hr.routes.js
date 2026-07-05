import express from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  recordAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
  createDesignation,
  getAllDesignations,
  updateDesignation,
  deleteDesignation,
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
  createEmployeeType,
  getAllEmployeeTypes,
  updateEmployeeType,
  deleteEmployeeType,
  getDashboardStats,
  getEmployeeDashboardData,
  assignJob,
  getEmployeeJobs,
  updateEmployeeJobStatus,
} from "../controllers/hr/index.js";
import { verifyJWT, restrictExecutive } from "../middlewares/auth.middleware.js";
import { resolveTenant } from "../middlewares/tenant.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { trainFace, markAttendance, checkPythonHealth } from "../controllers/hr/index.js";
import { createSalarySlip, getSalaries, updateSalary, deleteSalary, getSalaryGenerationStats } from "../controllers/hr/index.js";
const router = express.Router();

// All routes require authentication
router.use(verifyJWT);
router.use(resolveTenant);

// Restrict Master routes for Executives
router.use(["/department", "/designation", "/skill", "/employee-type"], restrictExecutive);

// Employee routes
router.get("/stats", getDashboardStats);
router.get("/dashboard/me", getEmployeeDashboardData);

// Employee Job Routes (New)
router.post("/job/assign", assignJob); // Admin/Manager assigns
router.get("/job/me", getEmployeeJobs); // Employee view
router.put("/job/:id/status", updateEmployeeJobStatus); // Employee update status

router.post("/employee", upload.single("photo"), createEmployee);
router.get("/employee", getAllEmployees);
router.get("/employee/:id", getEmployeeById);
router.put("/employee/:id", upload.single("photo"), updateEmployee);
router.put("/employee/:id/toggle-status", toggleEmployeeStatus);
router.delete("/employee/:id", deleteEmployee);

// Attendance routes
router.post("/attendance", upload.single("photo"), recordAttendance);
router.get("/attendance", getAllAttendance);
router.get("/attendance/employee/:employeeId", getAttendanceByEmployee);

// Department routes
router.post("/department", createDepartment);
router.get("/department", getAllDepartments);
router.put("/department/:id", updateDepartment);
router.delete("/department/:id", deleteDepartment);

// Designation routes
router.post("/designation", createDesignation);
router.get("/designation", getAllDesignations);
router.put("/designation/:id", updateDesignation);
router.delete("/designation/:id", deleteDesignation);

// Skill Routes
router.post("/skill", createSkill);
router.get("/skill", getAllSkills);
router.put("/skill/:id", updateSkill);
router.delete("/skill/:id", deleteSkill);

// Employee Type Routes
router.post("/employee-type", createEmployeeType);
router.get("/employee-type", getAllEmployeeTypes);
router.put("/employee-type/:id", updateEmployeeType);
router.delete("/employee-type/:id", deleteEmployeeType);

router.post("/face-data", upload.array("files", 5), trainFace);
router.post("/mark-attendance", upload.single("file"), markAttendance);
router.get("/python-health", checkPythonHealth);

// Salary Routes
router.post("/salary", createSalarySlip);
router.get("/salary", getSalaries);
router.get("/salary/stats", getSalaryGenerationStats);
router.put("/salary/:id", updateSalary);
router.delete("/salary/:id", deleteSalary);

export default router;

