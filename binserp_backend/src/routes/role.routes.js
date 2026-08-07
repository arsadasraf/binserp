import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from "../controllers/role.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").post(createRole).get(getRoles);
router.route("/:id").get(getRoleById).put(updateRole).delete(deleteRole);

export default router;
