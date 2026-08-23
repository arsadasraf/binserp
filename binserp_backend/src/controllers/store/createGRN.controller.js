import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import { grnSchema, materialIssueSchema, bomSchema, inventorySchema, materialRequestSchema, vendorSchema, customerSchema, locationSchema, categorySchema, rmBoItemSchema, rawMaterialSchema, boughtOutSchema, consumableItemSchema, companyInfoSchema, jobWorkSchema, jobWorkSupplierSchema, rmInventoryMonthlySchema, fgInventoryMonthlySchema, fgItemSchema } from "../../models/store/index.js";
import { deliveryChallanSchema, invoiceSchema, quotationSchema } from "../../models/sales/index.js";
import { purchaseOrderSchema } from "../../models/purchase/index.js";
import { storePrefixSchema } from "../../models/store/index.js";
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
  const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
  const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
  const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
  const FGItem = req.getModel('FGItem', fgItemSchema);
  const Component = req.getModel('Component', componentSchema);
  console.log(">>> [createGRN] HIT! Request received.");

  try {
    const companyId = getCompanyId(req);
    let { grnNumber, date, supplier, customer, type, material, materialName, quantity, unit, locationId, category, status, items, poReference, purchaseOrder, qcRequired } = req.body;

    // Parse qcRequired explicitly (Handle "true"/"false" strings from FormData)
    if (qcRequired === 'true') qcRequired = true;
    else if (qcRequired === 'false') qcRequired = false;
    else qcRequired = !!qcRequired; // Fallback for boolean or undefined/null

    // Default type to 'rm' if not provided
    type = type || 'rm';
    console.log(`>>> [createGRN] Processing Type: ${type}, Status: ${status}, QC Required: ${qcRequired}`);

    // Default status to 'Received' if not provided
    status = status || "Received";

    // Validation
    if (!grnNumber) {
      return res.status(400).json({ message: "GRN number is required" });
    }

    // Specific validation based on Type
    let supplierName = "";
    let supplierAddress = "";

    const supplierId = typeof supplier === 'object' && supplier !== null ? (supplier._id || supplier.id) : (supplier || null);
    const customerId = typeof customer === 'object' && customer !== null ? (customer._id || customer.id) : (customer || null);

    if (type === 'inhouse' || type === 'fg') {
      if (customerId) {
        const customerData = await Customer.findById(customerId);
        if (customerData) {
          supplierName = customerData.name || "";
          supplierAddress = customerData.address || "";
        }
      }
    } else {
      if (!supplierId) {
        return res.status(400).json({ message: "Supplier / Vendor is required" });
      }
      const vendorData = await Vendor.findById(supplierId);
      if (vendorData) {
        supplierName = vendorData.name || "";
        supplierAddress = vendorData.address || "";
      }
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
          // Processing Material or Consumable (RM, BO, Consumable)
          if (!item.material) {
            return res.status(400).json({ message: "Material/Item is required for each entry" });
          }

          let materialDoc = await Material.findById(item.material);
          if (!materialDoc) {
            materialDoc = await RawMaterial.findById(item.material);
          }
          if (!materialDoc) {
            materialDoc = await BoughtOut.findById(item.material);
          }
          if (!materialDoc) {
            materialDoc = await ConsumableItem.findById(item.material);
          }
          if (!materialDoc) {
            materialDoc = await FGItem.findById(item.material);
          }
          if (!materialDoc) {
            return res.status(400).json({ message: `Material, Consumable or FG Item not found: ${item.material}` });
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
      let materialDoc = await Material.findById(material);
      if (!materialDoc) {
        materialDoc = await ConsumableItem.findById(material);
      }
      if (!materialDoc) {
        return res.status(400).json({ message: "Material or Consumable not found" });
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
      purchaseOrder: purchaseOrder || undefined,
      poNumber: poReference || "",
      poReference: poReference || "",
      items: itemsArray,
      pdf: pdfUrl,
      photos: photoUrls,
      receivedBy: req.user.id,
      status: status || "Received",
      qcRequired: qcRequired || false,
      qcStatus: qcRequired ? "Pending" : "Skipped"
    });

    // Update Linked Purchase Order Item Quantities & Status
    if (purchaseOrder || poReference) {
      try {
        const PurchaseOrder = req.getModel('PurchaseOrder', purchaseOrderSchema);
        const poQuery = purchaseOrder 
          ? { _id: purchaseOrder, company: companyId } 
          : { poNumber: poReference, company: companyId };
        
        const poDoc = await PurchaseOrder.findOne(poQuery);
        if (poDoc) {
          let poUpdated = false;
          let allItemsCompleted = true;
          let anyItemReceived = false;

          if (Array.isArray(poDoc.items) && poDoc.items.length > 0) {
            poDoc.items.forEach(poItem => {
              const matchingGrnItem = itemsArray.find(gItem => 
                (gItem.material && poItem.material && gItem.material.toString() === poItem.material.toString()) ||
                (gItem.component && poItem.component && gItem.component.toString() === poItem.component.toString()) ||
                (gItem.materialName && poItem.materialName && gItem.materialName.toLowerCase().trim() === poItem.materialName.toLowerCase().trim())
              );

              if (matchingGrnItem) {
                const addedQty = parseFloat(matchingGrnItem.quantity || matchingGrnItem.receivedQuantity || 0);
                poItem.receivedQuantity = (poItem.receivedQuantity || 0) + addedQty;
                poItem.pendingQuantity = Math.max(0, (poItem.quantity || 0) - poItem.receivedQuantity);
                if (poItem.receivedQuantity >= poItem.quantity) {
                  poItem.itemStatus = "Completed";
                } else if (poItem.receivedQuantity > 0) {
                  poItem.itemStatus = "Partially Received";
                }
                poUpdated = true;
              }

              if ((poItem.receivedQuantity || 0) < (poItem.quantity || 0)) {
                allItemsCompleted = false;
              }
              if ((poItem.receivedQuantity || 0) > 0) {
                anyItemReceived = true;
              }
            });
          } else if (poDoc.material || poDoc.materialName) {
            const addedQty = itemsArray.reduce((sum, gItem) => sum + parseFloat(gItem.quantity || 0), 0);
            poDoc.receivedQuantity = (poDoc.receivedQuantity || 0) + addedQty;
            poDoc.pendingQuantity = Math.max(0, (poDoc.quantity || 0) - poDoc.receivedQuantity);
            poUpdated = true;
            allItemsCompleted = poDoc.receivedQuantity >= poDoc.quantity;
            anyItemReceived = poDoc.receivedQuantity > 0;
          }

          if (poUpdated) {
            if (allItemsCompleted) {
              poDoc.status = "Completed";
            } else if (anyItemReceived) {
              poDoc.status = "Partially Received";
            }
            await poDoc.save();
            console.log(`[createGRN] Updated Linked Purchase Order ${poDoc.poNumber}: Status=${poDoc.status}`);
          }
        }
      } catch (poErr) {
        console.error("Error updating linked purchase order from GRN:", poErr);
      }
    }

    // Auto-update inventory (RM, BO, Consumables)
    // If QC Required -> Add to Pending Stock
    // If QC Not Required -> Add to Main Stock
    if (type !== 'inhouse' && (status === "Accepted" || status === "Received" || !status)) {
      try {
        const currentDate = new Date();
        const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const RMInventoryMonthly = req.getModel('RMInventoryMonthly', rmInventoryMonthlySchema);

        let itemTypeOption = "RawMaterial";
        if (type === 'bo') itemTypeOption = "BoughtOut";
        else if (type === 'consumable') itemTypeOption = "Consumable";
        else if (type === 'rm') itemTypeOption = "RawMaterial";

        for (const item of itemsArray) {
          await updateInventoryStock(
            req,
            item.material,
            parseFloat(item.quantity),
            item.unit,
            item.locationId,
            {
              isPending: !!qcRequired,
              itemType: itemTypeOption,
              transactionCategory: qcRequired ? "GRN_QC_PENDING_INWARD" : "GRN_PURCHASE_INWARD",
              referenceDocType: "GRN",
              referenceDocId: grn._id,
              referenceDocNumber: grnNumber,
              recipientOrSource: supplierName || "Supplier",
              purpose: `Goods Receipt Note (${itemTypeOption})`,
              performedBy: req.user?.id || req.user?._id,
            }
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

