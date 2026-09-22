import { purchaseBillSchema } from "../../models/purchase/index.js";
import { grnSchema, jobWorkSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import mongoose from "mongoose";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

export const createPurchaseBill = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const GRN = req.getModel("GRN", grnSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
  const companyId = getCompanyId(req);

  const {
    billNumber,
    date,
    vendorName,
    vendor,
    poReference,
    grnReference,
    grn,
    billType = "material",
    jobWorkChallan,
    jobWorkChallanNumber,
    items,
    subtotal,
    totalTax,
    grandTotal,
    paymentTerms,
    dueDate,
    remarks
  } = req.body;

  const existingBill = await PurchaseBill.findOne({ billNumber, company: companyId });
  if (existingBill) {
    throw new ApiError(400, "Purchase Bill with this number already exists");
  }

  // 1. THREE-WAY MATCHING & GRN VALIDATION (For Material Bills)
  let matchedGrn = null;
  if (billType === "material" && (grnReference || grn)) {
    const grnQuery = grn && isValidObjectId(grn.toString())
      ? { _id: grn, company: companyId }
      : { grnNumber: grnReference, company: companyId };

    matchedGrn = await GRN.findOne(grnQuery);
    if (matchedGrn) {
      if (matchedGrn.billingStatus === "Fully Billed") {
        throw new ApiError(400, `GRN #${matchedGrn.grnNumber} has already been fully billed. Duplicate billing is not allowed.`);
      }

      // Validate quantities: Cannot bill more than QC-accepted remaining unbilled quantity
      if (Array.isArray(items) && items.length > 0) {
        for (const billItem of items) {
          const matchingGrnItem = (matchedGrn.items || []).find(gIt => {
            if (billItem.grnItemId && String(gIt._id) === String(billItem.grnItemId)) return true;
            if (billItem.material && gIt.material && String(gIt.material) === String(billItem.material)) return true;
            if (billItem.materialName && gIt.materialName) {
              return gIt.materialName.trim().toLowerCase() === billItem.materialName.trim().toLowerCase();
            }
            return false;
          });

          if (matchingGrnItem) {
            const acceptedQty = matchingGrnItem.acceptedQuantity !== undefined ? Number(matchingGrnItem.acceptedQuantity) : Number(matchingGrnItem.quantity || 0);
            const alreadyBilled = Number(matchingGrnItem.billedQuantity || 0);
            const maxBillableQty = Math.max(0, acceptedQty - alreadyBilled);
            const billedNow = Number(billItem.quantity || 0);

            if (billedNow > maxBillableQty) {
              throw new ApiError(400, `Cannot bill ${billedNow} for "${matchingGrnItem.materialName}". Only ${maxBillableQty} QC-accepted units remain available to bill on GRN #${matchedGrn.grnNumber}.`);
            }
          }
        }
      }
    }
  }

  // 2. JOB WORK CHALLAN VALIDATION (For Subcontractor Service Bills)
  let matchedJobWork = null;
  if (billType === "job-work-service" && (jobWorkChallan || jobWorkChallanNumber)) {
    const jwQuery = jobWorkChallan && isValidObjectId(jobWorkChallan.toString())
      ? { _id: jobWorkChallan, company: companyId }
      : { challanNumber: jobWorkChallanNumber, company: companyId };

    matchedJobWork = await JobWorkChallan.findOne(jwQuery);
    if (matchedJobWork && matchedJobWork.billingStatus === "Fully Billed") {
      throw new ApiError(400, `Job Work Challan #${matchedJobWork.challanNumber} has already been fully billed.`);
    }
  }

  // 3. CREATE PURCHASE BILL
  const newBill = await PurchaseBill.create({
    company: companyId,
    billNumber,
    date: date || new Date(),
    vendorName,
    vendor: vendor && isValidObjectId(vendor.toString()) ? vendor.toString() : undefined,
    poReference: poReference || "",
    grnReference: matchedGrn?.grnNumber || grnReference || "",
    grn: matchedGrn?._id || (grn && isValidObjectId(grn.toString()) ? grn.toString() : undefined),
    billType,
    jobWorkChallan: matchedJobWork?._id || (jobWorkChallan && isValidObjectId(jobWorkChallan.toString()) ? jobWorkChallan.toString() : undefined),
    jobWorkChallanNumber: matchedJobWork?.challanNumber || jobWorkChallanNumber || "",
    items,
    subtotal: Number(subtotal) || 0,
    totalTax: Number(totalTax) || 0,
    grandTotal: Number(grandTotal) || 0,
    paymentTerms: paymentTerms || "",
    dueDate: dueDate || undefined,
    remarks: remarks || "",
    createdBy: req.user?.id || req.user?._id,
  });

  // 4. UPDATE GRN BILLED STATUS & QUANTITIES
  if (matchedGrn) {
    try {
      let anyItemBilled = false;
      let allItemsFullyBilled = true;

      (matchedGrn.items || []).forEach(gIt => {
        const matchingBillItem = (items || []).find(bIt => {
          if (bIt.grnItemId && String(gIt._id) === String(bIt.grnItemId)) return true;
          if (bIt.material && gIt.material && String(gIt.material) === String(bIt.material)) return true;
          if (bIt.materialName && gIt.materialName) {
            return gIt.materialName.trim().toLowerCase() === bIt.materialName.trim().toLowerCase();
          }
          return false;
        });

        if (matchingBillItem) {
          const addedBilled = Number(matchingBillItem.quantity) || 0;
          gIt.billedQuantity = (gIt.billedQuantity || 0) + addedBilled;
        }

        const acceptedQty = gIt.acceptedQuantity !== undefined ? Number(gIt.acceptedQuantity) : Number(gIt.quantity || 0);
        const totalBilled = Number(gIt.billedQuantity || 0);

        if (totalBilled < acceptedQty) {
          allItemsFullyBilled = false;
        }
        if (totalBilled > 0) {
          anyItemBilled = true;
        }
      });

      matchedGrn.billingStatus = allItemsFullyBilled ? "Fully Billed" : (anyItemBilled ? "Partially Billed" : "Unbilled");
      matchedGrn.isBilled = allItemsFullyBilled;
      matchedGrn.purchaseBill = newBill._id;
      matchedGrn.purchaseBillNumber = billNumber;

      await matchedGrn.save();
    } catch (grnErr) {
      console.error("Error updating GRN billing status on Purchase Bill creation:", grnErr);
    }
  }

  // 5. UPDATE JOB WORK CHALLAN BILLED STATUS
  if (matchedJobWork) {
    try {
      matchedJobWork.billingStatus = "Fully Billed";
      matchedJobWork.serviceBillReference = billNumber;
      await matchedJobWork.save();
    } catch (jwErr) {
      console.error("Error updating Job Work Challan billing status on Service Bill creation:", jwErr);
    }
  }

  return res.status(201).json(new ApiResponse(201, newBill, "Purchase Bill created successfully"));
});

