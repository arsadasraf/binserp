import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  rmBoItemSchema, vendorSchema, customerSchema, locationSchema,
  categorySchema, jobWorkSupplierSchema, fgItemSchema, inventorySchema
} from "../../models/store/index.js";
import { componentSchema } from "../../models/ppc/index.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const bulkImportMasters = asyncHandler(async (req, res) => {
  const { masterTab, items, overwrite } = req.body;
  const companyId = getCompanyId(req);

  if (!companyId) {
    throw new ApiError(400, "Company ID could not be determined from request context.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Items array is required for bulk import");
  }

  let insertedCount = 0;
  let updatedCount = 0;

  if (masterTab === 'rm-bo-item' || masterTab === 'materials' || masterTab === 'inventory-bo') {
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    const Category = req.getModel('Category', categorySchema);
    const Location = req.getModel('Location', locationSchema);
    const Inventory = req.getModel('Inventory', inventorySchema);

    // Pre-fetch existing categories and locations for quick lookup and deduplication
    const existingCategories = await Category.find({ company: companyId });
    const categoryMap = new Map();
    existingCategories.forEach((c) => {
      if (c.name) categoryMap.set(c.name.trim().toLowerCase(), c);
      if (c.code) categoryMap.set(c.code.trim().toLowerCase(), c);
    });

    const existingLocations = await Location.find({ company: companyId });
    const locationMap = new Map();
    existingLocations.forEach((l) => {
      if (l.name) locationMap.set(l.name.trim().toLowerCase(), l);
      if (l.code) locationMap.set(l.code.trim().toLowerCase(), l);
    });

    for (const item of items) {
      const itemName = (item.name || item.materialName || '').toString().trim();
      if (!itemName) continue;

      // 1. Resolve or create Category
      const rawCategory = (item.category || item.categoryName || 'Raw Material').toString().trim();
      let category = categoryMap.get(rawCategory.toLowerCase());

      if (!category) {
        category = await Category.findOne({
          company: companyId,
          $or: [
            { name: { $regex: new RegExp(`^${rawCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { code: rawCategory }
          ]
        });

        if (!category) {
          const generatedCatCode = `CAT-${Math.floor(1000 + Math.random() * 9000)}`;
          try {
            category = await Category.create({
              company: companyId,
              name: rawCategory,
              code: generatedCatCode,
              unit: item.unit || 'PCS',
              hsnCode: item.hsnCode ? String(item.hsnCode).trim() : '',
              description: `${rawCategory} Category`
            });
          } catch (e) {
            category = await Category.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${rawCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
            if (!category) {
              category = await Category.findOne({ company: companyId });
            }
          }
        }

        if (category) {
          categoryMap.set(rawCategory.toLowerCase(), category);
          if (category.name) categoryMap.set(category.name.trim().toLowerCase(), category);
        }
      }

      // 2. Resolve or create Location (optional)
      let locationId = undefined;
      const rawLocation = (item.storageLocation || item.location || item.locationName || '').toString().trim();
      if (rawLocation) {
        let location = locationMap.get(rawLocation.toLowerCase());
        if (!location) {
          location = await Location.findOne({
            company: companyId,
            $or: [
              { name: { $regex: new RegExp(`^${rawLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
              { code: rawLocation }
            ]
          });

          if (!location) {
            const generatedLocCode = `LOC-${Math.floor(1000 + Math.random() * 9000)}`;
            try {
              location = await Location.create({
                company: companyId,
                name: rawLocation,
                code: generatedLocCode,
                type: 'Rack',
                description: rawLocation
              });
            } catch (e) {
              location = await Location.findOne({
                company: companyId,
                name: { $regex: new RegExp(`^${rawLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
              });
            }
          }

          if (location) {
            locationMap.set(rawLocation.toLowerCase(), location);
            if (location.name) locationMap.set(location.name.trim().toLowerCase(), location);
          }
        }

        if (location) {
          locationId = location._id;
        }
      }

      // 3. Upsert or Create RmBoItem
      const rmBoDoc = {
        company: companyId,
        name: itemName,
        descriptions: item.descriptions || item.description || '',
        minimumStock: Number(item.minStock ?? item.minimumStock ?? 0),
        categoryId: category?._id,
        ...(locationId ? { locationId } : {})
      };

      let rmBoItem = null;
      const rmBoQuery = { company: companyId, name: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };

      if (overwrite) {
        rmBoItem = await RmBoItem.findOneAndUpdate(
          rmBoQuery,
          { $set: rmBoDoc },
          { upsert: true, new: true }
        );
        updatedCount++;
      } else {
        rmBoItem = await RmBoItem.findOne(rmBoQuery);
        if (!rmBoItem) {
          rmBoItem = await RmBoItem.create(rmBoDoc);
          insertedCount++;
        }
      }

      // 4. Upsert or Create Inventory Record
      const materialCode = (item.code || item.materialCode || '').toString().trim() || `RM-${Math.floor(10000 + Math.random() * 90000)}`;
      const invDoc = {
        company: companyId,
        materialCode,
        materialName: itemName,
        unit: item.unit || category?.unit || 'PCS',
        currentStock: Number(item.openingStock ?? item.currentStock ?? 0),
        reorderLevel: Number(item.minStock ?? item.minimumStock ?? 0),
        reorderQuantity: Number(item.maxStock ?? 0),
        unitPrice: Number(item.rate ?? 0),
        location: rawLocation || '',
        ...(locationId ? { locationId } : {}),
        ...(category?._id ? { categoryId: category._id } : {}),
        ...(rmBoItem?._id ? { materialId: rmBoItem._id } : {})
      };

      await Inventory.findOneAndUpdate(
        {
          company: companyId,
          $or: [
            { materialCode },
            ...(rmBoItem?._id ? [{ materialId: rmBoItem._id }] : [])
          ]
        },
        { $set: invDoc },
        { upsert: true, new: true }
      );
    }
  } else if (masterTab === 'fg-items') {
    const FGItem = req.getModel('FGItem', fgItemSchema);
    const Location = req.getModel('Location', locationSchema);

    for (const item of items) {
      if (!item.name) continue;
      const itemName = item.name.toString().trim();
      const code = item.code ? String(item.code).trim() : `FG-${Math.floor(1000 + Math.random() * 9000)}`;

      // Resolve location if provided
      let locationId = undefined;
      const rawLocation = (item.storageLocation || item.location || '').toString().trim();
      if (rawLocation) {
        let location = await Location.findOne({
          company: companyId,
          $or: [
            { name: { $regex: new RegExp(`^${rawLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { code: rawLocation }
          ]
        });
        if (!location) {
          try {
            location = await Location.create({
              company: companyId,
              name: rawLocation,
              code: `LOC-${Math.floor(1000 + Math.random() * 9000)}`,
              type: 'Rack',
              description: rawLocation
            });
          } catch (e) {
            location = await Location.findOne({ company: companyId, name: { $regex: new RegExp(`^${rawLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          }
        }
        if (location) locationId = location._id;
      }

      // Valid enum: ["Component", "Sub Assembly", "Assembly"]
      let validType = "Assembly";
      const catType = (item.type || item.category || '').toString().trim().toLowerCase();
      if (catType.includes('sub')) validType = 'Sub Assembly';
      else if (catType.includes('comp')) validType = 'Component';
      else validType = 'Assembly';

      const query = { company: companyId, name: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };
      const doc = {
        company: companyId,
        name: itemName,
        code,
        type: validType,
        unit: item.unit || 'Nos',
        quantity: Number(item.openingStock ?? item.quantity ?? 0),
        rate: Number(item.rate || 0),
        gstRate: Number(item.gstRate || 18),
        hsnCode: item.hsnCode ? String(item.hsnCode).trim() : '',
        description: item.description || '',
        ...(locationId ? { location: locationId } : {})
      };

      if (overwrite) {
        await FGItem.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
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
      const vendName = item.name.toString().trim();
      const code = item.code ? String(item.code).trim() : `VEND-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, $or: [{ name: vendName }, { code }] };
      const doc = {
        company: companyId,
        name: vendName,
        code,
        contactPerson: item.contactPerson || '',
        phone: item.phone ? String(item.phone).trim() : '',
        email: item.email ? String(item.email).trim() : '',
        gst: item.gst ? String(item.gst).trim() : '',
        pan: item.pan ? String(item.pan).trim() : '',
        address: item.address || '',
        city: item.city || '',
        state: item.state || '',
        pincode: item.pincode ? String(item.pincode).trim() : '',
      };

      if (overwrite) {
        await Vendor.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
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
      const custName = item.name.toString().trim();
      const code = item.code ? String(item.code).trim() : `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, $or: [{ name: custName }, { code }] };
      const doc = {
        company: companyId,
        name: custName,
        code,
        customerType: item.customerType || 'Manufacturing Sales',
        contactPerson: item.contactPerson || '',
        phone: item.phone ? String(item.phone).trim() : '',
        email: item.email ? String(item.email).trim() : '',
        gst: item.gst ? String(item.gst).trim() : '',
        pan: item.pan ? String(item.pan).trim() : '',
        address: item.address || '',
        billingAddress: item.address || '',
        city: item.city || '',
        billingCity: item.city || '',
        state: item.state || '',
        billingState: item.state || '',
        pincode: item.pincode ? String(item.pincode).trim() : '',
        billingPincode: item.pincode ? String(item.pincode).trim() : '',
      };

      if (overwrite) {
        await Customer.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
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
      const locName = item.name.toString().trim();
      const code = item.code ? String(item.code).trim() : `LOC-${Math.floor(100 + Math.random() * 900)}`;
      const query = { company: companyId, name: { $regex: new RegExp(`^${locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };

      const validTypes = ['Rack', 'Bin', 'Bucket', 'Pallet', 'Table', 'Almirah', 'Shelf', 'Floor', 'Cabinet', 'Box', 'Container'];
      const rawType = (item.type || '').toString().trim();
      const matchedType = validTypes.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Rack';

      const doc = {
        company: companyId,
        name: locName,
        code,
        type: matchedType,
        description: item.description || (item.rackNumber ? `Rack: ${item.rackNumber}${item.binNumber ? `, Bin: ${item.binNumber}` : ''}` : ''),
      };

      if (overwrite) {
        await Location.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Location.findOne(query);
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
      const catName = item.name.toString().trim();
      const code = item.code ? String(item.code).trim() : `CAT-${Math.floor(100 + Math.random() * 900)}`;
      const query = { company: companyId, name: { $regex: new RegExp(`^${catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };
      const doc = {
        company: companyId,
        name: catName,
        code,
        unit: item.unit || 'PCS',
        hsnCode: item.hsnCode ? String(item.hsnCode).trim() : '',
        description: item.description || '',
      };

      if (overwrite) {
        await Category.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Category.findOne(query);
        if (!exists) {
          await Category.create(doc);
          insertedCount++;
        }
      }
    }
  } else if (masterTab === 'inhouse-items') {
    const Component = req.getModel('Component', componentSchema);
    for (const item of items) {
      const compName = (item.name || item.componentName || '').toString().trim();
      if (!compName) continue;
      const code = (item.code || item.componentCode || '').toString().trim() || `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, $or: [{ componentCode: code }, { componentName: compName }] };
      const doc = {
        company: companyId,
        componentName: compName,
        componentCode: code,
        unit: item.unit || 'PCS',
        quantity: Number(item.openingStock ?? item.quantity ?? 0),
        price: Number(item.rate ?? item.price ?? 0),
        description: item.description || '',
        type: 'Component',
        trackingType: 'Individual'
      };

      if (overwrite) {
        await Component.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await Component.findOne(query);
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
      const supName = item.name.toString().trim();
      const code = item.code ? String(item.code).trim() : `JW-${Math.floor(1000 + Math.random() * 9000)}`;
      const query = { company: companyId, $or: [{ name: supName }, { code }] };
      const doc = {
        company: companyId,
        name: supName,
        code,
        contactPerson: item.contactPerson || '',
        phone: item.phone ? String(item.phone).trim() : '',
        email: item.email ? String(item.email).trim() : '',
        gst: item.gst ? String(item.gst).trim() : '',
        address: item.address || '',
        city: item.city || '',
        state: item.state || '',
      };

      if (overwrite) {
        await JobWorkSupplier.findOneAndUpdate(query, { $set: doc }, { upsert: true, new: true });
        updatedCount++;
      } else {
        const exists = await JobWorkSupplier.findOne(query);
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
