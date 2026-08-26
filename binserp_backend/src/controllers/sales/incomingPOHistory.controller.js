import { incomingPOSchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { customerSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getIncomingPODispatchHistory = asyncHandler(async (req, res) => {
  req.getModel("Customer", customerSchema);
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
  const Invoice = req.getModel("Invoice", invoiceSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  let poDoc = null;
  try {
    poDoc = await IncomingPO.findOne({
      company: companyId,
      $or: [
        { _id: id },
        { poNumber: id }
      ]
    });
  } catch (err) {
    poDoc = await IncomingPO.findOne({ company: companyId, poNumber: id });
  }

  const queryConditions = [];
  if (poDoc) {
    queryConditions.push({ incomingPO: poDoc._id });
    queryConditions.push({ customerPoReference: poDoc.poNumber });
    queryConditions.push({ customerPoReference: poDoc._id.toString() });
  }
  queryConditions.push({ customerPoReference: id });

  // Find DCs linked to this Customer PO
  const dcs = await DeliveryChallan.find({
    company: companyId,
    $or: queryConditions
  })
    .populate('customer', 'name email phone')
    .sort({ createdAt: -1 });

  // Find Invoices linked to this Customer PO
  const invoices = await Invoice.find({
    company: companyId,
    $or: queryConditions
  })
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
