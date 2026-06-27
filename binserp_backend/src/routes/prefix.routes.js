import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getPrefixSettings, updatePrefixSettings } from "../controllers/prefix/index.js";
import { resolveTenant } from "../middlewares/tenant.middleware.js";

const router = Router();

// Apply auth and tenant middleware
router.use(verifyJWT);
router.use(resolveTenant);

router.route("/")
    .get(getPrefixSettings)
    .put(updatePrefixSettings);

export default router;
