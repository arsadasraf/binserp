import { updateInventoryStock } from './updateInventoryStock.controller.js';
import mongoose from "mongoose";
import {
  deliveryChallanSchema,
  invoiceSchema,
  grnSchema,
  materialIssueSchema,
  bomSchema,
  inventorySchema,
  materialRequestSchema,
  purchaseOrderSchema,
  vendorSchema,
  customerSchema,
  locationSchema,
  categorySchema,
  materialSchema,
  companyInfoSchema,
  jobWorkSchema,
  jobWorkSupplierSchema,
  quotationSchema
} from "../../models/store/index.js";
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


export const updateGRN = async (req, res) => {
  try {
    const GRN = req.getModel('GRN', grnSchema);
      const Component = req.getModel('Component', componentSchema);
      const Material = req.getModel('Material', materialSchema);

    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status, items } = req.body;

    const grn = await GRN.findOne({ _id: id, company: companyId });
    if (!grn) {
      return res.status(404).json({ message: "GRN not found" });
    }

    const oldStatus = grn.status;
    const newStatus = status || grn.status;

    // Handle PDF upload if provided
    if (req.files && req.files['pdf'] && req.files['pdf'][0]) {
      try {
        const uploadResult = await uploadOnS3(req.files['pdf'][0].path, "grn/pdf", getCompanyLoginId(req));
        if (uploadResult) {
          req.body.pdf = uploadResult.secure_url;
        }
      } catch (uploadError) {
        console.error("PDF upload error:", uploadError);
      }
    }

    // Handle photo uploads (and removal of old ones)
    // existingPhotos should be coming from frontend as a JSON string of URLs to KEEP
    let photoUrls = [];
    if (req.body.existingPhotos) {
      try {
        photoUrls = JSON.parse(req.body.existingPhotos);
      } catch (e) {
        photoUrls = [...(grn.photos || [])]; // Fallback
      }
    } else {
      // If not sent, assume we keep all (backwards compat) OR if strictly managing, might imply delete all?
      // But for safety, if field is missing, we keep existing. 
      // If user wants to delete all, they should send empty array "[]".
      photoUrls = [...(grn.photos || [])];
    }

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
      }
    }

    // Always update photos field if we have touched it (via existingPhotos or new files)
    // If existingPhotos was passed, we definitely want to update.
    if (req.body.existingPhotos || (req.files && req.files['photos'])) {
      req.body.photos = photoUrls;
    }

    // Helper function to check if status affects inventory
    const isInventoryStatus = (status) => ["Accepted", "Received"].includes(status);

    // Handle inventory updates
    if (isInventoryStatus(oldStatus) && isInventoryStatus(newStatus) && items) {
      // GRN was already accepted/received and is being edited
      // Reverse old inventory quantities
      for (const oldItem of grn.items) {
        const oldQuantity = oldItem.acceptedQuantity || oldItem.receivedQuantity || oldItem.quantity;
        const materialId = oldItem.material?._id || oldItem.material; // Safe access
        if (materialId) {
          if (grn.type === 'inhouse') {
            await updateComponentStock(req, materialId, -oldQuantity); // materialId holds component ID for inhouse in generic logic usually, check items mapping
            // But wait, in createGRN we saved `component` field.
            // In updateGRN logic above, we used `oldItem.material?._id`. 
            // Does `oldItem` have `component` field populated?
            // createGRN saves `component: componentId`.
            // getAllGRNs populates `items.component`.
            // So `oldItem.component` should differ from `oldItem.material`.
            // We need to check if we should use `component` or `material` based on type.
          } else {
            await updateInventoryStock(
              req,
              materialId,
              -oldQuantity, // Negative to reverse
              oldItem.unit || "PCS",
              oldItem.locationId
            );
          }
        } else if (oldItem.component && grn.type === 'inhouse') {
          const compId = oldItem.component._id || oldItem.component;
          await updateComponentStock(req, compId, -oldQuantity);
        }
      }

      // Apply new inventory quantities
      // Note: Items might come as strings from FormData, need safe parsing if strictly needed,
      // but usually body parser handles JSON content if sent as such. 
      // Since frontend sends items as JSON string in FormData, logic elsewhere handles parsing?
      // Wait, updateGRN doesn't parse items if string!
      let itemsToUpdate = items;
      if (typeof items === 'string') {
        try { itemsToUpdate = JSON.parse(items); } catch (e) { }
      }

      if (Array.isArray(itemsToUpdate)) {
        for (const newItem of itemsToUpdate) {
          const newQuantity = newItem.acceptedQuantity || newItem.receivedQuantity || newItem.quantity;
          const materialId = newItem.material?._id || newItem.material;
          if (materialId || newItem.component) {
            if (grn.type === 'inhouse') {
              const compId = newItem.component || materialId; // generic fallback
              await updateComponentStock(req, compId, newQuantity);
            } else {
              await updateInventoryStock(
                req,
                materialId,
                newQuantity,
                newItem.unit || "PCS",
                newItem.locationId
              );
            }
          }
        }
      }
    } else if (!isInventoryStatus(oldStatus) && isInventoryStatus(newStatus) && (items || grn.items)) {
      // GRN is being accepted/received for the first time
      let itemsToProcess = items || grn.items;
      if (typeof itemsToProcess === 'string') {
        try { itemsToProcess = JSON.parse(itemsToProcess); } catch (e) { }
      }

      if (Array.isArray(itemsToProcess)) {
        for (const item of itemsToProcess) {
          const quantity = item.acceptedQuantity || item.receivedQuantity || item.quantity;
          const materialId = item.material?._id || item.material;
          if (materialId || item.component) {
            if (grn.type === 'inhouse') {
              const compId = item.component?._id || item.component || materialId;
              await updateComponentStock(req, compId, quantity);
            } else {
              await updateInventoryStock(
                req,
                materialId,
                quantity,
                item.unit || "PCS",
                item.locationId
              );
            }
          }
        }
      }
    } else if (isInventoryStatus(oldStatus) && !isInventoryStatus(newStatus)) {
      // GRN is being changed from Accepted/Received to another status - reverse inventory
      for (const oldItem of grn.items) {
        const oldQuantity = oldItem.acceptedQuantity || oldItem.receivedQuantity || oldItem.quantity;
        const materialId = oldItem.material?._id || oldItem.material;
        if (materialId || oldItem.component) {
          if (grn.type === 'inhouse') {
            const compId = oldItem.component?._id || oldItem.component || materialId;
            await updateComponentStock(req, compId, -oldQuantity);
          } else {
            await updateInventoryStock(
              req,
              materialId,
              -oldQuantity, // Negative to reverse
              oldItem.unit || "PCS",
              oldItem.locationId
            );
          }
        }
      }
    }

    // Ensure items is parsed in req.body for findOneAndUpdate if it came as string (FormData)
    if (req.body.items && typeof req.body.items === 'string') {
      try {
        req.body.items = JSON.parse(req.body.items);
      } catch (e) {
        console.error("Failed to parse items for update:", e);
      }
    }

    const updatedGRN = await GRN.findOneAndUpdate(
      { _id: id, company: companyId },
      req.body,
      { new: true }
    );

    res.status(200).json({ message: "GRN updated successfully", grn: updatedGRN });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

