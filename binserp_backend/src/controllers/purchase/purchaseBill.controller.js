import { purchaseBillSchema } from "../../models/purchase/index.js";
import { grnSchema, jobWorkSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { backfillHistoricalGRNsToPurchaseBills } from "../../utils/purchaseBillSync.helper.js";
import { buildMultiFieldSearchFilter, buildSpaceFreeRegex } from "../../utils/searchHelper.js";
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
    supplierInvoiceNumber,
    date,
    vendorName,
    vendor,
    poReference,
    poNumber,
    grnReference,
    grn,
    grnCategory = "rm",
    billType = "material",
    jobWorkChallan,
    jobWorkChallanNumber,
    items,
    subtotal,
    taxRate,
    taxAmount,
    totalTax,
    transportationCharges,
    packingCharges,
    grandTotal,
    paymentTerms = "30 Days Net",
    creditDays = 30,
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
        throw new ApiError(400, `GRN #${matchedGrn.grnNumber} has already been fully billed.`);
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

  const billDate = date ? new Date(date) : new Date();
  const parsedCreditDays = Number(creditDays) >= 0 ? Number(creditDays) : 30;
  const calculatedDueDate = dueDate
    ? new Date(dueDate)
    : new Date(billDate.getTime() + parsedCreditDays * 24 * 60 * 60 * 1000);

  const parsedSubtotal = Number(subtotal) || 0;
  const parsedTax = Number(taxAmount || totalTax) || 0;
  const parsedTransport = Number(transportationCharges) || 0;
  const parsedPacking = Number(packingCharges) || 0;
  const parsedGrandTotal = Number(grandTotal) || (parsedSubtotal + parsedTax + parsedTransport + parsedPacking);

  // 3. CREATE PURCHASE BILL
  const newBill = await PurchaseBill.create({
    company: companyId,
    billNumber,
    supplierInvoiceNumber: supplierInvoiceNumber || "",
    date: billDate,
    vendorName,
    vendor: vendor && isValidObjectId(vendor.toString()) ? vendor.toString() : undefined,
    poReference: poReference || "",
    poNumber: poNumber || poReference || "",
    grnReference: matchedGrn?.grnNumber || grnReference || "",
    grn: matchedGrn?._id || (grn && isValidObjectId(grn.toString()) ? grn.toString() : undefined),
    grnCategory: grnCategory || matchedGrn?.type || "rm",
    billType,
    jobWorkChallan: matchedJobWork?._id || (jobWorkChallan && isValidObjectId(jobWorkChallan.toString()) ? jobWorkChallan.toString() : undefined),
    jobWorkChallanNumber: matchedJobWork?.challanNumber || jobWorkChallanNumber || "",
    items: items || [],
    subtotal: parsedSubtotal,
    taxRate: Number(taxRate) || 0,
    taxAmount: parsedTax,
    totalTax: parsedTax,
    transportationCharges: parsedTransport,
    packingCharges: parsedPacking,
    grandTotal: parsedGrandTotal,
    paymentTerms: paymentTerms || `${parsedCreditDays} Days Net`,
    creditDays: parsedCreditDays,
    dueDate: calculatedDueDate,
    paymentStatus: calculatedDueDate < new Date() ? "Overdue" : "Unpaid",
    paidAmount: 0,
    balanceAmount: parsedGrandTotal,
    paymentHistory: [],
    comments: [],
    remarks: remarks || "",
    createdBy: req.user?.id || req.user?._id,
    createdByName: req.user?.name || req.user?.username || "User",
  });

  // 4. UPDATE GRN BILLED STATUS
  if (matchedGrn) {
    try {
      matchedGrn.billingStatus = "Fully Billed";
      matchedGrn.isBilled = true;
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

  const {
    startDate,
    endDate,
    vendorId,
    paymentStatus,
    grnCategory,
    search
  } = req.query;

  const filter = { company: companyId };

  // Date Range Filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      filter.date.$gte = sDate;
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      filter.date.$lte = eDate;
    }
  }

  // Vendor Filter
  if (vendorId && vendorId !== "all") {
    if (isValidObjectId(vendorId.toString())) {
      filter.vendor = vendorId;
    } else {
      filter.vendorName = { $regex: vendorId, $options: "i" };
    }
  }

  // GRN Category Filter
  if (grnCategory && grnCategory !== "all") {
    const catMap = {
      rm: ["rm", "raw-material"],
      bo: ["bo", "bought-out"],
      consumable: ["consumable", "consumables"]
    };
    filter.grnCategory = { $in: catMap[grnCategory] || [grnCategory] };
  }

  // Search Filter (Space-free, separator-agnostic across bill number, invoice, vendor, and items)
  if (search && search.trim()) {
    const fields = [
      'billNumber',
      'supplierInvoiceNumber',
      'grnNumber',
      'poNumber',
      'vendorName',
      'items.itemName',
      'items.description',
      'items.materialCode'
    ];
    const searchCondition = buildMultiFieldSearchFilter(search, fields);
    if (searchCondition) {
      if (searchCondition.$or) {
        filter.$or = searchCondition.$or;
      } else if (searchCondition.$and) {
        filter.$and = searchCondition.$and;
      }
    }
  }

  const bills = await PurchaseBill.find(filter)
    .populate("vendor", "name email phone address gstNumber gstin")
    .populate("grn", "grnNumber date totalAmount billingStatus qcStatus")
    .populate("jobWorkChallan", "challanNumber date totalAmount billingStatus")
    .sort({ date: -1, createdAt: -1 });

  const now = new Date();

  // Evaluate dynamic overdue status and compute KPI metrics
  let totalBillAmount = 0;
  let totalPaidAmount = 0;
  let totalOutstandingAmount = 0;
  let overdueCount = 0;
  let unpaidCount = 0;
  let paidCount = 0;

  const processedBills = bills.map((bill) => {
    const billObj = bill.toObject();

    // Check dynamic overdue
    const isOverdue =
      billObj.paymentStatus !== "Paid" &&
      billObj.dueDate &&
      new Date(billObj.dueDate) < now &&
      (billObj.balanceAmount || billObj.grandTotal) > 0;

    if (isOverdue && billObj.paymentStatus !== "Overdue") {
      billObj.paymentStatus = "Overdue";
    }

    const bTotal = Number(billObj.grandTotal) || 0;
    const bPaid = Number(billObj.paidAmount) || 0;
    const bBalance = Number(billObj.balanceAmount !== undefined ? billObj.balanceAmount : bTotal - bPaid);

    totalBillAmount += bTotal;
    totalPaidAmount += bPaid;
    totalOutstandingAmount += bBalance;

    if (billObj.paymentStatus === "Overdue") overdueCount++;
    else if (billObj.paymentStatus === "Paid") paidCount++;
    else unpaidCount++;

    return billObj;
  });

  // If specific paymentStatus filter was requested, filter post-eval
  let finalBills = processedBills;
  if (paymentStatus && paymentStatus !== "all") {
    finalBills = processedBills.filter(
      (b) => b.paymentStatus?.toLowerCase() === paymentStatus.toLowerCase()
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        bills: finalBills,
        metrics: {
          totalBillsCount: processedBills.length,
          totalBillAmount: Number(totalBillAmount.toFixed(2)),
          totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
          totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
          overdueCount,
          unpaidCount,
          paidCount,
        },
      },
      "Purchase Bills fetched successfully"
    )
  );
});

