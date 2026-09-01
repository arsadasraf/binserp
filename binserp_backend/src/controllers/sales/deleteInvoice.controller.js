import mongoose from "mongoose";
import { fgItemSchema } from "../../models/store/index.js";
import { incomingPOSchema, invoiceSchema } from "../../models/sales/index.js";
import { reverseSalesItemsStock } from "./salesStockHelper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const deleteInvoice = async (req, res) => {
  try {
    const Invoice = req.getModel('Invoice', invoiceSchema);
    const IncomingPO = req.getModel('IncomingPO', incomingPOSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const invoice = await Invoice.findOne({ _id: id, company: companyId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Check if invoice was a direct standalone invoice (not created from DC)
    const isLinkedToDC = !!(invoice.deliveryChallan || invoice.dcNumber || invoice.isLinkedToDC || invoice.deliveryChallanId);

    // If direct invoice had deducted stock, reverse stock across FG, RM, BO, and Consumables
    if (!isLinkedToDC && invoice.status !== "Cancelled" && Array.isArray(invoice.items)) {
      await reverseSalesItemsStock(req, invoice.items, {
        companyId,
        refDocType: "Invoice",
        refDocId: invoice._id,
        refDocNumber: invoice.invoiceNumber,
        recipientName: invoice.customerName || "Customer",
        performedBy: req.user?.id || req.user?._id
      });
    }

    // If invoice had customerPoReference, reverse PO billedQuantity
    if (invoice.customerPoReference) {
      const po = await IncomingPO.findOne({
        company: companyId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(invoice.customerPoReference) ? invoice.customerPoReference : null },
          { poNumber: invoice.customerPoReference }
        ]
      });
      if (po && Array.isArray(po.items) && Array.isArray(invoice.items)) {
        for (const invItem of invoice.items) {
          const poItem = po.items.find(i => i.productName === invItem.materialName || i.fgItem?.toString() === invItem.fgItem?.toString());
          if (poItem) {
            poItem.billedQuantity = Math.max(0, (poItem.billedQuantity || 0) - Number(invItem.quantity || 0));
          }
        }
        const totalOrdered = po.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const totalFulfilled = po.items.reduce((acc, item) => acc + Math.max(Number(item.dispatchedQuantity || 0), Number(item.billedQuantity || 0)), 0);
        if (totalFulfilled <= 0) {
          po.status = "Open";
        } else if (totalFulfilled < totalOrdered) {
          po.status = "Partially Dispatched";
        }
        await po.save();
      }
    }

    await Invoice.findByIdAndDelete(id);
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete Invoice" });
  }
};
