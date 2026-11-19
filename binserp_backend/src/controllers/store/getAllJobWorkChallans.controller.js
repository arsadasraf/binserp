import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { purchaseOrderSchema } from "../../models/purchase/purchaseOrder.model.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { userSchema } from "../../models/user/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import fs from 'fs';
import path from 'path';

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// Helper function to update COMPONENT stock (InHouse)
const updateComponentStock = async (req, componentId, quantity) => {
  try {
    const companyId = getCompanyId(req); // Derive companyId from req
    const Component = req.getModel("Component", componentSchema);
    const component = await Component.findById(componentId);
    if (!component) {
      console.error(`Component not found: ${componentId}`);
      return null;
    }

    // Update quantity
    await Component.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};



// ========== GRN (Goods Receipt Note) ==========


export const getAllJobWorkChallans = async (req, res) => {
  try {
    const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);

    // Ensure all referenced models are registered
    req.getModel("JobWorkSupplier", jobWorkSupplierSchema);
    req.getModel("Category", categorySchema);
    req.getModel("Vendor", vendorSchema);
    req.getModel("Location", locationSchema);
    req.getModel("Process", processSchema);
    req.getModel("User", userSchema);

    const companyId = getCompanyId(req);

    const challans = await JobWorkChallan.find({ company: companyId })
      .populate("vendor")
      .populate("createdBy", "name userId email username")
      .populate("updatedBy", "name userId email username")
      .sort({ date: -1 })
      .lean();

    // Dynamically resolve active linked Job Work POs so existing & newly created POs always reflect accurately (and deleted POs clear immediately)
    let enrichedChallans = challans;
    try {
      const PurchaseOrder = req.getModel("PurchaseOrder", purchaseOrderSchema);
      const activeJwPos = await PurchaseOrder.find({
        company: companyId,
        status: { $ne: "Cancelled" },
        $or: [
          { poType: "jobwork" },
          { jobWorkChallan: { $exists: true, $ne: null } },
          { challanNumber: { $exists: true, $ne: "" } }
        ]
      })
        .select("_id poNumber jobWorkChallan challanNumber")
        .sort({ createdAt: -1 })
        .lean();

      const poByChallanId = new Map();
      const poByChallanNum = new Map();
      const activePoNumSet = new Set();

      for (const po of activeJwPos) {
        if (po.poNumber) activePoNumSet.add(String(po.poNumber).trim().toLowerCase());
        if (po.jobWorkChallan && !poByChallanId.has(String(po.jobWorkChallan))) {
          poByChallanId.set(String(po.jobWorkChallan), po.poNumber || "");
        }
        const cNum = String(po.challanNumber || "").trim().toLowerCase();
        if (cNum && !poByChallanNum.has(cNum)) {
          poByChallanNum.set(cNum, po.poNumber || "");
        }
      }

      enrichedChallans = challans.map((c) => {
        const byId = c._id ? poByChallanId.get(String(c._id)) : "";
        const byNum = c.challanNumber ? poByChallanNum.get(String(c.challanNumber).trim().toLowerCase()) : "";
        const livePoNum = byId || byNum || "";
        if (livePoNum) {
          return { ...c, poNumber: livePoNum };
        }
        // If challan had a stale poNumber whose PO was deleted, keep it only if it's still an active PO
        const existingPo = String(c.poNumber || "").trim();
        if (existingPo && !activePoNumSet.has(existingPo.toLowerCase())) {
          return { ...c, poNumber: "" };
        }
        return c;
      });
    } catch (poErr) {
      console.warn("JobWork Challans PO enrichment warning:", poErr.message);
    }

    res.status(200).json({ challans: enrichedChallans });
  } catch (error) {
    console.error("JobWork Fetch Error", error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};