export const getPurchaseBillById = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const bill = await PurchaseBill.findOne({ _id: id, company: companyId })
    .populate("vendor", "name email phone address gstNumber gstin")
    .populate("grn", "grnNumber date totalAmount billingStatus qcStatus photos pdf")
    .populate("items.material", "name code unit category descriptions description specification");

  if (!bill) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  return res.status(200).json(new ApiResponse(200, bill, "Purchase Bill fetched successfully"));
});

export const recordBillPayment = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const {
    amountPaid,
    paymentMode = "Bank Transfer",
    transactionRef = "",
    notes = "",
    paymentDate,
    paymentTerms,
    creditDays,
    dueDate
  } = req.body;

  const bill = await PurchaseBill.findOne({ _id: id, company: companyId });
  if (!bill) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  // Update payment terms and credit days if supplied
  if (paymentTerms) bill.paymentTerms = paymentTerms;
  if (creditDays !== undefined) bill.creditDays = Number(creditDays);
  if (dueDate) bill.dueDate = new Date(dueDate);

  // If creditDays changed but dueDate not explicitly passed, auto-compute
  if (creditDays !== undefined && !dueDate) {
    const bDate = bill.date ? new Date(bill.date) : new Date();
    bill.dueDate = new Date(bDate.getTime() + Number(creditDays) * 24 * 60 * 60 * 1000);
  }

  const addedPayment = Number(amountPaid) || 0;
  if (addedPayment > 0) {
    const currentPaid = Number(bill.paidAmount) || 0;
    const newPaid = currentPaid + addedPayment;
    bill.paidAmount = newPaid;
    bill.balanceAmount = Math.max(0, Number(((bill.grandTotal || 0) - newPaid).toFixed(2)));

    const userName = req.user?.name || req.user?.username || req.user?.email || "User";

    bill.paymentHistory.push({
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amountPaid: addedPayment,
      paymentMode,
      transactionRef,
      notes,
      recordedBy: req.user?._id || req.user?.id,
      recordedByName: userName,
      recordedAt: new Date(),
    });
  }

  // Re-evaluate payment status
  const balance = Number(bill.balanceAmount) || 0;
  const paid = Number(bill.paidAmount) || 0;
  if (balance <= 0 && paid > 0) {
    bill.paymentStatus = "Paid";
  } else if (paid > 0) {
    bill.paymentStatus = "Partially Paid";
  } else if (bill.dueDate && new Date(bill.dueDate) < new Date()) {
    bill.paymentStatus = "Overdue";
  } else {
    bill.paymentStatus = "Unpaid";
  }

  await bill.save();

  return res.status(200).json(new ApiResponse(200, bill, "Payment and credit terms updated successfully"));
});

