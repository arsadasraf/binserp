import { incomingPOSchema, salesOrderSchema, quotationSchema, deliveryChallanSchema, invoiceSchema } from "../../models/sales/index.js";
import { mrpPlanSchema } from "../../models/purchase/index.js";
import { customerSchema, fgItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnS3 } from "../../utils/s3.js";
import { generateOrderNumber } from "./salesOrder.controller.js";
import { checkTimeLockGovernance } from "../../utils/timeLockGovernance.js";
import { generateUniqueOANumber } from "../../utils/oaNumberGenerator.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const createIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const companyId = getCompanyId(req);
  
  if (req.body.quotationReference === "") {
    delete req.body.quotationReference;
  }
  
  if (typeof req.body.items === 'string') {
    req.body.items = JSON.parse(req.body.items);
  }

  if (Array.isArray(req.body.items) && req.body.items.length > 0) {
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const fgIdsToFetch = req.body.items
      .filter(it => it.fgItem && !it.description)
      .map(it => it.fgItem);

    let fgMap = new Map();
    if (fgIdsToFetch.length > 0) {
      try {
        const fgs = await FGItem.find({ _id: { $in: fgIdsToFetch } }).select("description descriptions name");
        fgs.forEach(fg => fgMap.set(fg._id.toString(), fg));
      } catch (fgErr) {
        console.error("FG description lookup error:", fgErr);
      }
    }

    req.body.items = req.body.items.map(item => {
      const cleaned = { ...item };
      if (!cleaned.fgItem || cleaned.fgItem === "") delete cleaned.fgItem;
      if (!cleaned.expectedDeliveryDate || cleaned.expectedDeliveryDate === "") delete cleaned.expectedDeliveryDate;
      if (cleaned.fgItem && !cleaned.description && fgMap.has(cleaned.fgItem.toString())) {
        const fg = fgMap.get(cleaned.fgItem.toString());
        cleaned.description = fg.description || fg.descriptions || "";
      }
      return cleaned;
    });
  }

  let photoUrls = [];
  let pdfUrl = null;

  if (req.files) {
    if (req.files['photos'] && req.files['photos'].length > 0) {
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
        if (result?.url) photoUrls.push(result.url);
      }
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) pdfUrl = result.url;
    }
    if (req.files['document'] && req.files['document'].length > 0) {
      const file = req.files['document'][0];
      const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) {
        if (isPdf) {
          pdfUrl = result.url;
        } else {
          photoUrls.push(result.url);
        }
      }
    }
  }

  // 1. Create Incoming PO
  const userId = req.user?.id || req.user?._id;
  const initialStatus = req.body.status || "Received";

  const acknowledgementNumber = await generateUniqueOANumber({
    poNumber: req.body.poNumber,
    date: req.body.date || new Date(),
    companyId,
    IncomingPO,
  });

  const incomingPO = await IncomingPO.create({
    ...req.body,
    acknowledgementNumber,
    photos: photoUrls,
    pdf: pdfUrl,
    company: companyId,
    receivedBy: userId,
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
  
  // 2. Update Quotation status if quotationReference is provided
  if (incomingPO.quotationReference) {
    const Quotation = req.getModel("Quotation", quotationSchema);
    await Quotation.findOneAndUpdate(
      { _id: incomingPO.quotationReference, company: companyId },
      { status: "Accepted" }
    );
  }

  res.status(201).json({ 
    message: "Incoming PO created successfully", 
    incomingPO 
  });
});

export const generateSalesOrderFromPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const incomingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!incomingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  if (incomingPO.status === "Sales Order Generated") {
    return res.status(400).json({ message: "Sales Order already generated for this PO" });
  }

  const orderNumber = await generateOrderNumber(req);
  
  const salesOrder = await SalesOrder.create({
    company: companyId,
    orderNumber,
    orderType: "PO_BASED",
    poReference: incomingPO.poNumber,
    customer: incomingPO.customer,
    targetDate: incomingPO.items[0]?.expectedDeliveryDate || incomingPO.date,
    items: incomingPO.items.map(item => ({
      fgItem: item.fgItem,
      name: item.productName,
      description: item.description,
      quantity: item.quantity,
      pricePerQuantity: item.rate,
      totalPrice: item.amount,
      targetDate: item.expectedDeliveryDate,
    })),
    totalAmount: incomingPO.totalAmount,
    status: "Pending",
    createdBy: req.user.id,
    remarks: `Auto-generated from PO: ${incomingPO.poNumber}`,
  });

  incomingPO.status = "Sales Order Generated";
  await incomingPO.save();

  res.status(201).json({ 
    message: "Sales Order generated successfully", 
    salesOrder,
    incomingPO
  });
});

