import { ppcProductSchema } from "../../models/ppc/index.js";
import { fgItemSchema } from "../../models/store/index.js";
import { processSchema } from "../../models/ppc/process.model.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getPPCProductsStatus = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const PPCProduct = req.getModel('PPCProduct', ppcProductSchema);

    // Fetch all FG items
    const fgItems = await FGItem.find({ company: companyId })
      .populate('bom.item', 'name componentName code componentCode unit') 
      .sort({ createdAt: -1 })
      .lean();

    // Fetch all PPC Products to check routing status
    const ppcProducts = await PPCProduct.find({ company: companyId }).lean();
    
    // Map them for quick lookup
    const routingMap = new Map();
    ppcProducts.forEach(prod => {
      routingMap.set(prod.fgItem.toString(), prod);
    });

    // Attach routing status and details
    const result = fgItems.map(item => {
      const routingRecord = routingMap.get(item._id.toString());
      return {
        ...item,
        isRoutingAttached: !!routingRecord,
        ppcProduct: routingRecord || null
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const savePPCProduct = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user.id;
    const { fgItemId, routing, updatedBom } = req.body;

    const PPCProduct = req.getModel('PPCProduct', ppcProductSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);

    // 1. Update the original FGItem's BOM if provided
    if (updatedBom && Array.isArray(updatedBom)) {
       await FGItem.updateOne(
         { _id: fgItemId, company: companyId },
         { $set: { bom: updatedBom } }
       );
    }

    // 2. Save routing profile in PPC
    let ppcProduct = await PPCProduct.findOne({ company: companyId, fgItem: fgItemId });

    if (ppcProduct) {
      // Update existing
      ppcProduct.routing = routing || [];
      ppcProduct.updatedBy = userId;
      await ppcProduct.save();
    } else {
      // Create new
      ppcProduct = await PPCProduct.create({
        company: companyId,
        fgItem: fgItemId,
        routing: routing || [],
        createdBy: userId,
        updatedBy: userId
      });
    }

    res.status(200).json({ success: true, message: "PPC Product routing saved successfully", data: ppcProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
