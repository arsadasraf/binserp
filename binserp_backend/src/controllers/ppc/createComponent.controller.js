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
} from "../../models/ppc/index.js";
import { employeeSchema } from "../../models/hr/index.js";
import { bomSchema, inventorySchema, fgItemSchema } from "../../models/store/index.js";
import { autoScheduleOrder } from "../../services/planning.service.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getCompanyId = (req) => {
  if (req.company) return req.company._id;
  return req.userType === "company" ? req.user.id : req.user.company?._id;
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// ========== ORDER MANAGEMENT ==========

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
