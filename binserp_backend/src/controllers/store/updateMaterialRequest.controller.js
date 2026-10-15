import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import {
  materialIssueSchema,
  materialRequestSchema,
  storePrefixSchema
} from "../../models/store/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

// Helper function to update COMPONENT stock (InHouse)
const updateComponentStock = async (req, componentId, quantity) => {
  try {
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

const isValidObjectId = (id) => {
  if (!id) return false;
  const str = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
  return /^[0-9a-fA-F]{24}$/.test(str);
};

const extractCleanObjectId = (id) => {
  if (!id) return undefined;
  const str = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
  return /^[0-9a-fA-F]{24}$/.test(str) ? str : undefined;
};

export const updateMaterialRequest = async (req, res) => {
  try {
    const MaterialRequest = req.getModel('MaterialRequest', materialRequestSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, remarks, items, department, priority, soNumber, salesOrder, mrpNumber, mrpPlan, type } = req.body;

    const materialRequest = await MaterialRequest.findOne({
      _id: id,
      company: companyId,
    });

    if (!materialRequest) {
      return res.status(404).json({ message: "Material request not found" });
    }

    // Dynamic time lock governance validation for editing
    const lockCheck = await checkTimeLockGovernance(req, 'materialRequest', materialRequest.createdAt, 'edit');
    if (!lockCheck.allowed) {
      return res.status(403).json({ message: lockCheck.message });
    }

    // Handle line items editing if provided
    if (Array.isArray(items)) {
      const oldItems = materialRequest.items || [];
      const updatedItems = [];

      for (const it of items) {
        const matchingOld = oldItems.find(o => {
          if (it._id && o._id && String(it._id) === String(o._id)) return true;
          if (it.material && o.material && String(it.material) === String(o.material)) return true;
          if (it.component && o.component && String(it.component) === String(o.component)) return true;
          if (it.consumable && o.consumable && String(it.consumable) === String(o.consumable)) return true;
          if (it.materialName && o.materialName && it.materialName.trim().toLowerCase() === o.materialName.trim().toLowerCase()) return true;
          return false;
        });

        const issuedQty = matchingOld ? Number(matchingOld.issuedQuantity) || 0 : 0;
        const requestedQty = Number(it.quantity) || 0;

        if (requestedQty < issuedQty) {
          return res.status(400).json({
            message: `Cannot reduce requested quantity for "${it.materialName}" below the already issued quantity (${issuedQty} ${it.unit || 'PCS'}).`
          });
        }

        const pendingQty = Math.max(0, requestedQty - issuedQty);

        const cleanMat = extractCleanObjectId(it.material);
        const cleanCons = extractCleanObjectId(it.consumable);
        const cleanComp = extractCleanObjectId(it.component);
        const cleanFg = extractCleanObjectId(it.fgItem);

        updatedItems.push({
          material: cleanMat,
          consumable: cleanCons,
          component: cleanComp,
          fgItem: cleanFg,
          itemType: it.itemType || (cleanComp || cleanFg ? 'FG Item' : cleanCons ? 'Consumable' : 'Raw Material'),
          materialCode: it.materialCode || '',
          materialName: it.materialName || '',
          materialDescription: it.materialDescription || it.description || it.descriptions || '',
          quantity: requestedQty,
          unit: it.unit || 'PCS',
          hasSecondaryUnit: Boolean(it.hasSecondaryUnit),
          secondaryUnit: it.secondaryUnit || '',
          conversionFactor: Number(it.conversionFactor) || 0,
          secondaryQuantity: Number(it.secondaryQuantity) || 0,
          selectedUnit: it.selectedUnit || it.unit || 'PCS',
          purpose: it.purpose || '',
          issuedQuantity: issuedQty,
          pendingQuantity: pendingQty,
          ...(it._id && isValidObjectId(it._id) ? { _id: it._id } : {})
        });
      }

      materialRequest.items = updatedItems;
    }

    // Update non-status header fields safely
    if (department !== undefined) materialRequest.department = department;
    if (priority !== undefined) materialRequest.priority = priority;
    if (remarks !== undefined) materialRequest.remarks = remarks;
    if (type !== undefined) materialRequest.type = type;
    if (salesOrder !== undefined) materialRequest.salesOrder = extractCleanObjectId(salesOrder);
    if (soNumber !== undefined) materialRequest.soNumber = soNumber ? String(soNumber).trim() : undefined;
    if (mrpPlan !== undefined) materialRequest.mrpPlan = extractCleanObjectId(mrpPlan);
    if (mrpNumber !== undefined) materialRequest.mrpNumber = mrpNumber ? String(mrpNumber).trim() : undefined;

    // Approval governance validation from Store Settings if status changes to Approved
    if (status && status === "Approved" && materialRequest.status !== "Approved") {
      try {
        const StorePrefix = req.getModel('StorePrefix', storePrefixSchema);
        const prefixDoc = await StorePrefix.findOne({ company: companyId }).lean();
        const mrApproval = prefixDoc?.approvalSettings?.materialRequest;
        
        if (mrApproval?.enabled && !mrApproval.allowAllUsers) {
          const approvers = Array.isArray(mrApproval.approvers) ? mrApproval.approvers.map(String) : [];
          const approverNames = Array.isArray(mrApproval.approverNames) ? mrApproval.approverNames : [];
          const currentUserId = String(req.user?.id || req.user?._id || '');
          const currentUserName = (req.user?.name || req.user?.username || '').trim().toLowerCase();
          const currentUserEmail = (req.user?.email || '').trim().toLowerCase();

          const isIdMatch = approvers.includes(currentUserId);
          const isNameMatch = approverNames.some(n => {
            const low = n.trim().toLowerCase();
            return low === currentUserName || low === currentUserEmail;
          });

          if (!isIdMatch && !isNameMatch) {
            const approverLabel = approverNames.length > 0 ? approverNames.join(', ') : "the designated approver";
            return res.status(403).json({
              message: `Only ${approverLabel} can approve this Material Request. Please ask ${approverLabel} to approve it.`
            });
          }
        }
      } catch (err) {
        console.warn("Approval governance check error in Material Request:", err);
      }
    }

    // If approving, set approvedBy, approvedByName, and approvedAt
    if (status && status === "Approved" && !materialRequest.approvedBy) {
      materialRequest.approvedBy = req.user?.id || req.user?._id;
      materialRequest.approvedByName = req.user?.name || req.user?.username || 'Authorized Approver';
      materialRequest.approvedAt = new Date();
    }

    // Approval governance validation: Cannot issue if not approved when approval workflow is active
    if (status && status === "Issued" && materialRequest.status !== "Approved") {
      try {
        const StorePrefix = req.getModel('StorePrefix', storePrefixSchema);
        const prefixDoc = await StorePrefix.findOne({ company: companyId }).lean();
        const mrApproval = prefixDoc?.approvalSettings?.materialRequest;
        if (mrApproval?.enabled) {
          const approverNames = Array.isArray(mrApproval.approverNames) ? mrApproval.approverNames : [];
          const approverLabel = approverNames.length > 0 ? approverNames.join(', ') : "the designated approver";
          return res.status(403).json({
            message: `Cannot issue material: Material Request #${materialRequest.requestNumber || ''} is not approved. Please ask ${approverLabel} to approve it before issuing material.`
          });
        }
      } catch (err) {
        console.warn("Approval governance check error on Issue in Material Request:", err);
      }
    }

    // Handle inventory update and voucher creation if status changes to "Issued"
    if (status && status === "Issued" && materialRequest.status !== "Issued" && !req.body.skipInventoryUpdate) {
      try {
        const MaterialIssue = req.getModel('MaterialIssue', materialIssueSchema);
        const { userId: currentUserId, userName: currentUserName } = getUserAudit(req);
        const issueNumber = `ISS-${Date.now()}`;

        let issueMrpPlan = materialRequest.mrpPlan;
        let issueMrpNumber = materialRequest.mrpNumber;
        if (issueMrpPlan && !issueMrpNumber) {
          try {
            const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);
            const plan = await MRPPlan.findById(issueMrpPlan);
            if (plan && plan.mrpNumber) issueMrpNumber = plan.mrpNumber;
          } catch(e) {}
        } else if (issueMrpNumber && !issueMrpPlan) {
          try {
            const MRPPlan = req.getModel('MRPPlan', mrpPlanSchema);
            const plan = await MRPPlan.findOne({ company: companyId, mrpNumber: issueMrpNumber.trim() });
            if (plan) issueMrpPlan = plan._id;
          } catch(e) {}
        }

        const issueItems = (materialRequest.items || []).map(it => {
          let itType = it.itemType;
          if (!itType) {
            itType = (it.component || it.fgItem) ? 'FG Item' : (it.consumable ? 'Consumable' : ((it.materialCode || '').toUpperCase().startsWith('BO-') ? 'Bought Out' : 'Raw Material'));
          }
          return {
            material: it.material,
            consumable: it.consumable,
            fgItem: it.fgItem,
            component: it.component,
            itemType: itType,
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
          };
        });

        const newIssue = await MaterialIssue.create({
          company: companyId,
          issueNumber,
          type: materialRequest.type || 'rm',
          date: new Date(),
          department: materialRequest.department || "General Store",
          issuedTo: materialRequest.requestedBy,
          mrpPlan: issueMrpPlan,
          mrpNumber: issueMrpNumber,
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

    if (status && status === "Approved") {
      materialRequest.approvedBy = userId;
      materialRequest.approvedByName = userName;
    }

    if (status && status === "Issued") {
      materialRequest.issuedBy = userId;
      materialRequest.issuedByName = userName;
      materialRequest.issuedAt = new Date();
    }

    if (status) materialRequest.status = status;
    materialRequest.updatedBy = userId;
    materialRequest.updatedByName = userName;

    await materialRequest.save();

    res.status(200).json({
      success: true,
      message: "Material request updated successfully",
      materialRequest,
    });
  } catch (error) {
    console.error("Error in updateMaterialRequest:", error);
    res.status(500).json({ message: error.message });
  }
};