export const getAllIncomingPOs = asyncHandler(async (req, res) => {
  req.getModel("Customer", customerSchema);
  req.getModel("MRPPlan", mrpPlanSchema);
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const DeliveryChallan = req.getModel("DeliveryChallan", deliveryChallanSchema);
  const Invoice = req.getModel("Invoice", invoiceSchema);
  const companyId = getCompanyId(req);

  const queryFilter = { company: companyId };
  if (req.query.customer) {
    queryFilter.customer = req.query.customer;
  }
  if (req.query.openOnly === "true") {
    queryFilter.status = { $nin: ["Completed", "Cancelled"] };
  } else if (req.query.status) {
    queryFilter.status = req.query.status;
  }

  const pos = await IncomingPO.find(queryFilter)
    .sort({ createdAt: -1 })
    .populate("customer", "name companyName code email phone city")
    .populate("quotationReference", "quotationNumber")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name unit description descriptions specification category sellingPrice hsnCode");

  // Sync real-time fulfillment status for each PO based on DCs & Invoices
  for (const po of pos) {
    if (po.status === "Cancelled") continue;

    const dcs = await DeliveryChallan.find({
      company: companyId,
      $or: [
        { customerPoReference: po._id },
        { customerPoReference: po.poNumber },
        { customerPoNumber: po.poNumber },
      ]
    });
    const invoices = await Invoice.find({
      company: companyId,
      $or: [
        { customerPoReference: po._id },
        { customerPoReference: po.poNumber },
        { incomingPO: po._id },
      ]
    });

    const totalOrdered = (po.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);

    let totalDispatched = (po.items || []).reduce((sum, i) => sum + Number(i.dispatchedQuantity || 0), 0);
    if (dcs.length > 0) {
      const dcSum = dcs.reduce((acc, dc) => acc + (dc.items || []).reduce((iSum, it) => iSum + Number(it.quantity || 0), 0), 0);
      totalDispatched = Math.max(totalDispatched, dcSum);
    }

    let totalBilled = (po.items || []).reduce((sum, i) => sum + Number(i.billedQuantity || 0), 0);
    if (invoices.length > 0) {
      const invSum = invoices.reduce((acc, inv) => acc + (inv.items || []).reduce((iSum, it) => iSum + Number(it.quantity || 0), 0), 0);
      totalBilled = Math.max(totalBilled, invSum);
    }

    const effectiveFulfilled = Math.max(totalDispatched, totalBilled);

    if (totalOrdered > 0 && effectiveFulfilled > 0) {
      let expectedStatus = po.status;
      if (effectiveFulfilled >= totalOrdered) {
        expectedStatus = "Completed";
      } else {
        expectedStatus = "Partially Dispatched";
      }

      if (po.status !== expectedStatus) {
        po.status = expectedStatus;
        await IncomingPO.updateOne({ _id: po._id }, { status: expectedStatus });
      }
    }
  }

  // Auto-backfill unique OA numbers for any existing PO missing it or in legacy format
  for (const po of pos) {
    if (!po.acknowledgementNumber || !/^OA-\d{6}/.test(po.acknowledgementNumber)) {
      try {
        const oaNum = await generateUniqueOANumber({
          poNumber: po.poNumber,
          date: po.date || po.createdAt || new Date(),
          companyId,
          IncomingPO,
          excludeId: po._id,
        });
        po.acknowledgementNumber = oaNum;
        await IncomingPO.updateOne({ _id: po._id }, { acknowledgementNumber: oaNum });
      } catch (oaErr) {
        console.error("Auto backfill OA number error:", oaErr);
      }
    }
  }

  const filteredPos = req.query.openOnly === "true"
    ? pos.filter(po => po.status !== "Completed" && po.status !== "Cancelled")
    : pos;

  res.status(200).json({ pos: filteredPos });
});

