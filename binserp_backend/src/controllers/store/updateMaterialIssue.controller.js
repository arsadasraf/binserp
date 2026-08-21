import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, rmInventoryMonthlySchema, fgInventoryMonthlySchema, fgItemSchema } from "../../models/store/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
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
    const companyId = getCompanyId(req);
    const Component = req.getModel("Component", componentSchema);
    const component = await Component.findById(componentId);
    if (!component) {
      console.error(`Component not found: ${componentId}`);
      return null;
    }

    await Component.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};

export const updateMaterialIssue = async (req, res) => {
  try {
    const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
    const Material = req.getModel('RmBoItem', rmBoItemSchema);
    const Component = req.getModel('Component', componentSchema);
    const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, items } = req.body;

    const materialIssue = await MaterialIssue.findOne({ _id: id, company: companyId });
    if (!materialIssue) {
      return res.status(404).json({ message: "Material issue not found" });
    }

    const oldStatus = materialIssue.status;
    const newStatus = status || materialIssue.status;

    // Update inventory only if status changes to/from "Issued"
    if (oldStatus !== "Issued" && newStatus === "Issued") {
      const itemsToProcess = items || materialIssue.items;
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
      const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
      
      for (const item of itemsToProcess) {
        if (materialIssue.type === 'inhouse') {
          const compId = item.component?._id || item.component || item.material;
          await updateComponentStock(req, compId, -Number(item.quantity));
          
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: Number(item.quantity) } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating FG monthly outward quantity:", monthlyErr);
          }
        } else {
          const materialId = item.material?._id || item.material;
          await updateInventoryStock(
            req,
            materialId,
            -Number(item.quantity),
            item.unit || "PCS"
          );
          
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: materialId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: Number(item.quantity) } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating RM monthly outward quantity:", monthlyErr);
          }
        }
      }

      // Update MRP Plan status if linked
      const mrpPlanId = materialIssue.mrpPlan || req.body.mrpPlan;
      const mrpNum = materialIssue.mrpNumber || req.body.mrpNumber;
      if (mrpPlanId || mrpNum) {
        try {
          const query = { company: companyId };
          if (mrpPlanId) query._id = mrpPlanId;
          else if (mrpNum) query.mrpNumber = mrpNum;

          const plan = await MRPPlan.findOne(query);
          if (plan && (plan.status === 'Planned' || plan.status === 'Draft')) {
            plan.status = 'In Production';
            await plan.save();
          }
        } catch (planErr) {
          console.error("Error updating MRP status in updateMaterialIssue:", planErr);
        }
      }
    } else if (oldStatus === "Issued" && newStatus !== "Issued") {
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);
      const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
      
      for (const item of materialIssue.items) {
        if (materialIssue.type === 'inhouse') {
          const compId = item.component?._id || item.component || item.material;
          await updateComponentStock(req, compId, Number(item.quantity));
          
          try {
            await FGInventoryMonthly.findOneAndUpdate(
              { company: companyId, fgItem: compId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -Number(item.quantity) } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error reversing FG monthly outward quantity:", monthlyErr);
          }
        } else {
          const materialId = item.material?._id || item.material;
          await updateInventoryStock(
            req,
            materialId,
            Number(item.quantity),
            item.unit || "PCS"
          );
          
          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: materialId, month: currentMonthStr },
              { $inc: { totalOutwardQuantity: -Number(item.quantity) } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error reversing RM monthly outward quantity:", monthlyErr);
          }
        }
      }
    }

    const updatedIssue = await MaterialIssue.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    );

    res.status(200).json({ message: "Material issue updated successfully", materialIssue: updatedIssue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

