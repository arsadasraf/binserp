import { purchaseOrderSchema } from "../../models/purchase/index.js";
import { vendorSchema, grnSchema, rmBoItemSchema, rawMaterialSchema, boughtOutSchema, consumableItemSchema } from "../../models/store/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

import mongoose from "mongoose";

const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(String(id));

export const createPO = asyncHandler(async (req, res) => {
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);

  const {
    poNumber, date, vendor, vendorName, quotation, quotationNumber, rfqNumber,
    items, material, component, materialName, quantity, unit, rate, amount, category, status,
    transportType, transportCharge, packingType, packingCharge, subtotal, totalTax, grandTotal, remarks, description
  } = req.body;

  if (!poNumber) {
    throw new ApiError(400, "PO Number is required");
  }

  if (!vendor) {
    throw new ApiError(400, "Vendor is required to create PO");
  }

  const userName = req.user?.name || req.user?.username || req.user?.email || 'Admin';

  const poData = {
    company: companyId,
    poNumber,
    date: date || new Date(),
    vendor: isValidObjectId(vendor) ? vendor : vendor,
    vendorName,
    quotation: isValidObjectId(quotation) ? quotation : undefined,
    quotationNumber,
    rfqNumber,
    description: description || '',
    transportType: transportType || 'Road Freight',
    transportCharge: transportCharge != null ? Number(transportCharge) : 0,
    packingType: packingType || 'Standard Packaging',
    packingCharge: packingCharge != null ? Number(packingCharge) : 0,
    subtotal: subtotal != null ? Number(subtotal) : 0,
    totalTax: totalTax != null ? Number(totalTax) : 0,
    grandTotal: grandTotal != null ? Number(grandTotal) : 0,
    remarks: remarks || '',
    createdBy: req.user?.id || req.user?._id,
    createdByName: userName,
    updatedBy: req.user?.id || req.user?._id,
    updatedByName: userName,
    status: status || "Released",
    history: [{
      status: status || "Released",
      updatedBy: userName,
      updatedAt: new Date()
    }]
  };

  if (items && items.length > 0) {
    poData.items = items.map(item => {
      const qty = Number(item.quantity || 0);
      const recQty = Number(item.receivedQuantity || 0);
      const pendQty = item.pendingQuantity !== undefined ? Number(item.pendingQuantity) : Math.max(0, qty - recQty);
      const iStatus = recQty >= qty ? "Completed" : recQty > 0 ? "Partially Received" : "Pending";
      const validMatId = isValidObjectId(item.material) ? item.material : undefined;
      const validCompId = isValidObjectId(item.component) ? item.component : undefined;
      const matName = item.materialName || (!validMatId && item.material ? String(item.material) : 'Item');

      return {
        ...item,
        material: validMatId,
        component: validCompId,
        materialName: matName,
        itemType: (item.itemType || 'rm').toLowerCase(),
        description: item.description || item.itemDescription || item.remarks || item.specifications || description || '',
        quantity: qty,
        receivedQuantity: recQty,
        pendingQuantity: pendQty,
        itemStatus: iStatus,
        taxRate: item.taxRate != null ? Number(item.taxRate) : 18,
      };
    });
    poData.totalAmount = req.body.totalAmount || poData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  } else if (material || component || materialName) {
    const qty = Number(quantity || 0);
    const recQty = Number(req.body.receivedQuantity || 0);
    const pendQty = Math.max(0, qty - recQty);
    const validMatId = isValidObjectId(material) ? material : undefined;
    const validCompId = isValidObjectId(component) ? component : undefined;
    const matName = materialName || (!validMatId && material ? String(material) : 'Item');

    poData.material = validMatId;
    poData.component = validCompId;
    poData.materialName = matName;
    poData.quantity = qty;
    poData.receivedQuantity = recQty;
    poData.pendingQuantity = pendQty;
    poData.unit = unit;
    poData.rate = rate;
    poData.amount = amount;
    poData.category = category;
    poData.totalAmount = amount || (qty * rate);
    poData.items = [{
      material: validMatId,
      component: validCompId,
      materialName: matName,
      description: description || '',
      quantity: qty,
      receivedQuantity: recQty,
      pendingQuantity: pendQty,
      itemStatus: recQty >= qty ? "Completed" : recQty > 0 ? "Partially Received" : "Pending",
      unit: unit || "PCS",
      rate: rate || 0,
      taxRate: req.body.taxRate != null ? Number(req.body.taxRate) : 18,
      amount: amount || (qty * (rate || 0))
    }];
  } else {
    throw new ApiError(400, "Either items array or single material details are required");
  }

  const po = await PurchaseOrder.create(poData);

  res.status(201).json(new ApiResponse(201, po, "Purchase Order created successfully"));
});

