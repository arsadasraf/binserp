import { Router } from "express";
import { verifyJWT, requirePermission } from "../middlewares/auth.middleware.js";
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  getPermissionSchema,
} from "../controllers/role.controller.js";

const router = Router();

router.use(verifyJWT);

// Schema can be fetched by anyone with admin role/user access
router.get("/schema", requirePermission("Admin", "roles"), getPermissionSchema);
router.route("/")
  .post(requirePermission("Admin", "roles", "create"), createRole)
  .get(requirePermission("Admin", "roles", "read"), getRoles);

router.route("/:id")
  .get(requirePermission("Admin", "roles", "read"), getRoleById)
  .put(requirePermission("Admin", "roles", "update"), updateRole)
  .delete(requirePermission("Admin", "roles", "delete"), deleteRole);

export default router;

