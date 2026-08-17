import mongoose from "mongoose";
import { quotationSchema, incomingRFQSchema } from "../../models/sales/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createQuotation = async (req, res) => {
  try {
    const Quotation = req.getModel('Quotation', quotationSchema);
    const companyId = getCompanyId(req);

    const body = { ...req.body };
    if (!body.customer || typeof body.customer !== 'string' || !body.customer.trim() || !mongoose.Types.ObjectId.isValid(body.customer)) {
      delete body.customer;
    }

    if (body.rfqId && (!body.rfq || !mongoose.Types.ObjectId.isValid(body.rfq))) {
      if (mongoose.Types.ObjectId.isValid(body.rfqId)) {
        body.rfq = body.rfqId;
      }
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
        if (!newItem.fgItem || typeof newItem.fgItem !== 'string' || !newItem.fgItem.trim() || !mongoose.Types.ObjectId.isValid(newItem.fgItem)) {
          delete newItem.fgItem;
        }
        return newItem;
      });
    }

    if (!body.quotationNumber) {
      const count = await Quotation.countDocuments({ company: companyId });
      const currentYear = new Date().getFullYear();
      body.quotationNumber = `QT-OUT-${currentYear}-${String(count + 1).padStart(4, '0')}`;
    }

    const initialStatus = body.status || "Draft";
    const userId = req.user?.id || req.user?._id;

    const quotation = await Quotation.create({
      ...body,
      company: companyId,
      preparedBy: userId,
      createdBy: userId,
      updatedBy: userId,
      statusHistory: [
        {
          status: initialStatus,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      ],
    });

    // Auto-update linked Inward RFQ status to 'Quoted' if rfq is provided
    if (body.rfq && mongoose.Types.ObjectId.isValid(body.rfq)) {
      try {
        const IncomingRFQ = req.getModel('IncomingRFQ', incomingRFQSchema);
        await IncomingRFQ.findOneAndUpdate(
          { _id: body.rfq, company: companyId },
          {
            status: 'Quoted',
            updatedBy: userId,
            $push: {
              statusHistory: {
                status: 'Quoted',
                updatedBy: userId,
                updatedAt: new Date(),
              },
            },
          }
        );
      } catch (rfqErr) {
        console.error("Failed to update linked RFQ status:", rfqErr);
      }
    }

    res.status(201).json({ message: "Quotation created successfully", quotation });
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(500).json({ message: error.message || "Failed to create quotation" });
  }
};