export const updateIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  if (req.body.quotationReference === "") {
    delete req.body.quotationReference;
  }
  
  if (typeof req.body.items === 'string') {
    req.body.items = JSON.parse(req.body.items);
  }

  if (Array.isArray(req.body.items) && req.body.items.length > 0) {
    const FGItem = req.getModel("FGItem", fgItemSchema);
    const fgIdsToFetch = req.body.items
      .filter(it => it.fgItem && !it.description)
      .map(it => it.fgItem);

    let fgMap = new Map();
    if (fgIdsToFetch.length > 0) {
      try {
        const fgs = await FGItem.find({ _id: { $in: fgIdsToFetch } }).select("description descriptions name");
        fgs.forEach(fg => fgMap.set(fg._id.toString(), fg));
      } catch (fgErr) {
        console.error("FG description lookup error:", fgErr);
      }
    }

    req.body.items = req.body.items.map(item => {
      const cleaned = { ...item };
      if (!cleaned.fgItem || cleaned.fgItem === "") delete cleaned.fgItem;
      if (!cleaned.expectedDeliveryDate || cleaned.expectedDeliveryDate === "") delete cleaned.expectedDeliveryDate;
      if (cleaned.fgItem && !cleaned.description && fgMap.has(cleaned.fgItem.toString())) {
        const fg = fgMap.get(cleaned.fgItem.toString());
        cleaned.description = fg.description || fg.descriptions || "";
      }
      return cleaned;
    });
  }

  const existingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!existingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  // Dynamic time lock governance
  const lockCheck = await checkTimeLockGovernance(req, 'customerPo', existingPO.createdAt || existingPO.date, 'edit');
  if (!lockCheck.allowed) {
    return res.status(403).json({ message: lockCheck.message });
  }

  let photoUrls = req.body.existingPhotos || existingPO.photos;
  if (typeof photoUrls === 'string') photoUrls = JSON.parse(photoUrls);

  if (req.files) {
    if (req.files['photos'] && req.files['photos'].length > 0) {
      photoUrls = []; // If new photos are uploaded, replace old ones
      for (const file of req.files['photos']) {
        const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
        if (result?.url) photoUrls.push(result.url);
      }
    }
    if (req.files['pdf'] && req.files['pdf'].length > 0) {
      const file = req.files['pdf'][0];
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) req.body.pdf = result.url;
    }
    if (req.files['document'] && req.files['document'].length > 0) {
      const file = req.files['document'][0];
      const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
      const result = await uploadOnS3(file.path, "CustomerPOs", companyId);
      if (result?.url) {
        if (isPdf) {
          req.body.pdf = result.url;
        } else {
          photoUrls.push(result.url);
        }
      }
    }
  }

  req.body.photos = photoUrls;
  const userId = req.user?.id || req.user?._id;
  req.body.updatedBy = userId;

  if (!existingPO.acknowledgementNumber || !/^OA-\d{6}/.test(existingPO.acknowledgementNumber)) {
    req.body.acknowledgementNumber = await generateUniqueOANumber({
      poNumber: req.body.poNumber || existingPO.poNumber,
      date: req.body.date || existingPO.date || existingPO.createdAt,
      companyId,
      IncomingPO,
      excludeId: existingPO._id,
    });
  }

  if (req.body.status && req.body.status !== existingPO.status) {
    req.body.$push = {
      statusHistory: {
        status: req.body.status,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    };
  }

  const incomingPO = await IncomingPO.findOneAndUpdate(
    { _id: id, company: companyId },
    req.body,
    { new: true }
  )
    .populate("customer", "name companyName code email phone city")
    .populate("quotationReference", "quotationNumber")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name unit description descriptions specification category sellingPrice hsnCode");

  // Auto-sync linked Sales Order if one was already generated for this PO
  try {
    const SalesOrder = req.getModel("SalesOrder", salesOrderSchema);
    const linkedSO = await SalesOrder.findOne({
      company: companyId,
      $or: [
        { poReference: incomingPO.poNumber },
        { remarks: `Auto-generated from PO: ${incomingPO.poNumber}` }
      ]
    });

    if (linkedSO) {
      linkedSO.customer = incomingPO.customer?._id || incomingPO.customer;
      if (Array.isArray(incomingPO.items)) {
        linkedSO.items = incomingPO.items.map((item) => ({
          fgItem: item.fgItem?._id || item.fgItem,
          name: item.productName || item.fgItem?.name || "Product Item",
          description: item.description,
          quantity: item.quantity,
          pricePerQuantity: item.rate,
          totalPrice: item.amount || (item.quantity * item.rate),
          targetDate: item.expectedDeliveryDate || incomingPO.date,
        }));
      }
      linkedSO.totalAmount = incomingPO.totalAmount || incomingPO.subtotal || 0;
      await linkedSO.save();
    }
  } catch (soErr) {
    console.error("Auto-sync Sales Order error:", soErr);
  }

  res.status(200).json({ message: "Incoming PO updated successfully", incomingPO });
});

