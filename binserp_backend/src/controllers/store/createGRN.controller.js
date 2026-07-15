import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, rmInventoryMonthlySchema, fgInventoryMonthlySchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { prefixSettingsSchema } from "../../models/prefix/index.js";
import { componentSchema, jobSchema, processSchema } from "../../models/ppc/index.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import fs from 'fs';
import path from 'path';

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};

// Helper function to update COMPONENT stock (InHouse)
const updateComponentStock = async (req, componentId, quantity) => {
  try {
    const companyId = getCompanyId(req); // Derive companyId from req
    const Component = req.getModel("Component", componentSchema);
    const component = await Component.findById(componentId);
    if (!component) {
      console.error(`Component not found: ${componentId}`);
      return null;
    }

    // Update quantity
    await Component.findByIdAndUpdate(componentId, {
      $inc: { quantity: quantity }
    });

    return true;
  } catch (error) {
    console.error("Error updating component stock:", error);
    throw error;
  }
};



// ========== GRN (Goods Receipt Note) ==========


export const createGRN = async (req, res) => {
  const GRN = req.getModel('GRN', grnSchema);
  const Vendor = req.getModel('Vendor', vendorSchema);
  const Customer = req.getModel('Customer', customerSchema);
  const Material = req.getModel('RmBoItem', rmBoItemSchema);
  const Component = req.getModel('Component', componentSchema);
  console.log(">>> [createGRN] HIT! Request received. (ORIGINAL FUNCTION)");
  console.log(">>> [createGRN] Body Type:", typeof req.body);
  console.log(">>> [createGRN] Body Keys:", Object.keys(req.body));

  try {
    const companyId = getCompanyId(req);
    let { grnNumber, date, supplier, customer, type, material, materialName, quantity, unit, locationId, category, status, items, poReference, qcRequired } = req.body;

    // Parse qcRequired explicitly (Handle "true"/"false" strings from FormData)
    if (qcRequired === 'true') qcRequired = true;
    else if (qcRequired === 'false') qcRequired = false;
    else qcRequired = !!qcRequired; // Fallback for boolean or undefined/null

    // Default type to 'bo' if not provided
    type = type || 'bo';
    console.log(`>>> [createGRN] Processing Type: ${type}, Status: ${status}, QC Required: ${qcRequired} (${typeof qcRequired})`);

    // Default status to 'Received' if not provided
    status = status || "Received";

    // Validation
    if (!grnNumber) {
      return res.status(400).json({ message: "GRN number is required" });
    }

    // Specific validation based on Type
    let supplierName = "";
    let supplierAddress = "";

    if (type === 'inhouse') {
      if (!customer) {
        return res.status(400).json({ message: "Customer is required for InHouse GRN" });
      }
      // Validate Customer
      const customerData = await Customer.findById(customer);
      if (!customerData) {
        return res.status(400).json({ message: "Customer not found" });
      }
      // InHouse GRNs don't have supplier, but we might want to store customer name for display consistency or UI logic
      // For now, leaving supplierName empty or N/A
    } else {
      // BO Type (Default)
      if (!supplier) {
        return res.status(400).json({ message: "Supplier is required" });
      }
      // Get supplier name from Vendor model
      const vendorData = await Vendor.findById(supplier);
      if (!vendorData) {
        return res.status(400).json({ message: "Supplier not found" });
      }
      supplierName = vendorData.name;
      supplierAddress = vendorData.address || "";
    }


    // Handle PDF upload if provided (single file from upload.fields)
    let pdfUrl = null;
    if (req.files && req.files['pdf'] && req.files['pdf'][0]) {
      try {
        const uploadResult = await uploadOnS3(req.files['pdf'][0].path, "grn/pdf", getCompanyLoginId(req));
        if (uploadResult) {
          pdfUrl = uploadResult.secure_url;
        }
      } catch (uploadError) {
        console.error("PDF upload error:", uploadError);
        // Continue without PDF - it's optional
      }
    }

    // Handle photo uploads if provided (multiple files from upload.fields)
    const photoUrls = [];
    if (req.files && req.files['photos'] && req.files['photos'].length > 0) {
      try {
        for (const file of req.files['photos']) {
          const uploadResult = await uploadOnS3(file.path, "grn/photos", companyId);
          if (uploadResult) {
            photoUrls.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error("Photo upload error:", uploadError);
        // Continue without photos - they're optional
      }
    }

    // Handle items array - support both old single material format and new multiple materials format
    let itemsArray = [];

    // Parse items if it's a JSON string (from FormData)
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        console.error("Failed to parse items:", e);
      }
    }

    if (items && Array.isArray(items) && items.length > 0) {
      // New format: multiple materials/components in items array
      for (const item of items) {

        let itemName = "";
        let componentId = null;
        let materialId = null;
        let itemUnit = "PCS"; // Default
        let itemLocationId = null;


        if (type === 'inhouse') {
          // Processing Component (InHouse)
          if (!item.material && !item.component) { // Frontend might send 'RmBoItem' key even for components, check ID logic
            // If frontend sends component ID in 'RmBoItem' field, we need to distinguish?
            // Standardizing: Assume 'RmBoItem' key might hold componentId in generic forms.
            // Ideally frontend sends 'component' key, but let's check.
            // Implementation Plan said: usage `component` ID.
            // Let's assume frontend logic (GRNModal) now passes component ID in `material` field of `items`?
            // Checking GRNModal: `items` state uses `material` key. So it sends `material` key with Component ID.
            // We should try to find this ID in Component collection first if type is inhouse? 
            // Or just trust it.
          }

          // For now, assume generic 'RmBoItem' key in item holds the ID
          const idToUse = item.component || item.material;

          if (!idToUse) {
            return res.status(400).json({ message: "Component is required for each item" });
          }

          // Need to import Component model? No, it's in store.controller imports...
          // Wait, Component is NOT imported in store.controller! It's in ppc.model.js but not imported at top of this file.
          // I need to add import. Since we are in middle of `type` logic, I can't add import here.
          // I will assume I will add the import at the top of the file in another edit or this tool call supports strictly replaces.
          // Since this tool replaces a block, I cannot easily add import at line 1.
          // I will use mongoose.model("Component") to access it dynamically to avoid import issues for now, or assume it's available.
          // Better: mongoose.model("Component")

          const componentDoc = await Component.findById(idToUse);

          if (!componentDoc) {
            return res.status(400).json({ message: `Component not found: ${idToUse}` });
          }

          componentId = idToUse;
          itemName = componentDoc.componentName || componentDoc.name; // Check component schema
          itemUnit = "Nos"; // Default for components
          // itemLocationId = ??? Components don't usually have stored location in schema yet?

        } else {
          // Processing Material (BO)
          if (!item.material) {
            return res.status(400).json({ message: "Material is required for each item" });
          }

          const materialDoc = await Material.findById(item.material);
          if (!materialDoc) {
            return res.status(400).json({ message: `Material not found: ${item.material}` });
          }

          materialId = item.material;
          itemName = materialDoc.name;
          itemUnit = materialDoc.unit || item.unit || "PCS";
          itemLocationId = materialDoc.locationId || item.locationId;
        }

        if (!item.quantity || item.quantity <= 0) {
          return res.status(400).json({ message: "Valid quantity is required for each item" });
        }


        itemsArray.push({
          material: materialId,
          component: componentId, // New field
          materialName: itemName,
          quantity: parseFloat(item.quantity),
          unit: itemUnit,
          locationId: itemLocationId,
          receivedQuantity: parseFloat(item.quantity),
          acceptedQuantity: (qcRequired) ? 0 : parseFloat(item.quantity),
          rate: parseFloat(item.rate) || 0,
        });
      }
    } else {
      // Old format: single material (Only relevant for BO backward compatibility)
      if (type === 'inhouse') {
        return res.status(400).json({ message: "InHouse GRN requires items list" });
      }

      if (!material) {
        return res.status(400).json({ message: "Material is required" });
      }
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "Valid quantity is required" });
      }

      // Fetch material details
      const materialDoc = await Material.findById(material);
      if (!materialDoc) {
        return res.status(400).json({ message: "Material not found" });
      }

      const derivedUnit = materialDoc.unit || unit || "PCS";
      const derivedLocationId = materialDoc.locationId || locationId;

      // Parse rate from body
      const rate = parseFloat(req.body.rate) || 0;

      itemsArray = [{
        material: material,
        materialName: materialDoc.name,
        quantity: parseFloat(quantity),
        unit: derivedUnit,
        locationId: derivedLocationId,
        receivedQuantity: parseFloat(quantity),
        acceptedQuantity: (qcRequired) ? 0 : parseFloat(quantity),
        rate: rate,
      }];
    }

    // Create GRN with all items
    const grn = await GRN.create({
      company: companyId,
      type: type, // Save type
      grnNumber,
      date: date || new Date(),
      supplier: supplier, // Optional for InHouse
      supplierName: supplierName, // Optional for InHouse
      supplierAddress: supplierAddress,
      customer: customer, // New field
      poNumber: "",
      poReference: poReference || "",
      items: itemsArray,
      pdf: pdfUrl,
      photos: photoUrls,
      receivedBy: req.user.id,
      status: status || "Received",
      qcRequired: qcRequired || false,
      qcStatus: qcRequired ? "Pending" : "Skipped"
    });

    // Auto-update inventory (BO ONLY for now)
    // If QC Required -> Add to Pending Stock
    // If QC Not Required -> Add to Main Stock
    if (type === 'bo' && (status === "Accepted" || status === "Received" || !status)) {
      try {
        const currentDate = new Date();
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);

        for (const item of itemsArray) {
          await updateInventoryStock(
            req,
            item.material,
            parseFloat(item.quantity),
            item.unit,
            item.locationId,
            { isPending: !!qcRequired }
          );

          try {
            await RMInventoryMonthly.findOneAndUpdate(
              { company: companyId, material: item.material, month: currentMonthStr },
              { $inc: { totalInwardQuantity: parseFloat(item.quantity) } },
              { new: true, upsert: true }
            );
          } catch (monthlyErr) {
            console.error("Error updating RM monthly inward quantity:", monthlyErr);
          }
        }
      } catch (err) {
        console.error("Error updating inventory:", err);
      }
    }

    // Auto-update inventory (Component Stock) for InHouse - ONLY IF QC NOT REQUIRED
    if (!qcRequired && type === 'inhouse') {
      console.log("Starting InHouse Stock Update Logic. Status:", status);
      // Allow 'Received', 'Accepted', or empty status (which defaults to Received)
      // Checking explicit string matches to be safe
      if (status === "Accepted" || status === "Received") {
        try {
          console.log(`[InHouseUpdate] Items to process: ${itemsArray.length}`);
          for (const item of itemsArray) {
            const compId = item.component;
            const qty = parseFloat(item.quantity);

            console.log(`[InHouseUpdate] Item details matched: CompID=${compId}, Qty=${qty}`);

            if (compId && !isNaN(qty)) {

              // Use imported Component model directly
              const Component = req.getModel("Component", componentSchema);
              const updateRes = await Component.findByIdAndUpdate(
                compId,
                { $inc: { quantity: qty } },
                { new: true }
              );

              try {
                const currentDate = new Date();
                const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                const FGInventoryMonthly = req.getModel('FGInventoryMonthly', fgInventoryMonthlySchema);
                
                await FGInventoryMonthly.findOneAndUpdate(
                  { company: companyId, fgItem: compId, month: currentMonthStr },
                  { $inc: { totalInwardQuantity: qty } },
                  { new: true, upsert: true }
                );
              } catch (monthlyErr) {
                console.error("Error updating FG monthly inward quantity:", monthlyErr);
              }

              console.log(`[InHouseUpdate] DB Update Result for ${compId}:`, updateRes ? `New Qty: ${updateRes.quantity}` : "FAILED - Doc not found");

              if (!updateRes) {
                console.error(`[InHouseUpdate] CRITICAL: Component ${compId} not found during update!`);
              }

            } else {
              console.warn(`[InHouseUpdate] SKIP detected. HasCompId=${!!compId}, QtyValid=${!isNaN(qty)}`);
            }
          }
        } catch (invError) {
          console.error("[InHouseUpdate] CRITICAL ERROR:", invError);
        }
      } else {
        console.log(`[InHouseUpdate] SKIPPED. Status '${status}' is not Accepted/Received.`);
      }
    }

    res.status(201).json({ message: "GRN created successfully", grn });
  } catch (error) {
    console.error("GRN Creation Error:", error);
    res.status(500).json({
      message: error.message || "Failed to create GRN",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};

