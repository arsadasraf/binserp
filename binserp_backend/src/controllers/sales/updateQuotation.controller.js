import mongoose from "mongoose";
import { quotationSchema } from "../../models/sales/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const updateQuotation = async (req, res) => {
  try {
    const Quotation = req.getModel('Quotation', quotationSchema);
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const body = { ...req.body };
    if (!body.customer || typeof body.customer !== 'string' || !body.customer.trim() || !mongoose.Types.ObjectId.isValid(body.customer)) {
      delete body.customer;
    }

    if (!body.rfq || typeof body.rfq !== 'string' || !body.rfq.trim() || !mongoose.Types.ObjectId.isValid(body.rfq)) {
      delete body.rfq;
      delete body.rfqId;
    }

    if (Array.isArray(body.items)) {
      body.items = body.items.map(item => {
        const newItem = { ...item };
        if (!newItem.component || typeof newItem.component !== 'string' || !newItem.component.trim() || !mongoose.Types.ObjectId.isValid(newItem.component)) {
          delete newItem.component;
        }
        if (!newItem.material || typeof newItem.material !== 'string' || !newItem.material.trim() || !mongoose.Types.ObjectId.isValid(newItem.material)) {
          delete newItem.material;
        }
        return newItem;
      });
    }

    const existing = await Quotation.findOne({ _id: id, company: companyId });
    if (!existing) return res.status(404).json({ message: "Quotation not found" });

    const userId = req.user?.id || req.user?._id;
    body.updatedBy = userId;

    if (body.status && body.status !== existing.status) {
      body.$push = {
        statusHistory: {
          status: body.status,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      };
    }

    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, company: companyId },
      body,
      { new: true }
    )
      .populate("preparedBy", "name email")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("statusHistory.updatedBy", "name email")
      .populate("customer", "name customerName companyName email phone city code gst")
      .populate("rfq", "rfqNumber status")
      .populate("items.component", "componentName componentCode")
      .populate("items.fgItem", "name code unit");

    res.status(200).json({ message: "Quotation updated successfully", quotation });
  } catch (error) {
    console.error("Error updating quotation:", error);
    res.status(500).json({ message: error.message || "Failed to update quotation" });
  }
};