export const deleteIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);

  const existingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!existingPO) {
    return res.status(404).json({ message: "Incoming PO not found" });
  }

  // Dynamic time lock governance
  const lockCheck = await checkTimeLockGovernance(req, 'customerPo', existingPO.createdAt || existingPO.date, 'delete');
  if (!lockCheck.allowed) {
    return res.status(403).json({ message: lockCheck.message });
  }

  await IncomingPO.deleteOne({ _id: id, company: companyId });

  res.status(200).json({ message: "Incoming PO deleted successfully" });
});

export const acknowledgeIncomingPO = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const { id } = req.params;
  const companyId = getCompanyId(req);
  const userId = req.user?.id || req.user?._id;

  const incomingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!incomingPO) {
    return res.status(404).json({ message: "Customer PO not found" });
  }

  const {
    committedDispatchDate,
    acknowledgementRemarks,
    acknowledgementTerms,
    items: updatedItems,
  } = req.body;

  // 1. Update line item commitment dates (individual dates are optional per item)
  if (Array.isArray(updatedItems) && updatedItems.length > 0) {
    incomingPO.items.forEach((item) => {
      const match = updatedItems.find(
        (u) =>
          (u._id && u._id.toString() === item._id?.toString()) ||
          (u.fgItem && u.fgItem.toString() === item.fgItem?.toString()) ||
          (u.productName && u.productName.trim() === item.productName?.trim())
      );
      if (match) {
        if (match.committedDeliveryDate) {
          item.committedDeliveryDate = new Date(match.committedDeliveryDate);
        } else if (committedDispatchDate) {
          item.committedDeliveryDate = new Date(committedDispatchDate);
        }
      } else if (committedDispatchDate && !item.committedDeliveryDate) {
        item.committedDeliveryDate = new Date(committedDispatchDate);
      }
    });
  } else if (committedDispatchDate) {
    incomingPO.items.forEach((item) => {
      if (!item.committedDeliveryDate) {
        item.committedDeliveryDate = new Date(committedDispatchDate);
      }
    });
  }

  // 2. Acknowledgement Metadata
  if (req.body.acknowledgementNumber && /^OA-\d{6}/.test(req.body.acknowledgementNumber)) {
    incomingPO.acknowledgementNumber = req.body.acknowledgementNumber;
  } else if (!incomingPO.acknowledgementNumber || !/^OA-\d{6}/.test(incomingPO.acknowledgementNumber)) {
    incomingPO.acknowledgementNumber = await generateUniqueOANumber({
      poNumber: incomingPO.poNumber,
      date: incomingPO.date || incomingPO.createdAt || new Date(),
      companyId,
      IncomingPO,
      excludeId: incomingPO._id,
    });
  }
  incomingPO.acknowledgementDate = new Date();
  if (committedDispatchDate) {
    incomingPO.committedDispatchDate = new Date(committedDispatchDate);
  }
  if (acknowledgementRemarks !== undefined) {
    incomingPO.acknowledgementRemarks = acknowledgementRemarks;
  }
  if (acknowledgementTerms !== undefined) {
    incomingPO.acknowledgementTerms = acknowledgementTerms;
  }
  incomingPO.acknowledgedBy = userId;
  incomingPO.updatedBy = userId;

  // 3. Update Status to Accepted if currently Received
  if (incomingPO.status === "Received") {
    incomingPO.status = "Accepted";
    incomingPO.statusHistory.push({
      status: "Accepted",
      updatedBy: userId,
      updatedAt: new Date(),
    });
  }

  await incomingPO.save();

  const populated = await IncomingPO.findById(incomingPO._id)
    .populate("customer", "name companyName code email phone address city state gstin pan")
    .populate("quotationReference", "quotationNumber totalAmount date")
    .populate("acknowledgedBy", "name email")
    .populate("receivedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("statusHistory.updatedBy", "name email")
    .populate("items.fgItem", "name unit description descriptions specification category sellingPrice hsnCode");

  res.status(200).json({
    message: "Order Acknowledgement & Commitment saved successfully",
    incomingPO: populated,
  });
});

