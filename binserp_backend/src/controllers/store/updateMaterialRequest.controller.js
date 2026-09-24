import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
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


export const updateMaterialRequest = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
      const Material = req.getModel('RmBoItem', rmBoItemSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const materialRequest = await MaterialRequest.findOne({
      _id: id,
      company: companyId,
    });

    if (!materialRequest) {
      return res.status(404).json({ message: "Material request not found" });
    }

    // If approving, set approvedBy
    if (status === "Approved" && !materialRequest.approvedBy) {
      materialRequest.approvedBy = req.user.id;
    }

    // Handle inventory update and voucher creation if status changes to "Issued"
    if (status === "Issued" && materialRequest.status !== "Issued" && !req.body.skipInventoryUpdate) {
      try {
        const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
        const { userId: currentUserId, userName: currentUserName } = getUserAudit(req);
        const issueNumber = `ISS-${Date.now()}`;

        const issueItems = (materialRequest.items || []).map(it => ({
          material: it.material,
          consumable: it.consumable,
          fgItem: it.fgItem,
          component: it.component,
          itemType: it.itemType || 'Raw Material',
          materialCode: it.materialCode || '',
          materialName: it.materialName,
          quantity: it.quantity,
          unit: it.unit || "PCS",
          hasSecondaryUnit: it.hasSecondaryUnit || false,
          secondaryUnit: it.secondaryUnit || "",
          conversionFactor: it.conversionFactor || 1,
          secondaryQuantity: it.secondaryQuantity || 0,
          materialRequestItemId: it._id,
          requestedQuantity: it.quantity,
          purpose: it.purpose || materialRequest.remarks || `Issued against Request #${materialRequest.requestNumber}`
        }));

        const newIssue = await MaterialIssue.create({
          company: companyId,
          issueNumber,
          type: materialRequest.type || 'rm',
          date: new Date(),
          department: materialRequest.department || "General Store",
          issuedTo: materialRequest.requestedBy,
          mrpPlan: materialRequest.mrpPlan,
          mrpNumber: materialRequest.mrpNumber,
          materialRequest: materialRequest._id,
          requestNumber: materialRequest.requestNumber,
          items: issueItems,
          issuedBy: req.user?.id || req.user?._id,
          status: "Issued",
          createdBy: currentUserId,
          createdByName: currentUserName,
          updatedBy: currentUserId,
          updatedByName: currentUserName
        });

        materialRequest.linkedIssues = materialRequest.linkedIssues || [];
        materialRequest.linkedIssues.push(newIssue._id);
        materialRequest.issueNumbers = materialRequest.issueNumbers || [];
        materialRequest.issueNumbers.push(issueNumber);

        for (const item of materialRequest.items) {
          item.issuedQuantity = item.quantity;
          item.pendingQuantity = 0;

          if (materialRequest.type === 'inhouse' || item.component) {
            if (item.component) {
              await updateComponentStock(req, item.component, -item.quantity);
            }
          } else {
            const targetMatId = item.consumable || item.material;
            if (targetMatId) {
              await updateInventoryStock(
                req,
                targetMatId,
                -item.quantity,
                item.unit || "PCS",
                undefined,
                {
                  itemType: item.itemType === 'Consumable' ? 'Consumable' : (item.itemType === 'Bought Out' ? 'BoughtOut' : 'RawMaterial'),
                  transactionCategory: "MATERIAL_ISSUE_SHOPFLOOR_OUTWARD",
                  referenceDocType: "MaterialIssue",
                  referenceDocId: newIssue._id,
                  referenceDocNumber: issueNumber,
                  recipientOrSource: `Shop Floor (${materialRequest.department || 'Production'})`,
                  purpose: `Issued against Request #${materialRequest.requestNumber}`,
                  hasSecondaryUnit: item.hasSecondaryUnit || false,
                  secondaryUnit: item.secondaryUnit || "",
                  secondaryQuantity: item.secondaryQuantity || 0,
                  conversionFactor: item.conversionFactor || 1,
                  performedBy: req.user?.id || req.user?._id,
                }
              );
            }
          }
        }
      } catch (err) {
        console.error("Inventory update failed during Issue:", err);
        return res.status(500).json({ message: "Failed to update inventory: " + err.message });
      }
    }

    const { userId, userName } = getUserAudit(req);

    // If approving, set approvedBy
    if (status === "Approved") {
      materialRequest.approvedBy = userId;
      materialRequest.approvedByName = userName;
    }

    // If issuing, set issuedBy
    if (status === "Issued") {
      materialRequest.issuedBy = userId;
      materialRequest.issuedByName = userName;
      materialRequest.issuedAt = new Date();
    }

    materialRequest.status = status;
    if (remarks) materialRequest.remarks = remarks;
    materialRequest.updatedBy = userId;
    materialRequest.updatedByName = userName;

    await materialRequest.save();

    res.status(200).json({
      message: `Material request ${status.toLowerCase()} successfully`,
      materialRequest,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== PURCHASE ORDER (PO) ==========