export const addBillComment = asyncHandler(async (req, res) => {
  const PurchaseBill = req.getModel("PurchaseBill", purchaseBillSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    throw new ApiError(400, "Comment cannot be empty");
  }

  const bill = await PurchaseBill.findOne({ _id: id, company: companyId });
  if (!bill) {
    throw new ApiError(404, "Purchase Bill not found");
  }

  const userName = req.user?.name || req.user?.username || req.user?.email || "User";

  bill.comments.push({
    comment: comment.trim(),
    userName,
    userId: req.user?._id || req.user?.id,
    createdAt: new Date(),
  });

  await bill.save();

  return res.status(200).json(new ApiResponse(200, bill, "Note/Comment added successfully"));
});

export const syncHistoricalBills = asyncHandler(async (req, res) => {
  const syncResult = await backfillHistoricalGRNsToPurchaseBills(req);
  return res.status(200).json(
    new ApiResponse(200, syncResult, `Synced ${syncResult.count} of ${syncResult.totalFound} historical GRNs into Purchase Bills.`)
  );
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

  // Rollback GRN Billed status if linked
  if (billToDelete.grn || billToDelete.grnReference) {
    try {
      const grnQuery = billToDelete.grn
        ? { _id: billToDelete.grn, company: companyId }
        : { grnNumber: billToDelete.grnReference, company: companyId };
      const linkedGrn = await GRN.findOne(grnQuery);
      if (linkedGrn) {
        linkedGrn.billingStatus = "Unbilled";
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
      const jwQuery = billToDelete.jobWorkChallan
        ? { _id: billToDelete.jobWorkChallan, company: companyId }
        : { challanNumber: billToDelete.jobWorkChallanNumber, company: companyId };
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

  return res.status(200).json(new ApiResponse(200, {}, "Purchase Bill deleted successfully"));
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
