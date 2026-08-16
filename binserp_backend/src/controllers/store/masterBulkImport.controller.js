import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  rmBoItemSchema, vendorSchema, customerSchema, locationSchema,
  categorySchema, jobWorkSupplierSchema, fgItemSchema
} from "../../models/store/index.js";
import { componentSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const bulkImportMasters = asyncHandler(async (req, res) => {
  const { masterTab, items, overwrite } = req.body;
  const companyId = getCompanyId(req);

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Items array is required for bulk import");
  }

  let insertedCount = 0;
  let updatedCount = 0;

  if (masterTab === 'rm-bo-item') {
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    for (const item of items) {
      if (!item.name || !item.code) continue;
      
      const query = { company: companyId, code: item.code };
      const doc = {
        company: companyId,
        name: item.name,
        code: item.code,
        category: item.category || 'Raw Material',
        unit: item.unit || 'PCS',
        openingStock: Number(item.openingStock || 0),
        currentStock: Number(item.openingStock || 0),
        minStock: Number(item.minStock || 0),
        maxStock: Number(item.maxStock || 0),
        rate: Number(item.rate || 0),
        gstRate: Number(item.gstRate || 18),
        hsnCode: item.hsnCode || '',
        storageLocation: item.storageLocation || '',
        description: item.description || '',
      };

      if (overwrite) {
        await RmBoItem.findOneAndUpdate(query, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await RmBoItem.findOne(query);
        if (!exists) {
          await RmBoItem.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'fg-items') {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    for (const item of items) {
      if (!item.name) continue;
      const code = item.code || `FG-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, name: item.name };
      const doc = {
        company: companyId,
        name: item.name,
        code,
        type: item.category || 'Finished Goods',
        unit: item.unit || 'NOS',
        openingStock: Number(item.openingStock || 0),
        rate: Number(item.rate || 0),
        gstRate: Number(item.gstRate || 18),
        hsnCode: item.hsnCode || '',
        description: item.description || '',
      };

      if (overwrite) {
        await FGItem.findOneAndUpdate(query, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await FGItem.findOne(query);
        if (!exists) {
          await FGItem.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'vendor') {
    const Vendor = req.getModel('Vendor', vendorSchema);
    for (const item of items) {
      if (!item.name) continue;
      const code = item.code || `VEND-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, $or: [{ name: item.name }, { code }] };
      const doc = {
        company: companyId,
        name: item.name,
        code,
        contactPerson: item.contactPerson || '',
        phone: item.phone || '',
        email: item.email || '',
        gst: item.gst || '',
        pan: item.pan || '',
        address: item.address || '',
        city: item.city || '',
        state: item.state || '',
        pincode: item.pincode || '',
      };

      if (overwrite) {
        await Vendor.findOneAndUpdate({ company: companyId, code }, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Vendor.findOne(query);
        if (!exists) {
          await Vendor.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'customer') {
    const Customer = req.getModel('Customer', customerSchema);
    for (const item of items) {
      if (!item.name) continue;
      const code = item.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, $or: [{ name: item.name }, { code }] };
      const doc = {
        company: companyId,
        name: item.name,
        code,
        customerType: item.customerType || 'Manufacturing Sales',
        contactPerson: item.contactPerson || '',
        phone: item.phone || '',
        email: item.email || '',
        gst: item.gst || '',
        pan: item.pan || '',
        billingAddress: item.address || '',
        billingCity: item.city || '',
        billingState: item.state || '',
        billingPincode: item.pincode || '',
      };

      if (overwrite) {
        await Customer.findOneAndUpdate({ company: companyId, code }, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Customer.findOne(query);
        if (!exists) {
          await Customer.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'location') {
    const Location = req.getModel('Location', locationSchema);
    for (const item of items) {
      if (!item.name) continue;
      const code = item.code || `LOC-${Math.floor(100 + Math.random() * 900)}`;
      const doc = {
        company: companyId,
        name: item.name,
        code,
        rackNumber: item.rackNumber || '',
        binNumber: item.binNumber || '',
        description: item.description || '',
      };

      if (overwrite) {
        await Location.findOneAndUpdate({ company: companyId, code }, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Location.findOne({ company: companyId, code });
        if (!exists) {
          await Location.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'category') {
    const Category = req.getModel('Category', categorySchema);
    for (const item of items) {
      if (!item.name) continue;
      const code = item.code || `CAT-${Math.floor(100 + Math.random() * 900)}`;
      const doc = {
        company: companyId,
        name: item.name,
        code,
        type: item.type || 'Raw Material',
        description: item.description || '',
      };

      if (overwrite) {
        await Category.findOneAndUpdate({ company: companyId, name: item.name }, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Category.findOne({ company: companyId, name: item.name });
        if (!exists) {
          await Category.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'inhouse-items') {
    const Component = req.getModel('Component', componentSchema);
    for (const item of items) {
      if (!item.name || !item.code) continue;
      const doc = {
        company: companyId,
        componentName: item.name,
        name: item.name,
        code: item.code,
        componentCode: item.code,
        unit: item.unit || 'PCS',
        quantity: Number(item.openingStock || 0),
        rate: Number(item.rate || 0),
        description: item.description || '',
      };

      if (overwrite) {
        await Component.findOneAndUpdate({ company: companyId, code: item.code }, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Component.findOne({ company: companyId, code: item.code });
        if (!exists) {
          await Component.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'job-work-supplier') {
    const JobWorkSupplier = req.getModel('JobWorkSupplier', jobWorkSupplierSchema);
    for (const item of items) {
      if (!item.name) continue;
      const code = item.code || `JW-${Math.floor(1000 + Math.random() * 9000)}`;
      const doc = {
        company: companyId,
        name: item.name,
        code,
        contactPerson: item.contactPerson || '',
        phone: item.phone || '',
        email: item.email || '',
        gst: item.gst || '',
        address: item.address || '',
        city: item.city || '',
        state: item.state || '',
      };

      if (overwrite) {
        await JobWorkSupplier.findOneAndUpdate({ company: companyId, code }, doc, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await JobWorkSupplier.findOne({ company: companyId, name: item.name });
        if (!exists) {
          await JobWorkSupplier.create(doc);
          insertedCount++;
        }
      }
    }
  }

  res.status(200).json(
    new ApiResponse(200, { insertedCount, updatedCount }, `Bulk import completed successfully for ${masterTab}`)
  );
});
