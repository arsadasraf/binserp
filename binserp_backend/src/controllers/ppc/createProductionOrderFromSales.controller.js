import { productionOrderSchema, ppcProductSchema } from "../../models/ppc/index.js";
import { fgItemSchema, inventorySchema } from "../../models/store/index.js";
import { customerSchema } from "../../models/store/index.js";

export const generateProductionOrderForSalesOrder = async (req, salesOrder, planDetails) => {
  const ProductionOrder = req.getModel("ProductionOrder", productionOrderSchema);
  const PPCProduct = req.getModel("PPCProduct", ppcProductSchema);
  const FGItem = req.getModel("FGItem", fgItemSchema);
  const Customer = req.getModel("Customer", customerSchema);
  
  try {
    const companyId = salesOrder.company;
    
    // Check if one already exists to avoid duplicates
    const existingPO = await ProductionOrder.findOne({ company: companyId, poReference: salesOrder.orderNumber });
    if (existingPO) {
      console.log("Production Order already exists for SO:", salesOrder.orderNumber);
      return;
    }

    const fgItems = [];
    
    for (const item of salesOrder.items) {
      const fgItemId = item.fgItem || item.product;
      if (!fgItemId) continue;
      
      let productionQty = item.quantity;
      if (planDetails && Array.isArray(planDetails)) {
        const pd = planDetails.find(p => p.fgItem?.toString() === fgItemId.toString());
        if (pd && pd.productionQty !== undefined) {
           productionQty = Number(pd.productionQty);
        }
      }
      
      if (productionQty <= 0) continue;

      // Check if it's an FG item
      const fgItem = await FGItem.findOne({ _id: fgItemId, company: companyId }).populate('bom.item');
      if (fgItem) {
        // Prepare snapshots
        const bomSnapshot = (fgItem.bom || []).map(b => ({
          item: b.item?._id || b.item,
          itemModel: b.itemType,
          itemName: b.itemName,
          quantity: b.quantity,
          unit: b.unit
        }));

        // Retrieve rich routing from PPCProduct
        const ppcProduct = await PPCProduct.findOne({ company: companyId, fgItem: fgItem._id })
          .populate('routing.process')
          .populate('routing.machine')
          .lean();

        const routingSteps = (ppcProduct && ppcProduct.routing && ppcProduct.routing.length > 0)
          ? ppcProduct.routing
          : (fgItem.routing || []);

        const processSnapshot = routingSteps.map(r => ({
          sequence: r.sequence || 10,
          stepName: r.stepName || (r.process && r.process.processName) || 'Step',
          processName: r.processName || (r.process && r.process.processName) || 'Unnamed Process',
          processType: r.processType || (r.isOutsourced ? "Outside" : "Inside"),
          standardTime: r.cycleTime || r.standardTime || 0,
          setupTime: r.setupTime || 0,
          cycleTime: r.cycleTime || 0,
          description: r.description || r.outsideInstructions || '',
          machine: r.machine?._id || r.machine,
          workstation: r.workstation?._id || r.workstation,
          supplier: r.supplier?._id || r.supplier,
          supplierName: r.supplierName || '',
          leadTimeDays: r.leadTimeDays || 1,
          jobWorkRate: r.jobWorkRate || 0,
          isJobWork: r.processType === "Outside" || r.isOutsourced || false,
          photos: r.photos || [],
          documents: r.documents || [],
          qcRequired: Boolean(r.qcRequired),
          qcStage: r.qcStage || "In-Process",
          inspectionParameters: r.inspectionParameters || [],
          bomRequirements: r.bomRequirements || []
        }));

        fgItems.push({
          product: fgItem._id,
          productName: fgItem.name || item.productName,
          productCode: fgItem.code || fgItem.partNumber,
          description: fgItem.description,
          unit: fgItem.unit || item.unit,
          price: item.pricePerQuantity || 0,
          quantity: productionQty,
          trackingType: "Individual", // default
          targetDate: salesOrder.expectedDeliveryDate || salesOrder.date,
          bomSnapshot,
          processSnapshot,
          photosSnapshot: fgItem.photos || [],
          jobs: []
        });
      }
    }

    if (fgItems.length === 0) {
      console.log("No FG items found in Sales Order for Production Order bucket");
      return;
    }

    let customerName = salesOrder.customerName;
    if (!customerName && salesOrder.customer) {
       const cust = await Customer.findById(salesOrder.customer);
       if (cust) customerName = cust.name;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const productionOrder = new ProductionOrder({
      company: companyId,
      orderNumber: `PRD-${salesOrder.orderNumber}-${randomSuffix}`,
      poReference: salesOrder.orderNumber,
      customerPoReference: salesOrder.poReference,
      customer: salesOrder.customer,
      customerName: customerName,
      deliveryDate: salesOrder.expectedDeliveryDate || new Date(new Date().setDate(new Date().getDate() + 30)),
      status: "Pending", // Intake Bucket status
      items: fgItems,
      createdBy: req.user?.id || salesOrder.createdBy,
      remarks: salesOrder.notes || "Auto-generated from Sales Order"
    });

    await productionOrder.save();
    console.log("Successfully created Production Order bucket for SO:", salesOrder.orderNumber);

  } catch (error) {
    console.error("Error creating Production Order from Sales Order:", error);
  }
};
