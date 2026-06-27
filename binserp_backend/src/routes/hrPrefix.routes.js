import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getHRPrefixSettings, updateHRPrefixSettings } from "../controllers/hr/index.js";
import { resolveTenant } from "../middlewares/tenant.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Apply auth and tenant middleware
router.use(verifyJWT);
router.use(resolveTenant);

router.route("/")
    .get(getHRPrefixSettings)
    .put(upload.single("logo"), updateHRPrefixSettings);

export default router;
