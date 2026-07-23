import { incomingPOSchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getIncomingPODispatchHistory = asyncHandler(async (req, res) => {
  const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
  const Invoice = req.getModel("Invoice", invoiceSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  // Find DCs linked to this Customer PO
  const dcs = await DeliveryChallan.find({ customerPoReference: id, company: companyId })
    .populate('customer', 'name email phone')
    .sort({ createdAt: -1 });

  // Find Invoices linked to this Customer PO
  const invoices = await Invoice.find({ customerPoReference: id, company: companyId })
    .populate('customer', 'name email phone')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      deliveryChallans: dcs,
      invoices: invoices
    }
  });
});
