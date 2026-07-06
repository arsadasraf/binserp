import { fgGRNSchema, fgItemSchema, fgInventoryMonthlySchema } from "../../models/store/index.js";
import { uploadOnS3, signPhotos } from "../../utils/s3.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

export const createFGGRN = async (req, res) => {
  try {
    const FGGRN = req.getModel('FGGRN', fgGRNSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const companyId = getCompanyId(req);
    
    let { grnNumber, date, items, qcRequired, status, remarks } = req.body;
    
    if (qcRequired === 'true') qcRequired = true;
    else if (qcRequired === 'false') qcRequired = false;
    else qcRequired = !!qcRequired;

    if (!grnNumber || !items) {
      return res.status(400).json({ message: "GRN number and items are required" });
    }

    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { }
    }

    let pdfUrl = null;
    if (req.files && req.files['pdf'] && req.files['pdf'][0]) {
      try {
        const uploadResult = await uploadOnS3(req.files['pdf'][0].path, "grn/pdf", getCompanyLoginId(req));
        if (uploadResult) pdfUrl = uploadResult.secure_url;
      } catch (error) { }
    }

    const photoUrls = [];
    if (req.files && req.files['photos'] && req.files['photos'].length > 0) {
      try {
        for (const file of req.files['photos']) {
          const uploadResult = await uploadOnS3(file.path, "grn/photos", companyId);
          if (uploadResult) photoUrls.push(uploadResult.secure_url);
        }
      } catch (error) { }
    }

    let itemsArray = [];
    for (const item of items) {
      const fgDoc = await FGItem.findById(item.fgItem);
      if (!fgDoc) return res.status(400).json({ message: `FG Item not found: ${item.fgItem}` });
      
      const qty = parseFloat(item.quantity);
      itemsArray.push({
        fgItem: fgDoc._id,
        itemName: fgDoc.name,
        quantity: qty,
        unit: item.unit || fgDoc.unit || 'Nos',
        receivedQuantity: qty,
        acceptedQuantity: qcRequired ? 0 : qty,
        rate: item.rate || 0,
      });
    }

    const newGRN = await FGGRN.create({
      company: companyId,
      grnNumber,
      date: date || new Date(),
      items: itemsArray,
      pdf: pdfUrl,
      photos: photoUrls,
      receivedBy: req.user.id,
      status: status || "Received",
      qcRequired,
      qcStatus: qcRequired ? "Pending" : "Skipped",
      remarks
    });

    // Auto-update FG Item stock if Accepted/Received
    if (!qcRequired && (newGRN.status === "Received" || newGRN.status === "Accepted")) {
      const currentDate = new Date();
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
      
      for (const item of itemsArray) {
         await FGItem.findByIdAndUpdate(item.fgItem, { $inc: { quantity: item.quantity } });
         
         try {
           await FGInventoryMonthly.findOneAndUpdate(
             { company: companyId, fgItem: item.fgItem, month: currentMonthStr },
             { $inc: { totalInwardQuantity: item.quantity } },
             { new: true, upsert: true }
           );
         } catch (monthlyErr) {
           console.error("Error updating FG monthly inward quantity:", monthlyErr);
         }
      }
    }

    res.status(201).json({ message: "FG GRN created successfully", grn: newGRN });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllFGGRNs = async (req, res) => {
  try {
    const FGGRN = req.getModel('FGGRN', fgGRNSchema);
    const companyId = getCompanyId(req);

    const grns = await FGGRN.find({ company: companyId })
      .populate('receivedBy', 'name userId')
      .populate('items.fgItem', 'name code type')
      .sort({ createdAt: -1 });

    const signedGrns = await Promise.all(grns.map(async (grn) => {
      const grnObj = grn.toObject();
      if (grnObj.photos && grnObj.photos.length > 0) grnObj.photos = await signPhotos(grnObj.photos);
      if (grnObj.pdf) grnObj.pdf = (await signPhotos([grnObj.pdf]))[0];
      return grnObj;
    }));

    res.status(200).json({ grns: signedGrns, count: signedGrns.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateFGGRN = async (req, res) => {
  try {
    const FGGRN = req.getModel('FGGRN', fgGRNSchema);
    const { id } = req.params;
    const companyId = getCompanyId(req);

    const updated = await FGGRN.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "FG GRN not found" });
    res.status(200).json({ message: "FG GRN updated successfully", grn: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteFGGRN = async (req, res) => {
  try {
    const FGGRN = req.getModel('FGGRN', fgGRNSchema);
    const { id } = req.params;
    const companyId = getCompanyId(req);

    const deleted = await FGGRN.findOneAndDelete({ _id: id, company: companyId });
    if (!deleted) return res.status(404).json({ message: "FG GRN not found" });

    res.status(200).json({ message: "FG GRN deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