export const getPurchaseBills = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const companyId = getCompanyId(req);

  const bills = await PurchaseBill.find({ company: companyId })
    .populate('vendor', 'name email phone address')
    .populate('grn', 'grnNumber date totalAmount billingStatus')
    .populate('jobWorkChallan', 'challanNumber date totalAmount billingStatus')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, bills, "Purchase Bills fetched successfully"));
});

export const getUnbilledDocs = asyncHandler(async (req, res) => {
  const GRN = req.getModel("GRN", grnSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
  const companyId = getCompanyId(req);
  const { vendorId } = req.query;

  const grnFilter = { company: companyId, billingStatus: { $ne: "Fully Billed" } };
  const jwFilter = { company: companyId, billingStatus: { $ne: "Fully Billed" } };

  if (vendorId && isValidObjectId(vendorId.toString())) {
    grnFilter.supplier = vendorId;
    jwFilter.vendor = vendorId;
  }

  const [unbilledGrns, unbilledJobWorks] = await Promise.all([
    GRN.find(grnFilter).select('grnNumber date supplier supplierName items totalAmount billingStatus qcStatus').lean(),
    JobWorkChallan.find(jwFilter).select('challanNumber date vendor vendorName items assemblyGroups status billingStatus jobWorkType').lean()
  ]);

  return res.status(200).json(new ApiResponse(200, { unbilledGrns, unbilledJobWorks }, "Unbilled documents fetched successfully"));
});

export const updatePurchaseBill = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const updatedBill = await PurchaseBill.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedBill) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedBill, "Purchase Bill updated successfully"));
});

export const deletePurchaseBill = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const GRN = req.getModel("GRN", grnSchema);
  const JobWorkChallan = req.getModel("JobWorkChallan", jobWorkSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const billToDelete = await PurchaseBill.findOne({ _id: id, company: companyId });
  if (!billToDelete) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  // Rollback GRN Billed status and quantities if linked
  if (billToDelete.grn || billToDelete.grnReference) {
    try {
      const grnQuery = billToDelete.grn ? { _id: billToDelete.grn, company: companyId } : { grnNumber: billToDelete.grnReference, company: companyId };
      const linkedGrn = await GRN.findOne(grnQuery);
      if (linkedGrn) {
        (linkedGrn.items || []).forEach(gIt => {
          const matchingBillItem = (billToDelete.items || []).find(bIt => {
            if (bIt.grnItemId && String(gIt._id) === String(bIt.grnItemId)) return true;
            if (bIt.material && gIt.material && String(gIt.material) === String(bIt.material)) return true;
            if (bIt.materialName && gIt.materialName) {
              return gIt.materialName.trim().toLowerCase() === bIt.materialName.trim().toLowerCase();
            }
            return false;
          });
          if (matchingBillItem) {
            gIt.billedQuantity = Math.max(0, (gIt.billedQuantity || 0) - (Number(matchingBillItem.quantity) || 0));
          }
        });

        const anyBilled = (linkedGrn.items || []).some(g => (g.billedQuantity || 0) > 0);
        linkedGrn.billingStatus = anyBilled ? "Partially Billed" : "Unbilled";
        linkedGrn.isBilled = false;
        linkedGrn.purchaseBill = undefined;
        linkedGrn.purchaseBillNumber = "";
        await linkedGrn.save();
      }
    } catch (rbErr) {
      console.error("Error rolling back GRN billing status on bill deletion:", rbErr);
    }
  }

  // Rollback Job Work Challan Billed status if linked
  if (billToDelete.jobWorkChallan || billToDelete.jobWorkChallanNumber) {
    try {
      const jwQuery = billToDelete.jobWorkChallan ? { _id: billToDelete.jobWorkChallan, company: companyId } : { challanNumber: billToDelete.jobWorkChallanNumber, company: companyId };
      const linkedJw = await JobWorkChallan.findOne(jwQuery);
      if (linkedJw) {
        linkedJw.billingStatus = "Unbilled";
        linkedJw.serviceBillReference = "";
        await linkedJw.save();
      }
    } catch (rbJwErr) {
      console.error("Error rolling back Job Work Challan billing status on bill deletion:", rbJwErr);
    }
  }

  await PurchaseBill.findOneAndDelete({ _id: id, company: companyId });

  return res.status(200).json(new ApiResponse(200, {}, "Purchase Bill deleted and source document billing status rolled back successfully"));
});

