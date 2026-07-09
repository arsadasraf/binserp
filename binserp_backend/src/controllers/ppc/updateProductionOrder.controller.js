import {
  componentSchema,
  productionOrderSchema,
} from "../../models/ppc/index.js";
import { fgItemSchema } from "../../models/store/index.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

export const updateProductionOrder = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { orderNumber, customerName, customer, poReference, deliveryDate, deadlineDate, targetMonth, remarks } = req.body;
    let { items } = req.body;

    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }

    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Component = req.getModel('Component', componentSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);

    const existingOrder = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!existingOrder) {
      return res.status(404).json({ message: "Production Order not found" });
    }

    const photoUrls = req.files && req.files.length > 0 
      ? req.files.map((file) => `/${file.path.replace(/\\\\/g, '/')}`) 
      : existingOrder.photos;

    const orderItems = [];

    if (items && Array.isArray(items)) {
      for (const item of items) {
        const productId = item.product || item.componentId;
        if (!productId) continue;

        let masterProduct = await Component.findById(productId).populate('routing.process');
        let isFGItem = false;

        if (!masterProduct) {
          masterProduct = await FGItem.findById(productId).populate('bom.item');
          isFGItem = true;
        }

        if (!masterProduct) continue;

        const productCode = isFGItem ? masterProduct.code : masterProduct.componentCode;
        const productName = isFGItem ? masterProduct.name : masterProduct.componentName;
        const description = masterProduct.description;
        const unit = masterProduct.unit;

        const bomSnapshot = isFGItem ? (masterProduct.bom || []).map(b => ({
          item: b.item?._id || b.item,
          itemModel: b.itemType,
          itemName: b.itemName,
          quantity: b.quantity,
          unit: b.unit
        })) : (masterProduct.billOfMaterials || []);

        const processSnapshot = isFGItem ? [] : (masterProduct.routing || []).map(r => ({
          processName: r.processName || (r.process && r.process.processName) || 'Unnamed Process',
          standardTime: r.standardTime,
          description: r.description,
          machine: r.machine,
          isJobWork: r.isOutsourced || r.isJobWork || false
        }));
        
        const photosSnapshot = masterProduct.photos || [];

        // Check if item already exists in the existing order to retain jobs etc (if applicable)
        const existingItem = (existingOrder.items || []).find(ei => ei.product && ei.product.toString() === productId.toString());

        orderItems.push({
          product: productId,
          productName,
          productCode,
          description,
          unit,
          price: item.price || 0,
          quantity: item.quantity,
          trackingType: item.trackingType || 'Individual',
          targetDate: item.targetDate ? new Date(item.targetDate) : undefined,
          bomSnapshot,
          processSnapshot,
          photosSnapshot,
          jobs: existingItem ? existingItem.jobs : []
        });
      }
    }

    existingOrder.orderNumber = orderNumber || existingOrder.orderNumber;
    existingOrder.poReference = poReference || existingOrder.poReference;
    existingOrder.targetMonth = targetMonth || existingOrder.targetMonth;
    existingOrder.customer = customer || existingOrder.customer;
    existingOrder.customerName = customerName || existingOrder.customerName;
    existingOrder.deliveryDate = (deliveryDate || deadlineDate) ? new Date(deliveryDate || deadlineDate) : existingOrder.deliveryDate;
    existingOrder.remarks = remarks !== undefined ? remarks : existingOrder.remarks;
    
    if (req.files && req.files.length > 0) {
      existingOrder.photos = photoUrls;
    }
    
    if (orderItems.length > 0) {
      existingOrder.items = orderItems;
    }

    await existingOrder.save();

    res.status(200).json({ success: true, order: existingOrder });
  } catch (error) {
    console.error('Error updating Production Order:', error);
    res.status(500).json({ message: error.message });
  }
};
