import {
  orderSchema,
  ppcOrderSchema,
  routeCardSchema,
  machineSchema,
  manpowerSchema,
  jobSchema,
  componentSchema,
  workOrderSchema,
  processSchema,
  machineCategorySchema,
  machineLocationSchema,
  manpowerAllotmentSchema,
  machineDayPlanSchema, // Added machineDayPlanSchema
  materialRequirementSchema,
  machineAssignmentSchema,
  machineMaintenanceSchema,
} from "../models/ppc/index.js";
import { employeeSchema } from "../models/hr/index.js";
import { bomSchema, inventorySchema, fgItemSchema } from "../models/store/index.js";
import { autoScheduleOrder } from "../services/planning.service.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../utils/s3.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ========== ORDER MANAGEMENT ==========

export const createOrder = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const {
      orderNumber,
      customerName,
      poReference,
      productCode,
      productName,
      quantity,
      dispatchDate,
      priority,
      bom,
      remarks,
    } = req.body;

    // 400 Bad Request if missing fields
    if (!orderNumber || !customerName || !productCode || !productName || !quantity || !dispatchDate) {
      return res.status(400).json({
        message: "Order number, customer name, product code, product name, quantity, and dispatch date are required",
      });
    }

    // UNIQUE PO CHECK: Check if PO Reference already exists
    if (poReference) {
      const existingOrder = await Order.findOne({ company: companyId, poReference: poReference });
      if (existingOrder) {
        return res.status(400).json({ message: `Order with PO Reference '${poReference}' already exists.` });
      }
    }

    // Validate dispatchDate
    const parsedDispatchDate = new Date(dispatchDate);
    if (isNaN(parsedDispatchDate.getTime())) {
      return res.status(400).json({ message: "Invalid dispatch date format" });
    }

    // Handle Photos
    let photoUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadOnS3(file.path, "orders", getCompanyLoginId(req));
        if (result?.url) photoUrls.push(result.url);
      }
    }

    // 1. Create Order
    const order = await Order.create({
      company: companyId,
      orderNumber,
      customerName,
      poReference,
      productCode,
      productName,
      quantity,
      dispatchDate: parsedDispatchDate,
      priority: priority || "Medium",
      bom,
      createdBy: req.user.id,
      remarks,
      photos: photoUrls,
      status: "Pending",
    });

    // 2. Generate Unique Jobs/WorkOrders for Planning
    // Fetch Component to get Routing/RouteCard
    // Note: In createOrder frontend sends productCode/productName from the item loop, but currently backend creates ONE order record with arrays of components OR one order per line?
    // Current Frontend Logic (CreateOrderModal):
    // 1. Create Base Order (POST /order)
    // 2. Loop Items: Create Component Record (POST /component) linked to Order

    // ADJUSTMENT: The user wants "after selecting the product ... generate unique item code for each quantity".
    // Since the frontend structure creates Components SEPARATELY, we should generate JOBs when the COMPONENT is created or when the ORDER is "Finalized"?
    // HOWEVER, the current prompt context implies the Controller `createOrder` is doing this.
    // Let's look at `createOrder` logic. It gets `productCode`, `quantity` etc.
    // IF `createOrder` is used for the *Initial* shell, and then items are added, `createOrder` might effectively be creating the "Header".
    // BUT the current `createOrder` body has `productCode`, `quantity`.
    // Wait, the frontend `CreateOrderModal` sends `productCode: "MULTI-ITEM"`.
    // So `createOrder` is the HEADER. The actual items are `Component` records created in the loop in frontend.

    // CRITICAL CORRECTION:
    // The previous planner assumed `createOrder` creates the jobs.
    // But `CreateOrderModal` creates an Order shell, then calls `POST /component` for each line item.
    // SO, the Job Generation must happen in `createComponent` (which is technically "adding an item to the order") OR `createOrder` needs to accept items array.

    // User Request: "after creating the new order with po reference, after selecting the product... it should generate unique item code".
    // This implies the action happens when the product is added.
    // Updating `createComponent` logic instead of `createOrder` (or `createOrder` if it accepted items, but frontend shows separate calls).

    // LET'S CHECK `createComponent` in this file.

    res.status(201).json({ message: "Order and Jobs created successfully", order });
  } catch (error) {
    console.error("Create Order Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Order number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const { status, priority } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const orders = await Order.find(query)
      .populate("bom", "bomNumber productName")
      .populate("routeCard", "routeCardNumber")
      .populate("components")
      .populate("jobs") // Added payload for granular tracking
      .populate("createdBy", "name userId")
      .sort({ createdAt: -1 });

    res.status(200).json({ orders, count: orders.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== ENHANCED ORDER MANAGEMENT (New Model) ==========

export const createPPCOrder = async (req, res) => {
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const Component = req.getModel('Component', componentSchema);
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    let {
      orderNumber,
      customer,
      customerName,
      deliveryDate,
      items, // JSON String or Object
      remarks,
      poReference,
      targetMonth
    } = req.body;

    // Parse items if string
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (!orderNumber || !items || items.length === 0 || !deliveryDate || !poReference) {
      return res.status(400).json({ message: "Order number, PO reference, delivery date, and items are required" });
    }

    // Handle Photos
    let photoUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadOnS3(file.path, "orders", getCompanyLoginId(req));
          if (result?.url) photoUrls.push(result.url);
        } catch (e) {
          console.error("Photo upload failed", e);
        }
      }
    }

    // Check uniqueness

    // Check uniqueness
    const existing = await PPCOrder.findOne({ company: companyId, orderNumber });
    if (existing) {
      return res.status(400).json({ message: "Order number already exists" });
    }

    const existingPO = await PPCOrder.findOne({ company: companyId, poReference });
    if (existingPO) {
      return res.status(400).json({ message: "PO Number already exists" });
    }

    // 1. Create Shell Order
    const newOrder = await PPCOrder.create({
      company: companyId,
      orderNumber,
      poReference,
      targetMonth, // Saved here
      customer,
      customerName,
      deliveryDate,
      items: [], // Will populate
      remarks,
      photos: photoUrls, // Save Photos
      createdBy: req.user.id,
      status: 'Pending'
    });

    // 2. Process Items
    const updatedItems = [];

    for (const item of items) {
      const { product: productId, quantity, price, trackingType, targetDate } = item;
      let masterProduct = await Component.findById(productId).populate('routing.process'); // Populate if needed for names
      let isFGItem = false;

      if (!masterProduct) {
        masterProduct = await FGItem.findById(productId).populate('bom.item');
        isFGItem = true;
      }

      if (!masterProduct) continue; // Skip or error?

      const productCode = isFGItem ? masterProduct.code : masterProduct.componentCode;
      const productName = isFGItem ? masterProduct.name : masterProduct.componentName;
      const description = masterProduct.description;
      const unit = masterProduct.unit;

      // Prepare Snapshots
      const bomSnapshot = isFGItem ? (masterProduct.bom || []).map(b => ({
        item: b.item?._id || b.item,
        itemModel: b.itemType,
        itemName: b.itemName,
        quantity: b.quantity,
        unit: b.unit
      })) : masterProduct.billOfMaterials;

      const processSnapshot = isFGItem ? [] : masterProduct.routing.map(r => ({
        processName: r.processName || (r.process && r.process.processName) || 'Unnamed Process',
        standardTime: r.standardTime,
        description: r.description,
        machine: r.machine,
        isJobWork: r.isOutsourced || r.isJobWork || false // Capture Job Work flag
      }));
      const photosSnapshot = masterProduct.photos;

      updatedItems.push({
        product: masterProduct._id,
        productName: productName,
        productCode: productCode,
        description: description,
        unit: unit,
        quantity,
        price: price || 0,
        trackingType: trackingType || 'Individual',
        targetDate: targetDate || undefined,
        bomSnapshot,
        processSnapshot,
        photosSnapshot,
        jobs: [] // Jobs generated on Confirm
      });
    }

    // 3. Update Order with Items
    newOrder.items = updatedItems;
    await newOrder.save();

    res.status(201).json({ message: "PPC Order created successfully", order: newOrder });

  } catch (error) {
    console.error("Create PPC Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllPPCOrders = async (req, res) => {
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);

    const companyId = getCompanyId(req);
    const orders = await PPCOrder.find({ company: companyId })
      .populate('items.product')
      .populate('customer')
      .sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const confirmPPCOrder = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../models/ppc/index.js");
  const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
  const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
  const Job = req.getModel('Job', jobSchema);
  const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);
  const Inventory = req.getModel('Inventory', inventorySchema); // To check stock

  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);

    let order = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!order) order = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== 'Pending') {
      return res.status(400).json({ message: "Only Pending orders can be confirmed" });
    }

    // 1. Generate Jobs (Moved from Create)
    const updatedItems = []; // To update order with job IDs
    const materialMap = new Map(); // For Material Requirements aggregation

    for (const item of order.items) {
      if (!item.product) continue; // Should have product ID
      const productCode = item.productCode || "UNK";

      // Use Snapshot logic for consistency
      const processSnapshot = item.processSnapshot || [];
      const quantity = item.quantity;
      const trackingType = item.trackingType || 'Individual';

      // --- Job Generation ---
      const createdJobs = [];
      const initialProcessHistory = processSnapshot.map((step, idx) => ({
        operationName: step.processName,
        sequence: idx + 1,
        standardTime: step.standardTime,
        status: 'Pending',
        assignedMachine: step.machine,
        isJobWork: step.isJobWork,
        qcRequired: step.qcRequired
      }));

      // Generate Jobs logic
      if (trackingType === 'Batch') {
        const batchId = `${order.orderNumber}-${productCode}-BATCH`;
        const job = await Job.create({
          company: companyId,
          jobNumber: batchId,
          customerName: order.customerName,
          partName: item.productName,
          poNumber: order.orderNumber,
          order: order._id,
          masterProduct: item.product,
          quantity: quantity,
          completedQuantity: 0,
          status: 'Scheduled',
          processHistory: initialProcessHistory
        });
        createdJobs.push(job._id);
      } else {
        for (let i = 1; i <= quantity; i++) {
          const uniqueId = `${order.orderNumber}-${productCode}-${String(i).padStart(3, '0')}`;
          const job = await Job.create({
            company: companyId,
            jobNumber: uniqueId,
            customerName: order.customerName,
            partName: item.productName,
            poNumber: order.orderNumber,
            order: order._id,
            masterProduct: item.product,
            quantity: 1,
            completedQuantity: 0,
            status: 'Scheduled',
            processHistory: initialProcessHistory
          });
          createdJobs.push(job._id);
        }
      }

      // Update item with job references
      item.jobs = createdJobs;

      // --- Material Requirement Calculation ---
      // Iterate BOM Snapshot
      if (item.bomSnapshot && item.bomSnapshot.length > 0) {
        for (const bomItem of item.bomSnapshot) {
          // Calculate Total Required for this Order Item
          const requiredForThisItem = bomItem.quantity * quantity;

          // Only plan for 'Material' items (Store Items), not sub-components for now (unless recursive requested)
          // Ideally both, but let's stick to 'Material' (Raw Material) for "Procurement"
          if (bomItem.itemModel === 'Material') {
            const matId = bomItem.item.toString();
            if (materialMap.has(matId)) {
              materialMap.get(matId).requiredQuantity += requiredForThisItem;
            } else {
              materialMap.set(matId, {
                material: bomItem.item,
                materialName: bomItem.itemName,
                unit: bomItem.unit,
                requiredQuantity: requiredForThisItem
              });
            }
          }
        }
      }
    }

    // 2. Save Jobs to Order Items
    await order.save(); // Mongoose handles subdoc array update

    // 3. Create Material Requirement Record
    const requirementItems = [];
    for (const [key, val] of materialMap.entries()) {
      // Check current stock snapshot
      const inventory = await Inventory.findOne({ company: companyId, materialId: key });
      const currentStock = inventory ? inventory.currentStock : 0;
      const shortage = Math.max(0, val.requiredQuantity - currentStock); // Simple check

      requirementItems.push({
        material: val.material,
        materialName: val.materialName,
        requiredQuantity: val.requiredQuantity,
        unit: val.unit,
        stockAvailable: currentStock,
        shortage: shortage,
        status: shortage > 0 ? 'Pending' : 'Fulfilled' // Auto-fulfill if stock exists? Or keep pending until Issued?
        // Let's keep it 'Pending' for review unless shortage is 0
      });
    }

    if (requirementItems.length > 0) {
      await MaterialRequirement.create({
        company: companyId,
        order: order._id,
        targetMonth: order.targetMonth,
        items: requirementItems,
        status: 'Draft'
      });
    }

    // 4. Update Order Status
    order.status = 'Planning'; // Or 'Confirmed' -> 'Planning'
    await order.save();

    res.status(200).json({ message: "Order Confirmed. Jobs and Material Requirements generated.", order });

  } catch (error) {
    console.error("Confirm Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrderMaterialPlan = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../models/ppc/index.js");
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    let order = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!order) order = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Find requirement linked to this order
    const plan = await MaterialRequirement.findOne({ order: id, company: companyId })
      .populate('items.material');

    if (!plan) return res.status(200).json({ items: [] }); // Empty plan if not yet generated
    res.status(200).json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOrderJobs = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../models/ppc/index.js");
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Job = req.getModel('Job', jobSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    
    let order = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!order) order = await ProductionOrder.findOne({ _id: id, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const jobs = await Job.find({ order: id, company: companyId })
      .populate('masterProduct')
      .sort({ sequence: 1 }); // Sort logic?
    res.status(200).json({ jobs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMaterialRequirementStatus = async (req, res) => {
  try {
    const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);

    const { id, itemId } = req.params;
    const { status } = req.body;
    const companyId = getCompanyId(req);

    const plan = await MaterialRequirement.findOne({ _id: id, company: companyId });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const item = plan.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.status = status;
    await plan.save();

    res.status(200).json({ message: "Status updated", plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Planning Board Controllers ---

export const getPlanningBacklog = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    // Find active jobs with at least one Pending process
    // We only want the *next* pending process in sequence, but simplicity first: show all pending.
    const jobs = await Job.find({
      company: companyId,
      status: { $in: ['Scheduled', 'InProgress'] },
      'processHistory.status': 'Pending'
    }).select('jobNumber partName quantity processHistory masterProduct order completionPercentage');

    // Flatten to Process Steps
    const backlog = [];
    for (const job of jobs) {
      // Find the first pending process (FIFO)
      // Or filtering all pending? Let's filter all pending to allow flexibility
      const pendingSteps = job.processHistory.filter(p => p.status === 'Pending' && !p.assignedMachine);

      pendingSteps.forEach(step => {
        backlog.push({
          _id: step._id, // Process ID
          jobId: job._id,
          jobNumber: job.jobNumber,
          partName: job.partName,
          quantity: job.quantity,
          processName: step.operationName,
          sequence: step.sequence,
          standardTime: step.standardTime, // per unit
          totalTime: (step.standardTime || 0) * job.quantity,
          assignedMachine: step.assignedMachine,
          orderId: job.order
        });
      });
    }

    res.status(200).json({ backlog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMachineSchedule = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { start, end } = req.query; // YYYY-MM-DD ISO strings

    // Find jobs with processes assigned in this range
    // processHistory.startTime exists
    const jobs = await Job.find({
      company: companyId,
      'processHistory.startTime': {
        $gte: new Date(start),
        $lte: new Date(end)
      }
    }).select('jobNumber partName processHistory quantity');

    const assignments = [];
    jobs.forEach(job => {
      job.processHistory.forEach(step => {
        if (step.startTime && step.endTime && step.assignedMachine) {
          // Check intersection with requested range (optional, optimization)
          assignments.push({
            _id: step._id, // Process ID (unique)
            jobId: job._id,
            jobNumber: job.jobNumber,
            partName: job.partName,
            machineId: step.assignedMachine,
            processName: step.operationName,
            start: step.startTime,
            end: step.endTime,
            status: step.status
          });
        }
      });
    });

    res.status(200).json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const assignJobProcess = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    // team is array of { employeeId, role }
    const { jobId, processId, machineId, startTime, endTime, team } = req.body;

    const job = await Job.findOne({ _id: jobId, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const step = job.processHistory.id(processId);
    if (!step) return res.status(404).json({ message: "Process step not found" });

    // Validate logic (Sequence check?) - Skipped for flexibility
    // Handle Job Work Assignment
    const { isJobWork, vendorId } = req.body;
    if (isJobWork && vendorId) {
      step.assignedVendor = vendorId;
      step.status = 'Scheduled'; // or 'Pending' (waiting for challan). Let's say Scheduled for now.
      // potentially clear machine/time if moving to vendor? 
      // step.assignedMachine = undefined; 
    } else {
      // Normal Machine Assignment
      if (machineId) step.assignedMachine = machineId;
      if (startTime) step.startTime = startTime;
      if (endTime) step.endTime = endTime;

      // Handle Gang Assignment
      if (team && Array.isArray(team)) {
        step.assignedTeam = team.map(t => ({
          employee: t.employeeId,
          role: t.role || "Operator"
        }));
        // Legacy Sync
        if (step.assignedTeam.length > 0) {
          step.assignedEmployee = step.assignedTeam[0].employee;
        }
      }
    }


    step.status = 'Scheduled'; // Mark as scheduled when machine is assigned

    await job.save();

    res.status(200).json({ message: "Assigned successfully", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Execution Controllers (Operator View) ---

export const startJobProcess = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { jobId, processId } = req.body;

    const job = await Job.findOne({ _id: jobId, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const step = job.processHistory.id(processId);
    if (!step) return res.status(404).json({ message: "Process step not found" });

    step.status = 'InProgress';
    step.actualStart = new Date();

    // Also update parent Job status if it's the first step?
    // Maybe keep parent status 'InProgress' broadly.
    job.status = 'InProgress';

    await job.save();
    res.status(200).json({ message: "Process Started", step });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const completeJobProcess = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { jobId, processId, producedQty, rejectedQty } = req.body;

    const job = await Job.findOne({ _id: jobId, company: companyId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const step = job.processHistory.id(processId);
    if (!step) return res.status(404).json({ message: "Process step not found" });

    step.actualEnd = new Date();
    // Use producedQty / rejectedQty if needed for records (maybe add fields to schema later if missing)

    // QC Check Logic
    if (step.qcRequired) {
      step.status = 'QC_Pending';
      // Do NOT start next step yet.
    } else {
      step.status = 'Completed';

      // Auto-Activate Next Step?
      // Find next sequence
      const nextStep = job.processHistory.find(s => s.sequence === step.sequence + 1);
      if (nextStep) {
        // nextStep.status = 'Pending'; // It should already be pending.
        // Maybe useful to mark "Ready"
      } else {
        // All steps done?
        const allDone = job.processHistory.every(s => s.status === 'Completed');
        if (allDone) job.status = 'Completed';
      }
    }

    await job.save();
    res.status(200).json({ message: step.qcRequired ? "Sent for QC" : "Process Completed", step });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Procurement Dashboard Controller ---

export const getProcurementDashboard = async (req, res) => {
  const MaterialRequirement = req.getModel('MaterialRequirement', materialRequirementSchema);
  const Inventory = req.getModel('Inventory', inventorySchema); // From Store Module

  try {
    const companyId = getCompanyId(req);

    // 1. Fetch all "Pending" or "Draft" requirements
    // We want to see TOTAL demand, but mostly focus on Shortage for Money Planning
    const requirements = await MaterialRequirement.find({
      company: companyId
    }).populate('order', 'orderNumber targetMonth');

    // 2. Aggregate by Material
    const materialMap = {};

    for (const req of requirements) {
      for (const item of req.items) {
        // Only consider items with Shortage for "Procurement" value
        if (item.shortage > 0 && item.status !== 'Fulfilled' && item.status !== 'PR Raised') {
          if (!materialMap[item.material]) {
            materialMap[item.material] = {
              materialId: item.material,
              materialName: item.materialName,
              unit: item.unit,
              totalShortage: 0,
              orders: [],
              estimatedCost: 0
            };
          }
          materialMap[item.material].totalShortage += item.shortage;
          materialMap[item.material].orders.push(req.order ? req.order.orderNumber : 'Unknown');
        }
      }
    }

    // 3. Fetch Prices from Inventory
    const aggregatedData = Object.values(materialMap);

    for (const data of aggregatedData) {
      const inventory = await Inventory.findOne({
        company: companyId,
        materialId: data.materialId
      });

      const unitPrice = inventory ? inventory.unitPrice : 0;
      data.unitPrice = unitPrice;
      data.estimatedCost = data.totalShortage * unitPrice;
      data.currentStock = inventory ? inventory.currentStock : 0;
    }

    // 4. Calculate Totals
    const totalValue = aggregatedData.reduce((sum, item) => sum + item.estimatedCost, 0);

    res.status(200).json({
      dashboard: aggregatedData,
      totalValue
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// --- Job Work / Outsourcing Controllers ---

export const getPendingOutsourcedJobs = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);

    // Find jobs where the *current* pending step is marked as isJobWork
    // Logic: Find jobs with status InProgress/Scheduled
    // Filter those where the *first* Pending step has isJobWork: true

    const jobs = await Job.find({
      company: companyId,
      status: { $in: ['Scheduled', 'InProgress'] },
      'processHistory.status': 'Pending',
      'processHistory.isJobWork': true
    }).populate('order', 'orderNumber').populate('masterProduct', 'componentName');

    const outsourcedList = [];

    for (const job of jobs) {
      // Get the specific pending step
      // Note: We only care if the *next immediate* step is outsourced.
      // If step 1 is pending internal, and step 2 is pending outsourced, we shouldn't show step 2 yet.
      // So we find the FIRST pending step.
      const currentStep = job.processHistory.find(p => p.status === 'Pending');

      if (currentStep && currentStep.isJobWork) {
        outsourcedList.push({
          jobId: job._id,
          jobNumber: job.jobNumber,
          partName: job.partName,
          processId: currentStep._id,
          processName: currentStep.operationName,
          quantity: job.quantity,
          orderNumber: job.order ? job.order.orderNumber : '-'
        });
      }
    }

    res.status(200).json({ jobs: outsourcedList });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Dispatch Management ---

export const getDispatchQueue = async (req, res) => {
  const Order = req.getModel('Order', orderSchema);
  const Job = req.getModel('Job', jobSchema); // Import Job Model locally or use req.getModel

  try {
    const companyId = getCompanyId(req);

    // 1. Fetch Active Orders (Planning, InProgress, Completed(but not dispatched))
    // Assuming Order Status flow: Pending -> Planning -> InProgress -> Completed -> Dispatched
    // We want to find orders that are "Ready for Dispatch" (i.e., All Jobs Completed)

    const orders = await Order.find({
      company: companyId,
      status: { $in: ['Planning', 'InProgress', 'Produced'] } // 'Produced' might be a new intermediate status, or we just check Jobs
    }).select('orderNumber customerName productCode quantity dispatchDate status');

    const readyForDispatch = [];

    for (const order of orders) {
      // Check Jobs
      const jobs = await Job.find({ company: companyId, order: order._id }).select('status quantity completedQuantity');

      if (jobs.length > 0) {
        const allJobsCompleted = jobs.every(j => j.status === 'Completed');
        const totalProduced = jobs.reduce((sum, j) => sum + (j.completedQuantity || 0), 0);

        // If all jobs are completed OR total produced >= order quantity (for partial dispatch handling, maybe just strict for now)

        if (allJobsCompleted) {
          readyForDispatch.push({
            ...order.toObject(),
            totalJobs: jobs.length,
            totalProduced
          });
        }
      }
    }

    res.status(200).json({ dispatchQueue: readyForDispatch });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const markOrderAsDispatched = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const { orderId } = req.body;

    const order = await Order.findOne({ _id: orderId, company: companyId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = 'Dispatched';
    // Optional: Update actualDispatchDate?

    await order.save();

    res.status(200).json({ message: "Order Dispatched Successfully", order });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getOrderById = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const order = await Order.findOne({ _id: id, company: companyId })
      .populate("bom")
      .populate("routeCard")
      .populate("createdBy", "name userId");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOrder = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../models/ppc/index.js");
  try {
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Order = req.getModel('Order', orderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    let { items } = req.body;

    // Parse items if string (from FormData)
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    // Update req.body.items so legacy update works too if needed
    if (items) req.body.items = items;

    // 1. Try finding and updating PPCOrder (Smart Merge)
    let ppcOrder = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!ppcOrder) ppcOrder = await ProductionOrder.findOne({ _id: id, company: companyId });

    if (ppcOrder) {
      // Merge Items to preserve snapshots & jobs
      if (items && Array.isArray(items) && items.length > 0) {
        const newItems = [];
        for (const newItem of items) {
          // Try to match by Product ID or Item ID
          const existingItem = ppcOrder.items.find(i =>
            (newItem.product && i.product && i.product.toString() === newItem.product.toString()) ||
            (newItem._id && i._id && i._id.toString() === newItem._id.toString())
          );

          if (existingItem) {
            // MERGE: Keep snapshots/jobs, update editable fields
            newItems.push({
              ...existingItem.toObject(),
              quantity: Number(newItem.quantity),
              price: Number(newItem.price || existingItem.price || 0),
              trackingType: newItem.trackingType || existingItem.trackingType
            });
          } else {
            // NEW ITEM: Basic add (Snapshots won't be generated in Edit mode currently)
            newItems.push({
              product: newItem.product,
              productName: newItem.productName, // If passed
              quantity: Number(newItem.quantity),
              price: Number(newItem.price || 0),
              trackingType: newItem.trackingType || "Individual"
            });
          }
        }
        ppcOrder.items = newItems;
      }

      // Update Top-Level Fields
      const allowedUpdates = ["orderNumber", "poReference", "customerName", "deliveryDate", "remarks", "status"];
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) ppcOrder[field] = req.body[field];
      });

      // Handle New Photos
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            const result = await uploadOnS3(file.path, "orders", getCompanyLoginId(req));
            if (result?.url) ppcOrder.photos.push(result.url);
          } catch (e) { console.error("Photo upload error", e); }
        }
      }

      await ppcOrder.save();
      return res.status(200).json({ message: "Order updated successfully", order: ppcOrder });
    }

    // 2. Fallback to Legacy Order Update
    let order = await Order.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Order updated successfully", order });

  } catch (error) {
    console.error("Update Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};

const updateOrderDeprecated = async (req, res) => {
  try {
    const Order = req.getModel('Order', orderSchema);
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // 1. Try updating Legacy Order
    let order = await Order.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    // 2. If not found, try updating PPC Order
    if (!order) {
      order = await PPCOrder.findOneAndUpdate(
        { _id: id, company: companyId },
        req.body,
        { new: true, runValidators: true }
      );
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check 48-hour edit limit (applies to both)
    const hourDiff = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
    // Note: We might want to relax this for status updates? 
    // Allowing status updates anytime is standard. The 48h limit might be for "Created" details.
    // If 'status' is being updated, maybe skip time check?
    // user request: "user change to wip this order should visible in planning tab" - implies flow progression.
    // I will keep the check for now but if it blocks status updates on old orders, I'll need to refine it.
    // Actually, usually status update shouldn't be restricted by creation time.
    // But for now, keeping as is to avoid breaking existing rules, assuming these are new orders.

    res.status(200).json({ message: "Order updated successfully", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  const { ppcOrderSchema, productionOrderSchema } = await import("../models/ppc/index.js");
  try {
    const Order = req.getModel('Order', orderSchema);
    const PPCOrder = req.getModel('PPCOrder', ppcOrderSchema);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Job = req.getModel('Job', jobSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // 1. Try deleting from legacy Order Collection
    const legacyOrder = await Order.findOne({ _id: id, company: companyId });
    if (legacyOrder) {
      const hourDiff = (Date.now() - new Date(legacyOrder.createdAt).getTime()) / (1000 * 60 * 60);
      if (hourDiff > 24) {
        return res.status(403).json({ message: "Cannot delete order after 24 hours" });
      }

      // Delete photos from S3
      if (legacyOrder.photos && legacyOrder.photos.length > 0) {
        for (const photo of legacyOrder.photos) {
          await deleteFromS3(photo);
        }
      }
      await legacyOrder.deleteOne();
      return res.status(200).json({ message: "Order deleted successfully" });
    }

    // 2. Try finding in PPCOrder or ProductionOrder Collection
    let ppcOrder = await PPCOrder.findOne({ _id: id, company: companyId });
    if (!ppcOrder) {
      ppcOrder = await ProductionOrder.findOne({ _id: id, company: companyId });
    }

    if (ppcOrder) {
      const hourDiff = (Date.now() - new Date(ppcOrder.createdAt).getTime()) / (1000 * 60 * 60);
      if (hourDiff > 24) {
        return res.status(403).json({ message: "Cannot delete order after 24 hours" });
      }

      // Delete photos from S3
      if (ppcOrder.photos && ppcOrder.photos.length > 0) {
        for (const photo of ppcOrder.photos) {
          await deleteFromS3(photo);
        }
      }

      // Cleanup Linked Jobs
      if (ppcOrder.items && ppcOrder.items.length > 0) {
        try {
          const jobIds = ppcOrder.items.reduce((acc, item) => {
            if (item.jobs && item.jobs.length > 0) return [...acc, ...item.jobs];
            return acc;
          }, []);

          if (jobIds.length > 0) {
            await Job.deleteMany({ _id: { $in: jobIds } });
          }
        } catch (e) {
          console.error("Error deleting linked jobs:", e);
          // Proceed to delete order anyway
        }
      }

      await ppcOrder.deleteOne();
      return res.status(200).json({ message: "PPC Order deleted successfully" });
    }

    return res.status(404).json({ message: "Order not found" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== ROUTE CARD MANAGEMENT ==========

export const createRouteCard = async (req, res) => {
  try {
    const RouteCard = req.getModel('RouteCard', routeCardSchema);
    const Order = req.getModel('Order', orderSchema);

    const companyId = getCompanyId(req);
    const {
      routeCardNumber,
      order,
      productCode,
      productName,
      bom,
      operations,
      status,
    } = req.body;

    if (!routeCardNumber || !productCode || !productName || !operations || operations.length === 0) {
      return res.status(400).json({
        message: "Route card number, product code, product name, and operations are required",
      });
    }

    const routeCard = await RouteCard.create({
      company: companyId,
      routeCardNumber,
      order,
      productCode,
      productName,
      bom,
      operations,
      createdBy: req.user.id,
      status: status || "Draft",
    });

    // Link route card to order if provided
    if (order) {
      await Order.findByIdAndUpdate(order, { routeCard: routeCard._id });
    }

    res.status(201).json({ message: "Route card created successfully", routeCard });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Route card number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllRouteCards = async (req, res) => {
  try {
    const RouteCard = req.getModel('RouteCard', routeCardSchema);

    const companyId = getCompanyId(req);
    const { status, order } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;
    if (order) query.order = order;

    const routeCards = await RouteCard.find(query)
      .populate("order", "orderNumber customerName")
      .populate("bom", "bomNumber")
      .populate("createdBy", "name userId")
      .sort({ createdAt: -1 });

    res.status(200).json({ routeCards, count: routeCards.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRouteCardById = async (req, res) => {
  try {
    const RouteCard = req.getModel('RouteCard', routeCardSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const routeCard = await RouteCard.findOne({ _id: id, company: companyId })
      .populate("order")
      .populate("bom")
      .populate("createdBy", "name userId");

    if (!routeCard) {
      return res.status(404).json({ message: "Route card not found" });
    }

    res.status(200).json(routeCard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateRouteCard = async (req, res) => {
  try {
    const RouteCard = req.getModel('RouteCard', routeCardSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const routeCard = await RouteCard.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!routeCard) {
      return res.status(404).json({ message: "Route card not found" });
    }

    res.status(200).json({ message: "Route card updated successfully", routeCard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== MACHINE MANAGEMENT ==========

export const createMachine = async (req, res) => {
  try {
    const Machine = req.getModel('Machine', machineSchema);

    const companyId = getCompanyId(req);
    let { machineCode, machineName, machineType, make, commissionYear, category, processes, location, specifications, hourlyRate, capacity, status } = req.body;

    if (!machineName) {
      return res.status(400).json({
        message: "Machine name is required",
      });
    }

    // Auto-generate code if not provided
    if (!machineCode) {
      const lastMachine = await Machine.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastMachine && lastMachine.machineCode && lastMachine.machineCode.startsWith("MAC-")) {
        const lastNum = parseInt(lastMachine.machineCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      machineCode = `MAC-${nextNum.toString().padStart(4, "0")}`;
    }

    // Handle processes if sent as stringified array or comma separated
    let parsedProcesses = [];
    if (processes) {
      if (Array.isArray(processes)) {
        parsedProcesses = processes;
      } else if (typeof processes === 'string') {
        // Check if it looks like a JSON array
        if (processes.trim().startsWith('[') && processes.trim().endsWith(']')) {
          try {
            parsedProcesses = JSON.parse(processes);
          } catch (e) {
            parsedProcesses = [];
          }
        } else {
          parsedProcesses = processes.split(',');
        }
      }
    }


    let photoUrls = [];
    // Safer check for req.files
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map((file) => uploadOnS3(file.path, "machines", getCompanyLoginId(req)));
        const uploadResults = await Promise.all(uploadPromises);
        photoUrls = uploadResults
          .filter((result) => result !== null && result.url) // ensure url exists
          .map((result) => result.url);
      } catch (uploadError) {
        console.error("Machine photo upload error:", uploadError);
        // Continue without photos to avoid 500
      }
    }

    const machine = await Machine.create({
      company: companyId,
      machineCode,
      machineName,
      machineType,
      make,
      commissionYear,
      category,
      processes: parsedProcesses,
      location,
      hourlyRate,
      capacity,
      status,
      specifications,
      photos: photoUrls,
    });

    res.status(201).json({ message: "Machine created successfully", machine });
  } catch (error) {
    console.error("Create Machine Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Machine code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllMachines = async (req, res) => {
  try {
    const Machine = req.getModel('Machine', machineSchema);

    const companyId = getCompanyId(req);
    const { status, machineType } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;
    if (machineType) query.machineType = machineType;

    const machines = await Machine.find(query).sort({ machineName: 1 });

    res.status(200).json({ machines, count: machines.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const Machine = req.getModel('Machine', machineSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    let updateData = { ...req.body };

    // Handle processes array parsing for update
    if (updateData.processes) {
      if (typeof updateData.processes === 'string') {
        if (updateData.processes.trim().startsWith('[') && updateData.processes.trim().endsWith(']')) {
          try {
            updateData.processes = JSON.parse(updateData.processes);
          } catch (e) {
            updateData.processes = [];
          }
        } else {
          updateData.processes = updateData.processes.split(',');
        }
      }
    }


    // Handle photo uploads
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => uploadOnS3(file.path, "machines", getCompanyLoginId(req)));
      const uploadResults = await Promise.all(uploadPromises);
      const newPhotoUrls = uploadResults
        .filter((result) => result !== null)
        .map((result) => result.url);

      const existingMachine = await Machine.findOne({ _id: id, company: companyId });
      if (existingMachine) {
        updateData.photos = [...(existingMachine.photos || []), ...newPhotoUrls];
      } else {
        updateData.photos = newPhotoUrls;
      }
    }

    const machine = await Machine.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!machine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    res.status(200).json({ message: "Machine updated successfully", machine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// ========== MANPOWER MANAGEMENT ==========

export const createManpower = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);

    const companyId = getCompanyId(req);
    const { employee, employeeId, skills, currentLoad, availability, status } = req.body;

    let employeeObjId = employee;

    // If employeeId is provided (string), find the Employee by employeeId
    if (employeeId && !employee) {
      const { employeeSchema } = await import("../models/hr/index.js");
      const Employee = req.getModel('Employee', employeeSchema);
      const employeeDoc = await Employee.findOne({
        employeeId,
        company: companyId,
      });
      if (!employeeDoc) {
        return res.status(404).json({ message: "Employee not found with the provided employee ID" });
      }
      employeeObjId = employeeDoc._id;
    }

    if (!employeeObjId) {
      return res.status(400).json({ message: "Employee or employeeId is required" });
    }

    const manpower = await Manpower.create({
      company: companyId,
      employee: employeeObjId,
      skills: skills || [],
      currentLoad: currentLoad || 0,
      availability: availability || 100,
      status: status || "Available",
    });

    res.status(201).json({ message: "Manpower created successfully", manpower });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Manpower entry already exists for this employee" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllManpower = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);

    const companyId = getCompanyId(req);
    const { status, skills } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;

    let manpowers = await Manpower.find(query)
      .populate("employee", "employeeId name department designation skills")
      .sort({ createdAt: -1 });

    // Filter by skills if provided
    if (skills) {
      const requiredSkills = skills.split(",");
      manpowers = manpowers.filter((manpower) => {
        const manpowerSkills = manpower.skills.map((s) => s.name);
        return requiredSkills.some((skill) => manpowerSkills.includes(skill));
      });
    }

    res.status(200).json({ manpower: manpowers, count: manpowers.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateManpower = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const manpower = await Manpower.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!manpower) {
      return res.status(404).json({ message: "Manpower not found" });
    }

    res.status(200).json({ message: "Manpower updated successfully", manpower });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteManpower = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const manpower = await Manpower.findOneAndDelete({ _id: id, company: companyId });

    if (!manpower) {
      return res.status(404).json({ message: "Manpower record not found" });
    }

    res.status(200).json({ message: "Manpower removed from shopfloor successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getManpowerMasterList = async (req, res) => {
  const Manpower = req.getModel('Manpower', manpowerSchema);
  const { employeeSchema } = await import("../models/hr/index.js");
  try {
    const Employee = req.getModel('Employee', employeeSchema);

    const companyId = getCompanyId(req);

    // 1. Get all employees
    const employees = await Employee.find({ company: companyId }).select('employeeId name designation department status photo');

    // 2. Get all manpower records
    const manpowerRecords = await Manpower.find({ company: companyId }).populate('employee', 'employeeId');

    // Create a map of existing manpower for quick lookup
    const manpowerMap = {};
    manpowerRecords.forEach(mp => {
      if (mp.employee) {
        // Handle populated employee object or ID
        const empId = mp.employee._id ? mp.employee._id.toString() : mp.employee.toString();
        manpowerMap[empId] = mp;
      }
    });

    // 3. Merge data
    const masterList = employees.map(emp => {
      const mpRecord = manpowerMap[emp._id.toString()];
      return {
        // Employee Data
        employeeId: emp._id, // The actual Mongo ID of employee
        empCode: emp.employeeId,
        name: emp.name,
        designation: emp.designation,
        department: emp.department,
        photo: emp.photo,

        // Manpower Data (if exists)
        isShopfloorActive: !!mpRecord,
        manpowerId: mpRecord ? mpRecord._id : null,
        skills: mpRecord ? mpRecord.skills : [],
        currentLoad: mpRecord ? mpRecord.currentLoad : 0,
        availability: mpRecord ? mpRecord.availability : 0,
        shopfloorStatus: mpRecord ? mpRecord.status : 'Inactive'
      };
    });

    res.status(200).json({ manpowerList: masterList });
  } catch (error) {
    console.error("Error in getManpowerMasterList:", error);
    res.status(500).json({ message: error.message });
  }
};

// ========== SKILL MANAGEMENT ==========

export const createSkill = async (req, res) => {
  const { skillSchema } = await import("../models/hr/index.js");
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const companyId = getCompanyId(req);
    const { name, description } = req.body;

    if (!name) return res.status(400).json({ message: "Skill name is required" });

    const skill = await Skill.create({
      company: companyId,
      name,
      description
    });

    res.status(201).json({ message: "Skill created successfully", skill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Skill with this name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllSkills = async (req, res) => {
  const { skillSchema } = await import("../models/hr/index.js");
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const companyId = getCompanyId(req);
    const skills = await Skill.find({ company: companyId }).sort({ name: 1 });
    res.status(200).json({ skills, count: skills.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSkill = async (req, res) => {
  const { skillSchema } = await import("../models/hr/index.js");
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const skill = await Skill.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!skill) return res.status(404).json({ message: "Skill not found" });

    res.status(200).json({ message: "Skill updated successfully", skill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSkill = async (req, res) => {
  const { skillSchema } = await import("../models/hr/index.js");
  try {
    const Skill = req.getModel('Skill', skillSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const skill = await Skill.findOneAndDelete({ _id: id, company: companyId });

    if (!skill) return res.status(404).json({ message: "Skill not found" });

    res.status(200).json({ message: "Skill deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== JOB MANAGEMENT ==========

export const createJob = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const {
      jobNumber,
      order,
      routeCard,
      operation,
      assignedMachine,
      assignedManpower,
      scheduledStart,
      scheduledEnd,
      quantity,
      status,
    } = req.body;

    if (!jobNumber) {
      return res.status(400).json({
        message: "Job number is required",
      });
    }

    const job = await Job.create({
      company: companyId,
      jobNumber,
      order,
      routeCard,
      operation,
      assignedMachine,
      assignedManpower: assignedManpower || [],
      scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
      quantity: quantity || 1,
      status: status || "Scheduled",
    });

    res.status(201).json({ message: "Job created successfully", job });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Job number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllJobs = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const companyId = getCompanyId(req);
    const { status, order, assignedMachine, search, startDate, endDate } = req.query;

    const query = { company: companyId };
    if (status) query.status = status;
    if (order) query.order = order;
    if (assignedMachine) query.assignedMachine = assignedMachine;

    // Date range filtering
    if (startDate || endDate) {
      query.scheduledStart = {};
      if (startDate) query.scheduledStart.$gte = new Date(startDate);
      if (endDate) query.scheduledStart.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { jobNumber: searchRegex },
        { poNumber: searchRegex },
        { partName: searchRegex },
        { customerName: searchRegex }
      ];
    }

    const jobs = await Job.find(query)
      .populate("order", "orderNumber customerName productName quantity dispatchDate")
      .populate("routeCard", "routeCardNumber")
      .populate("assignedMachine", "machineCode machineName machineType")
      .populate("assignedManpower", "employee")
      .populate("processHistory.assignedMachine", "machineCode machineName")
      .populate("processHistory.assignedEmployee", "name employeeId")
      .sort({ scheduledStart: 1, createdAt: -1 });

    res.status(200).json({ jobs, count: jobs.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const Job = req.getModel('Job', jobSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    if (req.body.scheduledStart) {
      req.body.scheduledStart = new Date(req.body.scheduledStart);
    }
    if (req.body.scheduledEnd) {
      req.body.scheduledEnd = new Date(req.body.scheduledEnd);
    }
    if (req.body.actualStart) {
      req.body.actualStart = new Date(req.body.actualStart);
    }
    if (req.body.actualEnd) {
      req.body.actualEnd = new Date(req.body.actualEnd);
    }

    const job = await Job.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({ message: "Job updated successfully", job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== AUTO SCHEDULING ==========

export const autoSchedule = async (req, res) => {
  try {
    const Order = req.getModel('PPCOrder', ppcOrderSchema);

    const { orderId } = req.params;
    const companyId = getCompanyId(req);

    const order = await Order.findOne({ _id: orderId, company: companyId })
      .populate("items.product")
      ; // replaced routeCard

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Call the    // Auto schedule
    const scheduleResult = await autoScheduleOrder(req, order, companyId);

    if (!scheduleResult.success) {
      return res.status(400).json({ message: scheduleResult.message, details: scheduleResult.details });
    }

    res.status(200).json({
      message: "Order scheduled successfully",
      jobs: scheduleResult.jobs,
      schedule: scheduleResult.schedule,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== COMPONENT MANAGEMENT ==========

export const createComponent = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);
    const Order = req.getModel('Order', orderSchema);
    const RouteCard = req.getModel('RouteCard', routeCardSchema);
    const Job = req.getModel('Job', jobSchema);

    console.log("createComponent Body:", req.body);
    const companyId = getCompanyId(req);
    let { po, componentCode, componentName, quantity, routeCard, remarks, description, category, location, unit, billOfMaterials, routing, type, customer, trackingType } = req.body;

    // Parse JSON fields if they are strings (FormData/Multer issue)
    if (typeof billOfMaterials === 'string') {
      try { billOfMaterials = JSON.parse(billOfMaterials); } catch (e) { billOfMaterials = []; }
    }
    if (typeof routing === 'string') {
      try { routing = JSON.parse(routing); } catch (e) { routing = []; }
    }

    if (!componentName) {
      return res.status(400).json({
        message: "Component name is required",
      });
    }

    // Auto-generate componentCode if not provided
    let finalComponentCode = componentCode;
    if (!finalComponentCode) {
      const count = await Component.countDocuments({ company: companyId });
      finalComponentCode = `CMP-${(count + 1).toString().padStart(4, '0')}`;
    }

    // Handle photo uploads (both component-level and routing-level)
    const componentPhotoUrls = [];
    const routingPhotosMap = {}; // index -> [urls]

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadOnS3(file.path, "components", getCompanyLoginId(req));
          if (uploadResult && uploadResult.secure_url) {
            // Check fieldname pattern: photos (top level) or routing[i][photos]
            if (file.fieldname === 'photos') {
              componentPhotoUrls.push(uploadResult.secure_url);
            } else if (file.fieldname.startsWith('routing[')) {
              // Extract index: routing[0][photos]
              const match = file.fieldname.match(/routing\[(\d+)\]\[photos\]/);
              if (match && match[1]) {
                const index = parseInt(match[1]);
                if (!routingPhotosMap[index]) routingPhotosMap[index] = [];
                routingPhotosMap[index].push(uploadResult.secure_url);
              }
            }
          }
        } catch (uploadError) {
          console.error("Photo upload error:", uploadError);
        }
      }
    }

    // Assign photos to routing steps
    if (routing && routing.length > 0) {
      routing = routing.map((step, index) => {
        const stepPhotos = routingPhotosMap[index] || [];
        return {
          ...step,
          photos: stepPhotos // For creation, we just set new photos.
        };
      });
    }

    // Combine uploaded photos with existing photos from body (if any)
    const existingPhotos = req.body.photos || [];
    // Handle if existingPhotos is a string (single url)
    const parsedExistingPhotos = Array.isArray(existingPhotos) ? existingPhotos : [existingPhotos].filter(Boolean);
    const finalPhotos = [...parsedExistingPhotos, ...componentPhotoUrls];

    const component = await Component.create({
      company: companyId,
      po,
      componentCode: finalComponentCode,
      componentName,
      quantity: quantity || 0, // Default to 0 if not provided
      price: req.body.price || 0,
      description,
      category,
      location,
      unit,
      routeCard,
      remarks,
      billOfMaterials: billOfMaterials || [],
      routing: routing || [],
      type: type || "Component",
      customer: customer, // Added Customer link
      trackingType: trackingType || "Individual",
      status: "Pending",
      photos: finalPhotos
    });

    // Add component to the order's components array only if PO exists
    if (po) {
      const orderDoc = await Order.findByIdAndUpdate(po, {
        $push: { components: component._id },
      }, { new: true }); // Get updated order to access PO Reference

      // --- JOB GENERATION LOGIC ---
      if (routeCard && orderDoc) {
        // Fetch full RouteCard details to get operations
        const routeCardDoc = await RouteCard.findById(routeCard);

        if (routeCardDoc && routeCardDoc.operations && routeCardDoc.operations.length > 0) {
          const jobs = [];
          const poRef = orderDoc.poReference || orderDoc.orderNumber || "NO-PO";
          const cleanPO = poRef.substring(0, 8).toUpperCase().replace(/[^A-Z0-9-]/g, ''); // Truncate safely
          const cleanPart = finalComponentCode.toUpperCase();
          const isBatch = (req.body.trackingType === "Batch");

          if (isBatch) {
            // --- BATCH MODE: Create 1 Job with Full Quantity ---
            // Unique Job ID: [PO]-[Part]-BATCH
            const uniqueJobId = `${cleanPO}-${cleanPart}-BATCH`;

            const processHistory = routeCardDoc.operations.map(op => ({
              operationName: op.operationName,
              sequence: op.sequence,
              standardTime: op.standardTime,
              status: 'Pending',
              assignedMachine: null,
              assignedEmployee: null,
              targetDate: null
            }));

            jobs.push({
              company: companyId,
              jobNumber: uniqueJobId,
              order: po,
              masterProduct: component._id,
              partName: componentName,
              customerName: orderDoc.customerName,
              poNumber: poRef,
              index: 1,
              quantity: quantity || 1, // Full Quantity
              status: 'Pending',
              processHistory: processHistory
            });

          } else {
            // --- INDIVIDUAL MODE (Default): Create N Jobs with Qty 1 ---
            for (let i = 1; i <= (quantity || 1); i++) {
              // Unique Job ID: [PO]-[Part]-[Index]
              const uniqueJobId = `${cleanPO}-${cleanPart}-${String(i).padStart(3, '0')}`;

              // Map Operations to Process History
              const processHistory = routeCardDoc.operations.map(op => ({
                operationName: op.operationName,
                sequence: op.sequence,
                standardTime: op.standardTime,
                status: 'Pending',
                // Assignments initially null
                assignedMachine: null,
                assignedEmployee: null,
                targetDate: null
              }));

              jobs.push({
                company: companyId,
                jobNumber: uniqueJobId, // Using the formatted unique code
                order: po,
                masterProduct: component._id, // Link to the Component instance
                partName: componentName,
                customerName: orderDoc.customerName,
                poNumber: poRef,
                index: i,
                quantity: 1, // Individual unit tracking
                status: 'Pending',
                processHistory: processHistory
              });
            }
          }

          if (jobs.length > 0) {
            const createdJobs = await Job.insertMany(jobs);

            // Link the created Jobs to the Component (assuming Component has jobs field, if not, we rely on masterProduct link in Job)
            // OPTIONAL: Update Component with job IDs if schema supports it. 
            // Currently Component schema doesn't seem to have 'jobs' array explicit in my view, but Order does.
            // We should link Jobs to Order as well for top-level tracking
            await Order.findByIdAndUpdate(po, {
              $push: { jobs: { $each: createdJobs.map(j => j._id) } }
            });
          }
        }
      }
    }

    res.status(201).json({ message: "Component created successfully", component });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllComponents = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const companyId = getCompanyId(req);
    const { po, status } = req.query;

    const query = { company: companyId };
    if (po) query.po = po;
    if (status) query.status = status;

    // Filter by Inventory Status if provided
    if (req.query.isInventoryItem !== undefined) {
      query.isInventoryItem = req.query.isInventoryItem === 'true';
    }

    // Filter Master Products (Exclude items linked to a PO)
    if (req.query.isMaster === 'true') {
      query.po = { $exists: false };
    }


    // Use deep populate for routing requiredItems
    const queryObj = Component.find(query)
      .populate("po", "orderNumber customerName")
      .populate("routeCard", "routeCardNumber operations")
      .populate("category", "name")
      .populate("location", "name")
      .populate({
        path: "routing.requiredItems.item",
        select: "materialName componentName name unit"
      })
      .populate({
        path: "routing.process",
        select: "processName processCode"
      })
      .populate({
        path: "routing.machine",
        select: "machineName machineCode"
      })
      .sort({ createdAt: -1 });

    const components = await queryObj;

    // Sign photos for preview
    const signedComponents = await Promise.all(components.map(async (comp) => {
      const compObj = comp.toObject();
      if (compObj.photos) compObj.photos = await signPhotos(compObj.photos);
      if (compObj.routing) {
        compObj.routing = await Promise.all(compObj.routing.map(async (step) => {
          if (step.photos) step.photos = await signPhotos(step.photos);
          return step;
        }));
      }
      return compObj;
    }));

    res.status(200).json({ components: signedComponents, count: signedComponents.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getComponentById = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const component = await Component.findOne({ _id: id, company: companyId })
      .populate("po")
      .populate("routeCard")
      .populate({
        path: "billOfMaterials.item",
        select: "materialName componentName materialCode componentCode unit type name"
      })
      .populate({
        path: "routing.machine",
        select: "machineName machineCode"
      })
      .populate({
        path: "routing.process",
        select: "processName processCode"
      })
      .populate({
        path: "routing.requiredItems.item",
        select: "materialName componentName name unit type"
      });

    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    const componentObj = component.toObject();
    if (componentObj.photos) componentObj.photos = await signPhotos(componentObj.photos);
    if (componentObj.routing) {
      componentObj.routing = await Promise.all(componentObj.routing.map(async (step) => {
        if (step.photos) step.photos = await signPhotos(step.photos);
        return step;
      }));
    }

    res.status(200).json(componentObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateComponent = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    let updateData = { ...req.body };

    // Parse JSON fields
    if (typeof updateData.billOfMaterials === 'string') {
      try { updateData.billOfMaterials = JSON.parse(updateData.billOfMaterials); } catch (e) { updateData.billOfMaterials = []; }
    }
    if (typeof updateData.routing === 'string') {
      try { updateData.routing = JSON.parse(updateData.routing); } catch (e) { updateData.routing = []; }
    }
    // Handle existing photos JSON (top level)
    if (typeof updateData.existingPhotos === 'string') {
      try { updateData.existingPhotos = JSON.parse(updateData.existingPhotos); } catch (e) { updateData.existingPhotos = []; }
    }

    // --- File Upload Handling ---
    const newComponentPhotos = [];
    const routingPhotosMap = {}; // index -> [urls]

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        try {
          const result = await uploadOnS3(file.path, "components", getCompanyLoginId(req));
          if (result && result.secure_url) {
            if (file.fieldname === 'photos') {
              newComponentPhotos.push(result.secure_url);
            } else if (file.fieldname.startsWith('routing[')) {
              // routing[0][photos]
              const match = file.fieldname.match(/routing\[(\d+)\]\[photos\]/);
              if (match && match[1]) {
                const index = parseInt(match[1]);
                if (!routingPhotosMap[index]) routingPhotosMap[index] = [];
                routingPhotosMap[index].push(result.secure_url);
              }
            }
          }
        } catch (e) {
          console.error("Upload error", e);
        }
      });
      await Promise.all(uploadPromises);
    }

    // fetch existing to merge photos
    const existingComponent = await Component.findOne({ _id: id, company: companyId });
    if (!existingComponent) return res.status(404).json({ message: "Component not found" });

    // Merge Component Photos
    if (updateData.photos && !Array.isArray(updateData.photos)) {
      // If photos key exists but not array (maybe empty from FormData), ignore?
      // Usually we reconstruct from existingPhotos + newPhotos
    }
    const finalComponentPhotos = [...(updateData.existingPhotos || []), ...newComponentPhotos];
    updateData.photos = finalComponentPhotos;

    // Merge Routing Photos
    if (updateData.routing && Array.isArray(updateData.routing)) {
      updateData.routing = updateData.routing.map((step, idx) => {
        // Existing photos for this step might be in the payload as 'existingPhotos' inside the step object?
        // Frontend should send: routing[i] = { ...step, existingPhotos: [...] }
        // Or routing[i].photos = [...existing] sent from frontend if we treat it as simple array in JSON.
        // BUT, we just added new ones.

        let currentStepPhotos = step.photos || [];
        // If frontend sends 'existingPhotos' (urls) in the step object, use that as base
        if (step.existingPhotos && Array.isArray(step.existingPhotos)) {
          currentStepPhotos = step.existingPhotos;
        } else if (Array.isArray(step.photos)) {
          // If frontend sends photos array directly (assuming it only contains existing urls)
          currentStepPhotos = step.photos.filter(p => typeof p === 'string' && p.startsWith('http'));
        } else {
          currentStepPhotos = [];
        }

        const newPhotosForStep = routingPhotosMap[idx] || [];
        return {
          ...step,
          photos: [...currentStepPhotos, ...newPhotosForStep]
        };
      });
    }

    const component = await Component.findOneAndUpdate(
      { _id: id, company: companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    res.status(200).json({ message: "Component updated successfully", component });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteComponent = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);
    const Order = req.getModel('Order', orderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const component = await Component.findOneAndDelete({ _id: id, company: companyId });

    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    // Delete photos from S3
    if (component.photos && component.photos.length > 0) {
      for (const photo of component.photos) {
        await deleteFromS3(photo);
      }
    }
    // Delete routing photos from S3
    if (component.routing && component.routing.length > 0) {
      for (const step of component.routing) {
        if (step.photos && step.photos.length > 0) {
          for (const photo of step.photos) {
            await deleteFromS3(photo);
          }
        }
      }
    }

    // Remove component from order's components array
    await Order.findByIdAndUpdate(component.po, {
      $pull: { components: component._id },
    });

    // Recalculate PO completion percentage
    await updatePOCompletionPercentage(component.po, Order, Component);

    res.status(200).json({ message: "Component deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const promoteToInventory = async (req, res) => {
  try {
    const Component = req.getModel('Component', componentSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const { location, category } = req.body;

    if (!location || !category) {
      return res.status(400).json({ message: "Location and Category are required to add to inventory" });
    }

    const component = await Component.findOne({ _id: id, company: companyId });
    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    component.isInventoryItem = true;
    component.location = location;
    component.category = category;
    await component.save();

    res.status(200).json({ message: "Component added to inventory successfully", component });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== WORK ORDER MANAGEMENT ==========

export const createWorkOrder = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const companyId = getCompanyId(req);
    const { workOrderNumber, component, po, routeCard, operations, quantity, remarks } = req.body;

    if (!workOrderNumber || !component || !po) {
      return res.status(400).json({
        message: "Work order number, component, and PO are required",
      });
    }

    const workOrder = await WorkOrder.create({
      company: companyId,
      workOrderNumber,
      component,
      po,
      routeCard,
      operations: operations || [],
      quantity: quantity || 1,
      remarks,
      status: "Pending",
    });

    res.status(201).json({ message: "Work order created successfully", workOrder });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Work order number already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllWorkOrders = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const companyId = getCompanyId(req);
    const { component, po, status } = req.query;

    const query = { company: companyId };
    if (component) query.component = component;
    if (po) query.po = po;
    if (status) query.status = status;

    const workOrders = await WorkOrder.find(query)
      .populate("component", "componentCode componentName")
      .populate("po", "orderNumber customerName")
      .populate("routeCard", "routeCardNumber")
      .populate("operations.assignedMachine", "machineCode machineName")
      .populate({
        path: "operations.assignedManpower",
        populate: { path: "employee", select: "employeeId name" },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ workOrders, count: workOrders.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getWorkOrderById = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const workOrder = await WorkOrder.findOne({ _id: id, company: companyId })
      .populate("component", "componentCode componentName")
      .populate("po", "orderNumber customerName")
      .populate("routeCard", "routeCardNumber")
      .populate("operations.assignedMachine", "machineCode machineName")
      .populate({
        path: "operations.assignedManpower",
        populate: { path: "employee", select: "employeeId name" },
      });

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    res.status(200).json(workOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateWorkOrder = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // Handle date conversions
    if (req.body.scheduledStart) req.body.scheduledStart = new Date(req.body.scheduledStart);
    if (req.body.scheduledEnd) req.body.scheduledEnd = new Date(req.body.scheduledEnd);
    if (req.body.actualStart) req.body.actualStart = new Date(req.body.actualStart);
    if (req.body.actualEnd) req.body.actualEnd = new Date(req.body.actualEnd);

    const workOrder = await WorkOrder.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    res.status(200).json({ message: "Work order updated successfully", workOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteWorkOrder = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const workOrder = await WorkOrder.findOneAndDelete({ _id: id, company: companyId });

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    res.status(200).json({ message: "Work order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== SCHEDULE QUERIES ==========

export const getMachineSchedules = async (req, res) => {
  try {
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // Find all work orders with operations assigned to this machine
    const workOrders = await WorkOrder.find({
      company: companyId,
      "operations.assignedMachine": id,
    })
      .populate("component", "componentCode componentName")
      .populate("po", "orderNumber customerName")
      .sort({ scheduledStart: 1 });

    // Extract relevant operations for this machine
    const schedules = [];
    workOrders.forEach((wo) => {
      wo.operations.forEach((op) => {
        if (op.assignedMachine && op.assignedMachine.toString() === id) {
          schedules.push({
            workOrder: {
              _id: wo._id,
              workOrderNumber: wo.workOrderNumber,
              component: wo.component,
              po: wo.po,
            },
            operation: op,
          });
        }
      });
    });

    res.status(200).json({ schedules, count: schedules.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeSchedules = async (req, res) => {
  try {
    const Manpower = req.getModel('Manpower', manpowerSchema);
    const WorkOrder = req.getModel('WorkOrder', workOrderSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    // Find manpower record for this employee
    const manpower = await Manpower.findOne({
      company: companyId,
      employee: id,
    });

    if (!manpower) {
      return res.status(404).json({ message: "Manpower record not found for this employee" });
    }

    // Find all work orders with operations assigned to this manpower
    const workOrders = await WorkOrder.find({
      company: companyId,
      "operations.assignedManpower": manpower._id,
    })
      .populate("component", "componentCode componentName")
      .populate("po", "orderNumber customerName")
      .sort({ scheduledStart: 1 });

    // Extract relevant operations for this employee
    const schedules = [];
    workOrders.forEach((wo) => {
      wo.operations.forEach((op) => {
        if (op.assignedManpower && op.assignedManpower.some((m) => m.toString() === manpower._id.toString())) {
          schedules.push({
            workOrder: {
              _id: wo._id,
              workOrderNumber: wo.workOrderNumber,
              component: wo.component,
              po: wo.po,
            },
            operation: op,
          });
        }
      });
    });

    res.status(200).json({ schedules, count: schedules.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== PROCESS MANAGEMENT ==========

export const createProcess = async (req, res) => {
  try {
    const Process = req.getModel('Process', processSchema);

    const companyId = getCompanyId(req);
    let { processCode, processName, description } = req.body;

    if (!processName) {
      return res.status(400).json({ message: "Process name is required" });
    }

    // Auto-generate code if not provided
    if (!processCode) {
      const lastProcess = await Process.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastProcess && lastProcess.processCode && lastProcess.processCode.startsWith("PRC-")) {
        const lastNum = parseInt(lastProcess.processCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      processCode = `PRC-${nextNum.toString().padStart(4, "0")}`;
    }

    const process = await Process.create({
      company: companyId,
      processCode,
      processName,
      description,
    });

    res.status(201).json({ message: "Process created successfully", process });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Process code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllProcesses = async (req, res) => {
  try {
    const Process = req.getModel('Process', processSchema);

    const companyId = getCompanyId(req);
    const processes = await Process.find({ company: companyId }).sort({ processName: 1 });
    res.status(200).json({ processes, count: processes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProcess = async (req, res) => {
  try {
    const Process = req.getModel('Process', processSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const process = await Process.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!process) {
      return res.status(404).json({ message: "Process not found" });
    }

    res.status(200).json({ message: "Process updated successfully", process });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProcess = async (req, res) => {
  try {
    const Process = req.getModel('Process', processSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const process = await Process.findOneAndDelete({ _id: id, company: companyId });

    if (!process) {
      return res.status(404).json({ message: "Process not found" });
    }

    res.status(200).json({ message: "Process deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== MACHINE CATEGORY MANAGEMENT ==========

export const createMachineCategory = async (req, res) => {
  try {
    const MachineCategory = req.getModel('MachineCategory', machineCategorySchema);

    const companyId = getCompanyId(req);
    let { categoryCode, categoryName, description } = req.body;

    if (!categoryName) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Auto-generate code if not provided
    if (!categoryCode) {
      const lastCategory = await MachineCategory.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastCategory && lastCategory.categoryCode && lastCategory.categoryCode.startsWith("MCAT-")) {
        const lastNum = parseInt(lastCategory.categoryCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      categoryCode = `MCAT-${nextNum.toString().padStart(4, "0")}`;
    }

    const category = await MachineCategory.create({
      company: companyId,
      categoryCode,
      categoryName,
      description,
    });

    res.status(201).json({ message: "Machine Category created successfully", category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Category code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllMachineCategories = async (req, res) => {
  try {
    const MachineCategory = req.getModel('MachineCategory', machineCategorySchema);

    const companyId = getCompanyId(req);
    const categories = await MachineCategory.find({ company: companyId }).sort({ categoryName: 1 });
    res.status(200).json({ categories, count: categories.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMachineCategory = async (req, res) => {
  try {
    const MachineCategory = req.getModel('MachineCategory', machineCategorySchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const category = await MachineCategory.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category updated successfully", category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMachineCategory = async (req, res) => {
  try {
    const MachineCategory = req.getModel('MachineCategory', machineCategorySchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const category = await MachineCategory.findOneAndDelete({ _id: id, company: companyId });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== MACHINE LOCATION MANAGEMENT ==========

export const createMachineLocation = async (req, res) => {
  try {
    const MachineLocation = req.getModel('MachineLocation', machineLocationSchema);

    const companyId = getCompanyId(req);
    let { locationCode, locationName, description } = req.body;

    if (!locationName) {
      return res.status(400).json({ message: "Location name is required" });
    }

    // Auto-generate code if not provided
    if (!locationCode) {
      const lastLocation = await MachineLocation.findOne({ company: companyId }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastLocation && lastLocation.locationCode && lastLocation.locationCode.startsWith("MLOC-")) {
        const lastNum = parseInt(lastLocation.locationCode.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      locationCode = `MLOC-${nextNum.toString().padStart(4, "0")}`;
    }

    const location = await MachineLocation.create({
      company: companyId,
      locationCode,
      locationName,
      description,
    });

    res.status(201).json({ message: "Machine Location created successfully", location });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Location code already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getAllMachineLocations = async (req, res) => {
  try {
    const MachineLocation = req.getModel('MachineLocation', machineLocationSchema);

    const companyId = getCompanyId(req);
    const locations = await MachineLocation.find({ company: companyId }).sort({ locationName: 1 });
    res.status(200).json({ locations, count: locations.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMachineLocation = async (req, res) => {
  try {
    const MachineLocation = req.getModel('MachineLocation', machineLocationSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const location = await MachineLocation.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({ message: "Location updated successfully", location });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMachineLocation = async (req, res) => {
  try {
    const MachineLocation = req.getModel('MachineLocation', machineLocationSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);
    const location = await MachineLocation.findOneAndDelete({ _id: id, company: companyId });

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== HELPER FUNCTIONS ==========

async function updatePOCompletionPercentage(poId, Order, Component) {
  try {
    const components = await Component.find({ po: poId });

    if (components.length === 0) {
      await Order.findByIdAndUpdate(poId, { completionPercentage: 0 });
      return;
    }

    const totalCompletion = components.reduce((sum, comp) => sum + (comp.completionPercentage || 0), 0);
    const avgCompletion = totalCompletion / components.length;

    await Order.findByIdAndUpdate(poId, { completionPercentage: Math.round(avgCompletion) });
  } catch (error) {
    console.error("Error updating PO completion percentage:", error);
  }
}


// Delete Machine
export const deleteMachine = async (req, res) => {
  try {
    const Machine = req.getModel('Machine', machineSchema);

    const { id } = req.params;
    const companyId = getCompanyId(req);

    const machine = await Machine.findOneAndDelete({ _id: id, company: companyId });

    if (!machine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    // Delete photos from S3
    if (machine.photos && machine.photos.length > 0) {
      for (const photo of machine.photos) {
        await deleteFromS3(photo);
      }
    }

    res.status(200).json({ message: "Machine deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// ========== MANPOWER ROSTER (ALLOTMENT) ==========

export const createAllotment = async (req, res) => {
  try {
    const ManpowerAllotment = req.getModel('ManpowerAllotment', manpowerAllotmentSchema);

    const companyId = getCompanyId(req);
    const {
      employee, // Employee ID
      date,
      shift,
      startTime,
      endTime,
      machines, // Expecting array
      machine, // Backward compatibility
      remarks
    } = req.body;

    if (!employee || !date || !shift) {
      return res.status(400).json({ message: "Employee, Date and Shift are required" });
    }

    // Handle machines array or fallback to single machine
    let machinesList = [];
    if (machines && Array.isArray(machines)) {
      machinesList = machines;
    } else if (machine) {
      machinesList = [machine];
    }

    // Upsert: If allotment exists for this day/employee, update it. Otherwise create.
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const allotment = await ManpowerAllotment.findOneAndUpdate(
      { company: companyId, employee, date: startOfDay },
      {
        company: companyId,
        employee,
        date: startOfDay,
        shift,
        startTime,
        endTime,
        machines: machinesList,
        remarks
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: "Roster updated successfully", allotment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllotments = async (req, res) => {
  try {
    const ManpowerAllotment = req.getModel('ManpowerAllotment', manpowerAllotmentSchema);
    const Machine = req.getModel('Machine', machineSchema);
    const Employee = req.getModel('Employee', employeeSchema);

    const companyId = getCompanyId(req);
    const { startDate, endDate, employee } = req.query;

    const query = { company: companyId };

    if (employee) query.employee = employee;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const allotments = await ManpowerAllotment.find(query)
      .populate('machines', 'machineCode machineName')
      .populate('employee', 'name employeeId')
      .sort({ date: 1 });

    res.status(200).json({ allotments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAllotment = async (req, res) => {
  const { manpowerAllotmentSchema } = await import("../models/ppc/index.js");
  try {
    const ManpowerAllotment = req.getModel('ManpowerAllotment', manpowerAllotmentSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    await ManpowerAllotment.findOneAndDelete({ _id: id, company: companyId });
    res.status(200).json({ message: "Allotment removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== MACHINE DAY PLAN ==========

export const upsertMachinePlan = async (req, res) => {
  const { machineDayPlanSchema } = await import("../models/ppc/index.js");
  try {
    const MachineDayPlan = req.getModel('MachineDayPlan', machineDayPlanSchema);

    const companyId = getCompanyId(req);
    const { date, machine, shifts, status } = req.body;

    if (!date || !machine) {
      return res.status(400).json({ message: "Date and Machine are required" });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const plan = await MachineDayPlan.findOneAndUpdate(
      { company: companyId, date: startOfDay, machine },
      {
        company: companyId,
        date: startOfDay,
        machine,
        shifts: shifts || [],
        status: status || 'Active'
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: "Machine Plan updated", plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMachinePlans = async (req, res) => {
  const { machineDayPlanSchema } = await import("../models/ppc/index.js");
  try {
    const MachineDayPlan = req.getModel('MachineDayPlan', machineDayPlanSchema);

    const companyId = getCompanyId(req);
    const { startDate, endDate, machine } = req.query;

    const query = { company: companyId };

    if (machine) query.machine = machine;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const plans = await MachineDayPlan.find(query);
    res.status(200).json({ plans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== SHIFT MANAGEMENT ==========

export const createShift = async (req, res) => {
  const { shiftSchema } = await import("../models/ppc/index.js");
  try {
    const Shift = req.getModel('Shift', shiftSchema);

    const companyId = getCompanyId(req);
    const { name, startTime, endTime, description } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: "Name, Start Time and End Time are required" });
    }

    const shift = await Shift.create({
      company: companyId,
      name,
      startTime,
      endTime,
      description
    });

    res.status(201).json({ message: "Shift created successfully", shift });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Shift name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getShifts = async (req, res) => {
  const { shiftSchema } = await import("../models/ppc/index.js");
  try {
    const Shift = req.getModel('Shift', shiftSchema);

    const companyId = getCompanyId(req);
    const shifts = await Shift.find({ company: companyId }).sort({ createdAt: 1 });
    res.status(200).json({ shifts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateShift = async (req, res) => {
  const { shiftSchema } = await import("../models/ppc/index.js");
  try {
    const Shift = req.getModel('Shift', shiftSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const shift = await Shift.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    res.status(200).json({ message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteShift = async (req, res) => {
  const { shiftSchema } = await import("../models/ppc/index.js");
  try {
    const Shift = req.getModel('Shift', shiftSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;

    const shift = await Shift.findOneAndDelete({ _id: id, company: companyId });

    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    res.status(200).json({ message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Reporting ---

export const getProductionReports = asyncHandler(async (req, res) => {
  const Job = req.getModel('Job', jobSchema);

  // 1. Job Status Distribution
  const statusStats = await Job.aggregate([
    { $match: { company: req.company._id, isArchived: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  // 2. Outsourcing Tracking
  // Find jobs where at least one active process step is assigned to a vendor
  const outsourcedJobs = await Job.aggregate([
    { $match: { company: req.company._id } },
    { $unwind: "$processHistory" },
    {
      $match: {
        "processHistory.assignedVendor": { $ne: null },
        "processHistory.status": { $in: ["Pending", "Scheduled", "InProgress", "QC_Pending"] }
      }
    },
    {
      $lookup: {
        from: "vendorstores", // Assuming model name is VendorStore in Mongoose
        localField: "processHistory.assignedVendor",
        foreignField: "_id",
        as: "vendor"
      }
    },
    { $unwind: "$vendor" },
    {
      $project: {
        jobNumber: 1,
        partName: 1,
        processName: "$processHistory.processName",
        vendorName: "$vendor.name",
        status: "$processHistory.status",
        startDate: "$processHistory.plannedStart"
      }
    }
  ]);

  return res.status(200).json(new ApiResponse(200, {
    statusStats,
    outsourcedJobs
  }, "Production Reports Fetched"));
});

// ==========================================
// NEW PRODUCTION ORDER API (For PPC Tab only)
// ==========================================

export const createProductionOrder = async (req, res) => {
  const { ppcOrderSchema, componentSchema, productionOrderSchema } = await import("../models/ppc/index.js");
  try {
    const companyId = getCompanyId(req);
    const { orderNumber, customerName, customer, poReference, deliveryDate, targetMonth, remarks } = req.body;
    let { items } = req.body;

    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Notice: We use productionOrderSchema here, which is essentially the new dedicated schema
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);
    const Component = req.getModel('Component', componentSchema);

    const photoUrls = req.files ? req.files.map((file) => `/${file.path.replace(/\\\\/g, '/')}`) : [];

    const orderItems = [];

    for (const item of items) {
      const productId = item.product || item.componentId;
      if (!productId) continue;

      let masterProduct = await Component.findById(productId).populate('routing.process');

      if (!masterProduct) continue;

      const productCode = masterProduct.componentCode;
      const productName = masterProduct.componentName;
      const description = masterProduct.description;
      const unit = masterProduct.unit;

      const bomSnapshot = masterProduct.billOfMaterials || [];

      const processSnapshot = (masterProduct.routing || []).map(r => ({
        processName: r.processName || (r.process && r.process.processName) || 'Unnamed Process',
        standardTime: r.standardTime,
        description: r.description,
        machine: r.machine,
        isJobWork: r.isOutsourced || r.isJobWork || false
      }));
      const photosSnapshot = masterProduct.photos || [];

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
        jobs: []
      });
    }

    const order = await ProductionOrder.create({
      company: companyId,
      orderNumber,
      poReference,
      targetMonth,
      customer,
      customerName,
      deliveryDate: new Date(deliveryDate),
      items: orderItems,
      createdBy: req.user.id,
      remarks,
      photos: photoUrls,
      status: 'Pending'
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Error creating Production Order:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllProductionOrders = async (req, res) => {
  const { productionOrderSchema } = await import("../models/ppc/index.js");
  try {
    const companyId = getCompanyId(req);
    const ProductionOrder = req.getModel('ProductionOrder', productionOrderSchema);

    const orders = await ProductionOrder.find({ company: companyId })
      .populate('customer', 'name')
      .populate('items.product', 'componentName componentCode photos')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error getting Production Orders:', error);
    res.status(500).json({ message: error.message });
  }
};