export const getAllPOs = asyncHandler(async (req, res) => {
  req.getModel('Vendor', vendorSchema);
  req.getModel('RawMaterial', rawMaterialSchema);
  req.getModel('BoughtOut', boughtOutSchema);
  req.getModel('ConsumableItem', consumableItemSchema);
  req.getModel('RmBoItem', rmBoItemSchema);
  const GRN = req.getModel('GRN', grnSchema);
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);

  const companyId = getCompanyId(req);
  const pos = await PurchaseOrder.find({ company: companyId })
    .populate("vendor", "name code email phone address gst")
    .populate("material", "name code")
    .populate("items.material", "name code unit category")
    .populate("createdBy", "name username email")
    .populate("updatedBy", "name username email")
    .sort({ createdAt: -1 });

  // Fetch all GRNs linked to these POs
  const poIds = pos.map(p => p._id);
  const poNumbers = pos.map(p => p.poNumber).filter(Boolean);

  const grns = await GRN.find({
    company: companyId,
    $or: [
      { purchaseOrder: { $in: poIds } },
      { poNumber: { $in: poNumbers } }
    ]
  })
    .populate("receivedBy", "name username email")
    .sort({ date: -1, createdAt: -1 });

  // Build lookup map of GRNs by PO ID and poNumber
  const grnMap = {};
  grns.forEach(g => {
    const gObj = g.toObject();
    const keyId = gObj.purchaseOrder?.toString();
    const keyNum = gObj.poNumber;

    if (keyId) {
      if (!grnMap[keyId]) grnMap[keyId] = [];
      grnMap[keyId].push(gObj);
    }
    if (keyNum) {
      if (!grnMap[keyNum]) grnMap[keyNum] = [];
      grnMap[keyNum].push(gObj);
    }
  });

  const posWithVendorName = pos.map(po => {
    const poObj = po.toObject();
    if (poObj.vendor) {
      poObj.vendorName = poObj.vendor.name;
    }

    // Attach linked GRNs (deduplicated)
    const rawGrns = (grnMap[poObj._id.toString()] || []).concat(
      poObj.poNumber && grnMap[poObj.poNumber] ? grnMap[poObj.poNumber] : []
    );

    const uniqueGrnsMap = {};
    rawGrns.forEach(g => { uniqueGrnsMap[g._id.toString()] = g; });
    poObj.linkedGrns = Object.values(uniqueGrnsMap);

    // Ensure items have received & pending quantity computed for UI
    if (Array.isArray(poObj.items)) {
      poObj.items = poObj.items.map(it => ({
        ...it,
        receivedQuantity: it.receivedQuantity || 0,
        pendingQuantity: it.pendingQuantity !== undefined ? it.pendingQuantity : Math.max(0, (it.quantity || 0) - (it.receivedQuantity || 0)),
        itemStatus: it.itemStatus || ((it.receivedQuantity || 0) >= (it.quantity || 0) ? "Completed" : (it.receivedQuantity || 0) > 0 ? "Partially Received" : "Pending")
      }));
    }
    return poObj;
  });

  res.status(200).json({ pos: posWithVendorName, count: pos.length });
});

