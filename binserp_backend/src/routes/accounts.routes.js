import express from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getOverviewStats,
  getTransactions,
  createTransaction,
  updateTransactionStatus
} from "../controllers/accounts.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Stats Route
router.get("/stats", getOverviewStats);

// Transaction Routes
router.route("/transactions")
  .get(getTransactions)
  .post(createTransaction);

router.route("/transactions/:id/status")
  .patch(updateTransactionStatus);

export default router;