export const backfillOANumbers = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const companyId = getCompanyId(req);

  const pos = await IncomingPO.find({
    company: companyId,
    $or: [
      { acknowledgementNumber: { $exists: false } },
      { acknowledgementNumber: null },
      { acknowledgementNumber: "" },
      { acknowledgementNumber: { $not: /^OA-\d{6}/ } },
    ],
  });

  let updatedCount = 0;
  for (const po of pos) {
    const oaNum = await generateUniqueOANumber({
      poNumber: po.poNumber,
      date: po.date || po.createdAt || new Date(),
      companyId,
      IncomingPO,
      excludeId: po._id,
    });
    po.acknowledgementNumber = oaNum;
    await IncomingPO.updateOne({ _id: po._id }, { acknowledgementNumber: oaNum });
    updatedCount++;
  }

  res.status(200).json({
    message: `Backfilled OA numbers for ${updatedCount} customer PO(s)`,
    updatedCount,
  });
});

export const updatePODeliverySchedule = asyncHandler(async (req, res) => {
  const IncomingPO = req.getModel("IncomingPO", incomingPOSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ message: "Items array is required" });
  }

  const incomingPO = await IncomingPO.findOne({ _id: id, company: companyId });
  if (!incomingPO) {
    return res.status(404).json({ message: "Customer PO not found" });
  }

  // Update deliverySchedule on matching items by item ID or index
  items.forEach((updateItem, index) => {
    let target = null;
    if (updateItem._id || updateItem.itemId) {
      const matchId = String(updateItem._id || updateItem.itemId);
      target = incomingPO.items.find(it => String(it._id) === matchId);
    }
    if (!target && incomingPO.items[index]) {
      target = incomingPO.items[index];
    }

    if (target && Array.isArray(updateItem.deliverySchedule)) {
      const existingMap = new Map();
      (target.deliverySchedule || []).forEach(es => {
        if (es.monthKey) existingMap.set(es.monthKey, es);
      });

      target.deliverySchedule = updateItem.deliverySchedule
        .map(s => {
          const prev = existingMap.get(s.monthKey);
          const newQty = Math.max(0, Number(s.quantity) || 0);
          const plannedQty = s.plannedQuantity != null 
            ? Number(s.plannedQuantity) 
            : (prev?.plannedQuantity != null ? Number(prev.plannedQuantity) : (prev?.isPlanned ? Number(prev.quantity || 0) : 0));
          const linkedMrps = Array.isArray(s.linkedMrps) && s.linkedMrps.length > 0
            ? s.linkedMrps
            : (Array.isArray(prev?.linkedMrps) ? prev.linkedMrps : []);
          const mrpPlan = s.mrpPlan || prev?.mrpPlan;
          const mrpNumber = s.mrpNumber || prev?.mrpNumber || (linkedMrps[linkedMrps.length - 1]?.mrpNumber || "");
          const isPlanned = plannedQty >= newQty && newQty > 0;

          return {
            monthKey: s.monthKey,
            monthLabel: s.monthLabel || s.monthKey,
            quantity: newQty,
            plannedQuantity: plannedQty,
            targetDate: s.targetDate ? new Date(s.targetDate) : undefined,
            notes: s.notes || "",
            isPlanned,
            mrpPlan,
            mrpNumber,
            linkedMrps,
          };
        })
        .filter(s => s.quantity > 0 || s.monthKey);
    }
  });

  // Re-evaluate Customer PO overall status based on planned vs total demanded
  let totalPoDemanded = 0;
  let totalPoPlanned = 0;
  (incomingPO.items || []).forEach(it => {
    const itQty = Number(it.quantity || 0);
    totalPoDemanded += itQty;
    if (Array.isArray(it.deliverySchedule) && it.deliverySchedule.length > 0) {
      it.deliverySchedule.forEach(s => {
        totalPoPlanned += Number(s.plannedQuantity || (s.isPlanned ? s.quantity : 0) || 0);
      });
    } else {
      totalPoPlanned += Number(it.plannedQuantity || 0);
    }
  });

  if (totalPoPlanned >= totalPoDemanded && totalPoDemanded > 0) {
    incomingPO.status = "MRP Done";
  } else if (totalPoPlanned > 0) {
    incomingPO.status = "Partially Planned";
  }

  incomingPO.updatedBy = req.user?.id || req.user?._id;
  await incomingPO.save();

  const populated = await IncomingPO.findById(incomingPO._id)
    .populate("customer", "name email phone address gstin code")
    .populate("items.fgItem", "name unit description descriptions specification category sellingPrice hsnCode");

  res.status(200).json({
    success: true,
    message: "Monthly delivery schedule saved successfully",
    incomingPO: populated,
  });
});