export const getVendorActivePOs = asyncHandler(async (req, res) => {
  req.getModel('Vendor', vendorSchema);
  req.getModel('RmBoItem', rmBoItemSchema);
  req.getModel('RawMaterial', rawMaterialSchema);
  req.getModel('BoughtOut', boughtOutSchema);
  req.getModel('ConsumableItem', consumableItemSchema);
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);
  const { vendorId } = req.params;

  const query = {
    company: companyId,
    status: { $nin: ["Completed", "Cancelled"] }
  };
  if (vendorId && vendorId !== 'all') {
    query.vendor = vendorId;
  }

  const pos = await PurchaseOrder.find(query)
    .populate("vendor", "name code")
    .populate("items.material", "name code unit category")
    .sort({ date: -1 });

  const posFormatted = pos.map(po => {
    const poObj = po.toObject();
    if (Array.isArray(poObj.items)) {
      poObj.items = poObj.items.map(it => ({
        ...it,
        receivedQuantity: it.receivedQuantity || 0,
        pendingQuantity: it.pendingQuantity !== undefined ? it.pendingQuantity : Math.max(0, (it.quantity || 0) - (it.receivedQuantity || 0)),
      }));
    }
    return poObj;
  });

  res.status(200).json(new ApiResponse(200, posFormatted, "Active Vendor POs retrieved successfully"));
});

export const getVendorPOBucket = asyncHandler(async (req, res) => {
  req.getModel('RmBoItem', rmBoItemSchema);
  const Vendor = req.getModel('Vendor', vendorSchema);
  const GRN = req.getModel('GRN', grnSchema);
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);

  const vendors = await Vendor.find({ company: companyId }).sort({ name: 1 });
  const pos = await PurchaseOrder.find({ company: companyId })
    .populate("vendor", "name code email phone address gst")
    .populate("items.material", "name code")
    .sort({ createdAt: -1 });

  const grns = await GRN.find({ company: companyId })
    .select("grnNumber date supplier purchaseOrder poNumber items status qcStatus")
    .sort({ date: -1 });

  // Map GRNs by PO ID or poNumber
  const grnByPoMap = {};
  grns.forEach(grn => {
    const key = grn.purchaseOrder ? grn.purchaseOrder.toString() : grn.poNumber;
    if (key) {
      if (!grnByPoMap[key]) grnByPoMap[key] = [];
      grnByPoMap[key].push(grn.toObject());
    }
  });

  // Group POs by Vendor
  const bucketMap = {};

  vendors.forEach(v => {
    bucketMap[v._id.toString()] = {
      vendor: {
        _id: v._id,
        name: v.name,
        code: v.code,
        email: v.email,
        phone: v.phone,
        address: v.address || v.billingAddress || '',
        gst: v.gst
      },
      metrics: {
        totalPOs: 0,
        releasedPOs: 0,
        partiallyReceivedPOs: 0,
        completedPOs: 0,
        totalOrderedValue: 0,
        totalReceivedValue: 0,
        totalPendingValue: 0
      },
      pos: []
    };
  });

  // Process POs into buckets
  pos.forEach(po => {
    const poObj = po.toObject();
    const vendorId = poObj.vendor?._id ? poObj.vendor._id.toString() : (typeof poObj.vendor === 'string' ? poObj.vendor : null);

    // Compute item level received & pending quantities if missing
    let poTotalOrderedVal = Number(poObj.totalAmount || 0);
    let poTotalReceivedVal = 0;
    let poTotalPendingVal = 0;

    if (Array.isArray(poObj.items) && poObj.items.length > 0) {
      poObj.items = poObj.items.map(it => {
        const qty = Number(it.quantity || 0);
        const recQty = Number(it.receivedQuantity || 0);
        const pendQty = it.pendingQuantity !== undefined ? Number(it.pendingQuantity) : Math.max(0, qty - recQty);
        const rate = Number(it.rate || 0);

        poTotalReceivedVal += recQty * rate;
        poTotalPendingVal += pendQty * rate;

        return {
          ...it,
          quantity: qty,
          receivedQuantity: recQty,
          pendingQuantity: pendQty,
          itemStatus: it.itemStatus || (recQty >= qty ? "Completed" : recQty > 0 ? "Partially Received" : "Pending")
        };
      });
    } else {
      const qty = Number(poObj.quantity || 0);
      const recQty = Number(poObj.receivedQuantity || 0);
      const pendQty = Math.max(0, qty - recQty);
      const rate = Number(poObj.rate || 0);

      poTotalReceivedVal = recQty * rate;
      poTotalPendingVal = pendQty * rate;
      poObj.items = [{
        materialName: poObj.materialName || "Material Item",
        quantity: qty,
        receivedQuantity: recQty,
        pendingQuantity: pendQty,
        unit: poObj.unit || "PCS",
        rate: rate,
        amount: poObj.amount || (qty * rate),
        itemStatus: recQty >= qty ? "Completed" : recQty > 0 ? "Partially Received" : "Pending"
      }];
    }

    poObj.poTotalReceivedVal = poTotalReceivedVal;
    poObj.poTotalPendingVal = poTotalPendingVal;

    // Attach linked GRNs
    const linkedGrns = (grnByPoMap[poObj._id.toString()] || []).concat(
      (poObj.poNumber && grnByPoMap[poObj.poNumber]) ? grnByPoMap[poObj.poNumber] : []
    );

    // Deduplicate GRNs
    const uniqueGrnsMap = {};
    linkedGrns.forEach(g => { uniqueGrnsMap[g._id.toString()] = g; });
    poObj.transactions = Object.values(uniqueGrnsMap);

    if (vendorId && bucketMap[vendorId]) {
      const bucket = bucketMap[vendorId];
      bucket.pos.push(poObj);
      bucket.metrics.totalPOs += 1;
      if (poObj.status === "Completed") bucket.metrics.completedPOs += 1;
      else if (poObj.status === "Partially Received") bucket.metrics.partiallyReceivedPOs += 1;
      else bucket.metrics.releasedPOs += 1;

      bucket.metrics.totalOrderedValue += poTotalOrderedVal;
      bucket.metrics.totalReceivedValue += poTotalReceivedVal;
      bucket.metrics.totalPendingValue += poTotalPendingVal;
    }
  });

  const vendorBuckets = Object.values(bucketMap).filter(b => b.metrics.totalPOs > 0 || vendors.length <= 10);

  // Overall Global Summary
  const globalMetrics = {
    totalVendors: vendors.length,
    vendorsWithActivePOs: vendorBuckets.filter(b => b.metrics.releasedPOs > 0 || b.metrics.partiallyReceivedPOs > 0).length,
    totalPOs: pos.length,
    totalOrderedValue: pos.reduce((s, p) => s + (p.totalAmount || 0), 0),
    totalReceivedValue: vendorBuckets.reduce((s, b) => s + b.metrics.totalReceivedValue, 0),
    totalPendingValue: vendorBuckets.reduce((s, b) => s + b.metrics.totalPendingValue, 0)
  };

  res.status(200).json(new ApiResponse(200, { buckets: vendorBuckets, globalMetrics }, "Vendor PO Bucket retrieved successfully"));
});

