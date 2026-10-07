import mongoose from "mongoose";
import { purchaseBillSchema } from "../models/purchase/purchaseBill.model.js";

const COMMERCIAL_TYPES = ["rm", "raw-material", "bo", "bought-out", "consumable", "consumables", "commercial"];

export const isCommercialGRN = (type) => {
  if (!type) return false;
  return COMMERCIAL_TYPES.includes(String(type).trim().toLowerCase());
};

const getCompanyId = (req, fallback) => {
  if (req?.company?._id) return req.company._id;
  if (req?.userType === "company" && req?.user?.id) return req.user.id;
  if (req?.user?.company?._id) return req.user.company._id;
  return fallback;
};

export const syncGRNToPurchaseBill = async (req, grn, action = "update") => {
  try {
    if (!grn) return null;

    const grnType = String(grn.type || "").trim().toLowerCase();
    if (!isCommercialGRN(grnType)) {
      return null;
    }

    const companyId = getCompanyId(req, grn.company);
    if (!companyId) {
      console.warn("[purchaseBillSync] Missing companyId for GRN sync:", grn.grnNumber);
      return null;
    }

    const PurchaseBill = req?.getModel
      ? req.getModel("PurchaseBill", purchaseBillSchema)
      : (mongoose.models.PurchaseBill || mongoose.model("PurchaseBill", purchaseBillSchema));

    // Handle Delete Action: remove associated Purchase Bill
    if (action === "delete") {
      const deleteResult = await PurchaseBill.deleteMany({
        company: companyId,
        $or: [{ grn: grn._id }, { grnNumber: grn.grnNumber }],
      });
      console.log(`[purchaseBillSync] Deleted ${deleteResult.deletedCount} linked Purchase Bill(s) for GRN: ${grn.grnNumber}`);
      return deleteResult;
    }

    // Prepare Items with description per AGENTS.md
    const items = (grn.items || []).map((it) => {
      const isSec = Boolean(it.hasSecondaryUnit && it.selectedUnit && it.selectedUnit === it.secondaryUnit);
      const billingQty = isSec
        ? Number(it.secondaryQuantity || it.secondaryReceivedQuantity || 0)
        : Number(it.quantity || it.receivedQuantity || 0);
      const rate = Number(it.rate || 0);
      const amount =
        typeof it.amount === "number" && !isNaN(it.amount) && it.amount > 0
          ? it.amount
          : Number((rate * billingQty).toFixed(2));

      return {
        material: it.material,
        consumable: it.consumable,
        materialName: it.materialName || "Material Item",
        description: it.description || it.descriptions || "",
        hsnCode: it.hsnCode || "",
        quantity: Number(it.quantity || it.receivedQuantity || 0),
        unit: it.unit || "PCS",
        secondaryQuantity: Number(it.secondaryQuantity || it.secondaryReceivedQuantity || 0),
        secondaryUnit: it.secondaryUnit || "",
        selectedUnit: it.selectedUnit || "",
        rate: rate,
        amount: amount,
      };
    });

    const subtotal = Number(grn.subtotal) || items.reduce((s, it) => s + it.amount, 0);
    const taxRate = Number(grn.taxRate) || 0;
    const taxAmount = Number(grn.taxAmount) || (taxRate > 0 ? (subtotal * taxRate) / 100 : 0);
    const transportationCharges = Number(grn.transportationCharges) || 0;
    const packingCharges = Number(grn.packingCharges) || 0;
    const grandTotal =
      Number(grn.totalAmount) ||
      Number((subtotal + taxAmount + transportationCharges + packingCharges).toFixed(2));

    const normalizedCategory =
      grnType === "raw-material" || grnType === "rm"
        ? "rm"
        : grnType === "bought-out" || grnType === "bo"
        ? "bo"
        : grnType === "consumables" || grnType === "consumable"
        ? "consumable"
        : "rm";

    let bill = await PurchaseBill.findOne({
      company: companyId,
      $or: [{ grn: grn._id }, { grnNumber: grn.grnNumber }],
    });

    const billDate = grn.date ? new Date(grn.date) : new Date();

    if (bill) {
      // Dynamic Update of existing bill
      bill.supplierInvoiceNumber = grn.invoiceNumber || bill.supplierInvoiceNumber || "";
      bill.date = billDate;
      if (grn.supplier) bill.vendor = grn.supplier;
      if (grn.supplierName) bill.vendorName = grn.supplierName;
      if (grn.supplierAddress) bill.vendorAddress = grn.supplierAddress;
      bill.poNumber = grn.poNumber || bill.poNumber || "";
      bill.poReference = grn.poReference || bill.poReference || "";
      bill.grnCategory = normalizedCategory;
      bill.items = items;
      bill.subtotal = subtotal;
      bill.taxRate = taxRate;
      bill.taxAmount = taxAmount;
      bill.totalTax = taxAmount;
      bill.transportationCharges = transportationCharges;
      bill.packingCharges = packingCharges;
      bill.grandTotal = grandTotal;

      const paid = Number(bill.paidAmount) || 0;
      bill.balanceAmount = Math.max(0, Number((grandTotal - paid).toFixed(2)));

      // Recalculate payment status
      if (bill.balanceAmount <= 0 && paid > 0) {
        bill.paymentStatus = "Paid";
      } else if (paid > 0) {
        bill.paymentStatus = "Partially Paid";
      } else if (bill.dueDate && new Date(bill.dueDate) < new Date()) {
        bill.paymentStatus = "Overdue";
      } else {
        bill.paymentStatus = "Unpaid";
      }

      await bill.save();
      console.log(`[purchaseBillSync] Updated Purchase Bill #${bill.billNumber} for GRN: ${grn.grnNumber}`);
      return bill;
    } else {
      // Create new bill
      const cleanGrnSuffix = String(grn.grnNumber || "").replace(/^GRN-?/i, "");
      const billNumber = `PB-${cleanGrnSuffix || Date.now()}`;
      const creditDays = req?.body?.creditDays !== undefined ? Number(req.body.creditDays) : 30;
      const paymentTerms = req?.body?.paymentTerms || `${creditDays} Days Net`;
      const dueDate = req?.body?.dueDate
        ? new Date(req.body.dueDate)
        : new Date(billDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

      const isOverdue = dueDate && new Date(dueDate) < new Date();

      const newBill = await PurchaseBill.create({
        company: companyId,
        billNumber,
        supplierInvoiceNumber: grn.invoiceNumber || "",
        date: billDate,
        vendor: grn.supplier,
        vendorName: grn.supplierName || "Supplier",
        vendorAddress: grn.supplierAddress || "",
        grn: grn._id,
        grnNumber: grn.grnNumber,
        grnCategory: normalizedCategory,
        poNumber: grn.poNumber || "",
        poReference: grn.poReference || "",
        items,
        subtotal,
        taxRate,
        taxAmount,
        totalTax: taxAmount,
        transportationCharges,
        packingCharges,
        grandTotal,
        paymentTerms,
        creditDays,
        dueDate,
        paymentStatus: isOverdue ? "Overdue" : "Unpaid",
        paidAmount: 0,
        balanceAmount: grandTotal,
        paymentHistory: [],
        comments: [],
        status: "Active",
        createdBy: req?.user?.id || req?.user?._id || grn.createdBy,
        createdByName: req?.user?.name || grn.createdByName || "System",
      });

      console.log(`[purchaseBillSync] Created Purchase Bill #${newBill.billNumber} for GRN: ${grn.grnNumber}`);
      return newBill;
    }
  } catch (err) {
    console.error(`[purchaseBillSync] Error syncing GRN ${grn?.grnNumber} to Purchase Bill:`, err);
    return null;
  }
};

export const backfillHistoricalGRNsToPurchaseBills = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) return { count: 0, message: "Missing company" };

  const GRN = req?.getModel
    ? req.getModel("GRN")
    : mongoose.models.GRN;

  if (!GRN) return { count: 0, message: "GRN model not found" };

  const commercialGRNs = await GRN.find({
    company: companyId,
    type: { $in: COMMERCIAL_TYPES },
  }).sort({ date: -1 });

  let syncedCount = 0;
  for (const grn of commercialGRNs) {
    const result = await syncGRNToPurchaseBill(req, grn, "update");
    if (result) syncedCount++;
  }

  return { count: syncedCount, totalFound: commercialGRNs.length };
};
