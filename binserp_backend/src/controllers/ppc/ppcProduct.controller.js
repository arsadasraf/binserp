import { ppcProductSchema } from "../../models/ppc/index.js";
import { fgItemSchema } from "../../models/store/index.js";
import { processSchema } from "../../models/ppc/process.model.js";
import { machineSchema } from "../../models/ppc/machine.model.js";
import { workstationSchema } from "../../models/ppc/workstation.model.js";
import { jobWorkSupplierSchema } from "../../models/store/jobWorkSupplier.model.js";
import { QualityMasterSchema } from "../../models/quality/qualityMaster.model.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const getPPCProductsStatus = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const PPCProduct = req.getModel('PPCProduct', ppcProductSchema);

    // Register referenced models on the request tenant DB
    req.getModel('Process', processSchema);
    req.getModel('Machine', machineSchema);
    req.getModel('Workstation', workstationSchema);
    req.getModel('JobWorkSupplier', jobWorkSupplierSchema);
    req.getModel('QualityMaster', QualityMasterSchema);

    // Fetch all FG items
    const fgItems = await FGItem.find({ company: companyId })
      .populate('bom.item', 'name componentName code componentCode unit') 
      .sort({ createdAt: -1 })
      .lean();

    // Fetch all PPC Products with populated routing details
    const ppcProducts = await PPCProduct.find({ company: companyId })
      .populate('routing.process', 'processName processCode description')
      .populate('routing.machine', 'machineName machineCode')
      .populate('routing.workstation', 'workstationName name code')
      .populate('routing.supplier', 'name code contactPerson phone email')
      .populate('routing.qualityMaster', 'name type parameters')
      .lean();
    
    // Map them for quick lookup
    const routingMap = new Map();
    ppcProducts.forEach(prod => {
      if (prod.fgItem) {
        routingMap.set(prod.fgItem.toString(), prod);
      }
    });

    // Attach routing status and details
    const result = fgItems.map(item => {
      const routingRecord = routingMap.get(item._id.toString());
      return {
        ...item,
        isRoutingAttached: !!(routingRecord && routingRecord.routing && routingRecord.routing.length > 0),
        ppcProduct: routingRecord || null
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getPPCProductsStatus:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const savePPCProduct = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = req.user.id;
    const { fgItemId, routing, updatedBom } = req.body;

    if (!fgItemId) {
      return res.status(400).json({ success: false, message: "fgItemId is required" });
    }

    const PPCProduct = req.getModel('PPCProduct', ppcProductSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);

    // 1. Update the original FGItem's BOM if provided
    if (updatedBom && Array.isArray(updatedBom)) {
      const sanitizedBom = updatedBom
        .filter(b => b && (b.item || b._id))
        .map(b => ({
          itemType: b.itemType || "Material",
          item: typeof b.item === 'object' && b.item !== null ? b.item._id : b.item,
          itemName: b.itemName || (b.item && b.item.name) || "Item",
          quantity: Number(b.quantity) || 1,
          unit: b.unit || "Nos"
        }));

      await FGItem.updateOne(
        { _id: fgItemId, company: companyId },
        { $set: { bom: sanitizedBom } }
      );
    }

    // 2. Sanitize and format routing steps
    const cleanedRouting = (Array.isArray(routing) ? routing : []).map((step, idx) => {
      const processId = typeof step.process === 'object' && step.process !== null ? step.process._id : step.process;
      const machineId = typeof step.machine === 'object' && step.machine !== null ? step.machine._id : (step.machine || undefined);
      const workstationId = typeof step.workstation === 'object' && step.workstation !== null ? step.workstation._id : (step.workstation || undefined);
      const machineCategoryId = typeof step.machineCategory === 'object' && step.machineCategory !== null ? step.machineCategory._id : (step.machineCategory || undefined);
      const supplierId = typeof step.supplier === 'object' && step.supplier !== null ? step.supplier._id : (step.supplier || undefined);
      const qualityMasterId = typeof step.qualityMaster === 'object' && step.qualityMaster !== null ? step.qualityMaster._id : (step.qualityMaster || undefined);

      const isOutside = step.processType === "Outside" || step.isOutsourced === true;

      // Clean BOM requirements
      const bomRequirements = Array.isArray(step.bomRequirements)
        ? step.bomRequirements
            .filter((req) => req && (req.item || req._id))
            .map((req) => ({
              item: typeof req.item === 'object' && req.item !== null ? req.item._id : req.item,
              itemType: req.itemType || "Material",
              itemName: req.itemName || "Item",
              itemCode: req.itemCode || "",
              quantity: Number(req.quantity) || 1,
              unit: req.unit || "Nos",
              scrapPercentage: Number(req.scrapPercentage) || 0,
              notes: req.notes || "",
            }))
        : [];

      // Clean Inspection parameters
      const inspectionParameters = Array.isArray(step.inspectionParameters)
        ? step.inspectionParameters
            .filter((p) => p && p.parameterName)
            .map((p) => ({
              parameterName: p.parameterName,
              specification: p.specification || "",
              tolerance: p.tolerance || "",
              method: p.method || "",
              sampleSize: p.sampleSize || "100%",
              mandatory: p.mandatory !== false,
            }))
        : [];

      // Clean Photos
      const photos = Array.isArray(step.photos)
        ? step.photos
            .filter((p) => (typeof p === 'string' && p.trim()) || (typeof p === 'object' && p && (p.url || p.secure_url)))
            .map((p) => ({
              url: typeof p === 'string' ? p : (p.url || p.secure_url),
              name: (typeof p === 'object' && p.name) || "Photo",
              caption: (typeof p === 'object' && p.caption) || "",
              uploadedAt: (typeof p === 'object' && p.uploadedAt) ? new Date(p.uploadedAt) : new Date(),
            }))
        : [];

      // Clean Documents (PDFs)
      const documents = Array.isArray(step.documents)
        ? step.documents
            .filter((d) => (typeof d === 'string' && d.trim()) || (typeof d === 'object' && d && (d.url || d.secure_url)))
            .map((d) => ({
              url: typeof d === 'string' ? d : (d.url || d.secure_url),
              name: (typeof d === 'object' && d.name) || "Document.pdf",
              fileType: (typeof d === 'object' && d.fileType) || "pdf",
              size: (typeof d === 'object' && Number(d.size)) || 0,
              uploadedAt: (typeof d === 'object' && d.uploadedAt) ? new Date(d.uploadedAt) : new Date(),
            }))
        : [];

      return {
        sequence: Number(step.sequence) || (idx + 1) * 10,
        stepName: step.stepName || "",
        process: processId,
        processName: step.processName || "",
        processType: isOutside ? "Outside" : "Inside",
        isOutsourced: isOutside,
        workstation: workstationId,
        machine: machineId,
        machineCategory: machineCategoryId,
        setupTime: Number(step.setupTime) || 0,
        cycleTime: Number(step.cycleTime) || 0,
        supplier: supplierId,
        supplierName: step.supplierName || "",
        leadTimeDays: Number(step.leadTimeDays) || 1,
        jobWorkRate: Number(step.jobWorkRate) || 0,
        outsideInstructions: step.outsideInstructions || "",
        photos,
        documents,
        qcRequired: Boolean(step.qcRequired),
        qcStage: step.qcStage || "In-Process",
        qualityMaster: qualityMasterId,
        isMandatoryPass: step.isMandatoryPass !== false,
        inspectionParameters,
        bomRequirements,
        description: step.description || "",
      };
    });

    // 3. Save routing profile in PPC
    let ppcProduct = await PPCProduct.findOne({ company: companyId, fgItem: fgItemId });

    if (ppcProduct) {
      // Update existing
      ppcProduct.routing = cleanedRouting;
      ppcProduct.updatedBy = userId;
      await ppcProduct.save();
    } else {
      // Create new
      ppcProduct = await PPCProduct.create({
        company: companyId,
        fgItem: fgItemId,
        routing: cleanedRouting,
        createdBy: userId,
        updatedBy: userId
      });
    }

    // Populate for response
    const populatedProduct = await PPCProduct.findById(ppcProduct._id)
      .populate('routing.process', 'processName processCode')
      .populate('routing.machine', 'machineName machineCode')
      .populate('routing.workstation', 'workstationName name code')
      .populate('routing.supplier', 'name code')
      .populate('routing.qualityMaster', 'name type parameters')
      .lean();

    res.status(200).json({
      success: true,
      message: "PPC Product routing saved successfully",
      data: populatedProduct,
    });
  } catch (error) {
    console.error("Error in savePPCProduct:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