export const updatePO = asyncHandler(async (req, res) => {
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const userName = req.user?.name || req.user?.username || req.user?.email || 'Admin';

  const existingPO = await PurchaseOrder.findOne({ _id: id, company: companyId });
  if (!existingPO) {
    throw new ApiError(404, "PO not found");
  }

  const updateData = { ...req.body };
  updateData.updatedBy = req.user?.id || req.user?._id;
  updateData.updatedByName = userName;

  if (req.body.status && req.body.status !== existingPO.status) {
    const newHistoryItem = {
      status: req.body.status,
      updatedBy: userName,
      updatedAt: new Date()
    };
    updateData.$push = { history: newHistoryItem };
  }

  const po = await PurchaseOrder.findOneAndUpdate(
    { _id: id, company: companyId },
    updateData,
    { new: true }
  );

  res.status(200).json(new ApiResponse(200, po, "PO updated successfully"));
});

export const deletePO = asyncHandler(async (req, res) => {
  const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const po = await PurchaseOrder.findOne({ _id: id, company: companyId });
  if (!po) {
    throw new ApiError(404, "PO not found");
  }

  const createdTime = new Date(po.createdAt || po.date).getTime();
  const isOlderThan24Hours = (Date.now() - createdTime) > 24 * 60 * 60 * 1000;

  if (isOlderThan24Hours) {
    throw new ApiError(400, "PO cannot be deleted after 24 hours of creation");
  }

  await PurchaseOrder.deleteOne({ _id: id, company: companyId });

  res.status(200).json(new ApiResponse(200, {}, "PO deleted successfully"));
});
