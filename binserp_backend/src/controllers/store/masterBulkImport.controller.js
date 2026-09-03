import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  rmBoItemSchema, rawMaterialSchema, boughtOutSchema, consumableItemSchema, vendorSchema, customerSchema, locationSchema,
  categorySchema, jobWorkSupplierSchema, fgItemSchema, inventorySchema, storePrefixSchema
} from "../../models/store/index.js";
import { componentSchema } from "../../models/ppc/index.js";
import { getUserAudit } from "../../utils/userAudit.helper.js";

const getCompanyId = (req) => {
  return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

export const bulkImportMasters = asyncHandler(async (req, res) => {
  const { masterTab, items, overwrite } = req.body;
  const companyId = getCompanyId(req);
  const { userId, userName } = getUserAudit(req);

  if (!companyId) {
    throw new ApiError(400, "Company ID could not be determined from request context.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Items array is required for bulk import");
  }

  let insertedCount = 0;
  let updatedCount = 0;

  if (
    masterTab === 'rm-bo-item' || masterTab === 'materials' || masterTab === 'rm-item' || masterTab === 'raw-materials' || masterTab === 'raw-material' ||
    masterTab === 'bo-item' || masterTab === 'bought-out' || masterTab === 'bought-outs' || masterTab === 'bo-items' ||
    masterTab === 'inventory-bo' || masterTab === 'inventory-rm' ||
    masterTab === 'consumable-item' || masterTab === 'consumables' || masterTab === 'inventory-consumable'
  ) {
    const isConsumable = masterTab === 'consumable-item' || masterTab === 'consumables' || masterTab === 'inventory-consumable';
    const isBoughtOut = masterTab === 'bo-item' || masterTab === 'bought-out' || masterTab === 'bought-outs' || masterTab === 'bo-items' || masterTab === 'inventory-bo';
    
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Material', rmBoItemSchema);
    const ConsumableItem = req.getModel('ConsumableItem', consumableItemSchema);
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

      const rawItemType = (item.itemType || item.type || '').toString().trim().toLowerCase();
      let determinedItemType = isBoughtOut ? 'Bought Out' : 'Raw Material';
      if (rawItemType.includes('bought') || rawItemType === 'bo') {
        determinedItemType = 'Bought Out';
      } else if (rawItemType.includes('raw') || rawItemType === 'rm') {
        determinedItemType = 'Raw Material';
      }

      // 1. Resolve or create Category
      const defaultCategoryName = isConsumable ? 'Consumables' : (determinedItemType === 'Bought Out' ? 'Bought Out' : 'Raw Material');
      const rawCategory = (item.category || item.categoryName || defaultCategoryName).toString().trim();
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

      // 3. Upsert or Create Record in Dedicated Collection and sync to RmBoItem
      const rmBoDoc = {
        company: companyId,
        name: itemName,
        itemType: determinedItemType,
        descriptions: item.descriptions || item.description || '',
        minimumStock: Number(item.minStock ?? item.minimumStock ?? 0),
        categoryId: category?._id,
        ...(locationId ? { locationId } : {}),
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
        updatedByName: userName
      };

      let rmBoItem = null;
      const rmBoQuery = { company: companyId, name: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };

      const DedicatedModel = isConsumable ? ConsumableItem : (determinedItemType === 'Bought Out' ? BoughtOut : RawMaterial);

      if (overwrite) {
        rmBoItem = await DedicatedModel.findOneAndUpdate(
          rmBoQuery,
          { $set: rmBoDoc },
          { upsert: true, new: true }
        );
        if (!isConsumable) {
          await RmBoItem.findOneAndUpdate(
            { _id: rmBoItem._id },
            { $set: { ...rmBoDoc, company: companyId } },
            { upsert: true, new: true }
          );
        }
        updatedCount++;
      } else {
        rmBoItem = await DedicatedModel.findOne(rmBoQuery);
        if (!rmBoItem) {
          rmBoItem = await DedicatedModel.create(rmBoDoc);
          if (!isConsumable) {
            await RmBoItem.findOneAndUpdate(
              { _id: rmBoItem._id },
              { $set: { ...rmBoDoc, company: companyId } },
              { upsert: true, new: true }
            );
          }
          insertedCount++;
        }
      }

      // 4. Upsert or Create Inventory Record
      const defaultPrefix = isConsumable ? 'CON' : (determinedItemType === 'Bought Out' ? 'BO' : 'RM');
      const materialCode = (item.code || item.materialCode || '').toString().trim() || `${defaultPrefix}-${Math.floor(10000 + Math.random() * 90000)}`;
      const invDoc = {
        company: companyId,
        materialCode,
        materialName: itemName,
        itemType: determinedItemType,
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
    const Category = req.getModel('Category', categorySchema);
    const RawMaterial = req.getModel('RawMaterial', rawMaterialSchema);
    const BoughtOut = req.getModel('BoughtOut', boughtOutSchema);
    const RmBoItem = req.getModel('RmBoItem', rmBoItemSchema);
    req.getModel('Material', rmBoItemSchema); // Register Material ref for Mongoose refPath
    const Inventory = req.getModel('Inventory', inventorySchema);
    const StorePrefix = req.getModel('StorePrefix', storePrefixSchema);

    const prefixSettings = await StorePrefix.findOne({ company: companyId });
    const fgPrefix = prefixSettings?.finishedGoodsPrefix || "FG";
    const rmPrefix = prefixSettings?.rawMaterialPrefix || "RM";
    const boPrefix = prefixSettings?.boughtOutPrefix || "BO";
    let currentCount = await FGItem.countDocuments({ company: companyId });

    // Pre-resolve or auto-create default categories for RM and BO items
    let defaultRMCat = await Category.findOne({ company: companyId, name: { $regex: /^raw material/i } });
    if (!defaultRMCat) {
      try {
        defaultRMCat = await Category.create({
          company: companyId,
          name: "Raw Material",
          code: `CAT-${Math.floor(1000 + Math.random() * 9000)}`,
          unit: "PCS",
          description: "Default Raw Material Category"
        });
      } catch (e) {
        defaultRMCat = await Category.findOne({ company: companyId });
      }
    }

    let defaultBOCat = await Category.findOne({ company: companyId, name: { $regex: /^bought out/i } });
    if (!defaultBOCat) {
      try {
        defaultBOCat = await Category.create({
          company: companyId,
          name: "Bought Out",
          code: `CAT-${Math.floor(1000 + Math.random() * 9000)}`,
          unit: "PCS",
          description: "Default Bought Out Category"
        });
      } catch (e) {
        defaultBOCat = defaultRMCat || await Category.findOne({ company: companyId });
      }
    }

    for (const item of items) {
      if (!item.name) continue;
      const itemName = item.name.toString().trim();

      // Resolve or autogenerate code
      let finalCode = (item.code || "").toString().trim();
      if (!finalCode) {
        finalCode = `${fgPrefix}-${String(++currentCount).padStart(4, '0')}`;
      }

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

      // Resolve BOM components if provided
      const resolvedBOM = [];
      const rawBOM = Array.isArray(item.bom) ? item.bom : [];

      for (const bItem of rawBOM) {
        const bName = (bItem.itemName || bItem.name || '').toString().trim();
        if (!bName) continue;

        const bQty = Number(bItem.quantity || 1) || 1;
        const bUnit = (bItem.unit || 'Nos').toString().trim();
        const rawTypeStr = (bItem.itemType || '').toString().trim().toLowerCase();

        if (rawTypeStr.includes('fg') || rawTypeStr.includes('sub') || rawTypeStr.includes('assembly')) {
          // 1. Resolve or auto-create in FGItem
          let subFg = await FGItem.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!subFg) {
            try {
              subFg = await FGItem.create({
                company: companyId,
                name: bName,
                code: `${fgPrefix}-${String(++currentCount).padStart(4, '0')}`,
                type: 'Component',
                unit: bUnit,
                description: bItem.description || 'Auto-created component from FG BOM import'
              });
            } catch (e) {
              subFg = await FGItem.findOne({ company: companyId, name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
            }
          }

          if (subFg) {
            resolvedBOM.push({
              itemType: 'FGItem',
              item: subFg._id,
              itemName: subFg.name,
              quantity: bQty,
              unit: bUnit || subFg.unit || 'Nos'
            });
          }
        } else if (rawTypeStr.includes('bought') || rawTypeStr === 'bo' || rawTypeStr === 'boughtout') {
          // 2. Resolve or auto-create in BoughtOut & Inventory
          let boItem = await BoughtOut.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!boItem) {
            boItem = await RmBoItem.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }

          if (!boItem) {
            try {
              const boCode = `${boPrefix}-${Math.floor(10000 + Math.random() * 90000)}`;
              boItem = await BoughtOut.create({
                company: companyId,
                name: bName,
                code: boCode,
                categoryId: defaultBOCat?._id,
                descriptions: bItem.description || 'Auto-created bought out item from FG BOM import'
              });

              await Inventory.create({
                company: companyId,
                materialCode: boCode,
                materialName: bName,
                unit: bUnit,
                currentStock: 0,
                reorderLevel: 0,
                reorderQuantity: 0,
                materialId: boItem._id
              });
            } catch (e) {
              console.error("Auto-create BoughtOut error:", e);
              boItem = await BoughtOut.findOne({ company: companyId, name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
            }
          }

          if (boItem) {
            resolvedBOM.push({
              itemType: 'BoughtOut',
              item: boItem._id,
              itemName: boItem.name,
              quantity: bQty,
              unit: bUnit || 'Nos'
            });
          }
        } else {
          // 3. Resolve or auto-create in RawMaterial & Inventory
          let rmItem = await RawMaterial.findOne({
            company: companyId,
            name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          });
          if (!rmItem) {
            rmItem = await RmBoItem.findOne({
              company: companyId,
              name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
          }

          if (!rmItem) {
            try {
              const matCode = `${rmPrefix}-${Math.floor(10000 + Math.random() * 90000)}`;
              rmItem = await RawMaterial.create({
                company: companyId,
                name: bName,
                code: matCode,
                categoryId: defaultRMCat?._id,
                descriptions: bItem.description || 'Auto-created raw material from FG BOM import'
              });

              await Inventory.create({
                company: companyId,
                materialCode: matCode,
                materialName: bName,
                unit: bUnit,
                currentStock: 0,
                reorderLevel: 0,
                reorderQuantity: 0,
                materialId: rmItem._id
              });
            } catch (e) {
              console.error("Auto-create RawMaterial error:", e);
              rmItem = await RawMaterial.findOne({ company: companyId, name: { $regex: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
            }
          }

          if (rmItem) {
            resolvedBOM.push({
              itemType: 'RawMaterial',
              item: rmItem._id,
              itemName: rmItem.name,
              quantity: bQty,
              unit: bUnit || 'Nos'
            });
          }
        }
      }

      const cleanRev = (item.revisionNumber || '').toString().trim();
      const escapedName = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const query = {
        company: companyId,
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        ...(cleanRev
          ? { revisionNumber: { $regex: new RegExp(`^${cleanRev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
          : { $or: [{ revisionNumber: { $exists: false } }, { revisionNumber: null }, { revisionNumber: "" }] }
        )
      };
      const doc = {
        company: companyId,
        name: itemName,
        code: finalCode,
        type: validType,
        unit: item.unit || 'Nos',
        reorderLevel: Number(item.reorderLevel || 0),
        revisionNumber: cleanRev,
        description: item.description || '',
        ...(locationId ? { location: locationId } : {}),
        ...(resolvedBOM.length > 0 ? { bom: resolvedBOM } : {}),
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
        updatedByName: userName
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
      const rawAddress = item.address || item.billingAddress || '';
      const rawCity = item.city || item.billingCity || '';
      const rawState = item.state || item.billingState || '';
      const rawPincode = (item.pincode || item.billingPincode) ? String(item.pincode || item.billingPincode).trim() : '';
      const rawCountry = item.country || item.billingCountry || 'India';

      const doc = {
        company: companyId,
        name: vendName,
        code,
        vendorType: item.vendorType || 'Rm Vendor',
        contactPerson: item.contactPerson || '',
        phone: item.phone ? String(item.phone).trim() : '',
        email: item.email ? String(item.email).trim() : '',
        gst: item.gst ? String(item.gst).trim() : '',
        pan: item.pan ? String(item.pan).trim() : '',
        address: rawAddress,
        billingAddress: rawAddress,
        shippingAddress: item.shippingAddress || rawAddress,
        city: rawCity,
        billingCity: rawCity,
        shippingCity: item.shippingCity || rawCity,
        state: rawState,
        billingState: rawState,
        shippingState: item.shippingState || rawState,
        pincode: rawPincode,
        billingPincode: rawPincode,
        shippingPincode: item.shippingPincode || rawPincode,
        country: rawCountry,
        billingCountry: rawCountry,
        shippingCountry: item.shippingCountry || rawCountry,
        district: item.district || item.billingDistrict || '',
        billingDistrict: item.billingDistrict || item.district || '',
        shippingDistrict: item.shippingDistrict || item.district || '',
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
        updatedByName: userName
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
      const rawAddress = item.address || item.billingAddress || '';
      const rawCity = item.city || item.billingCity || '';
      const rawState = item.state || item.billingState || '';
      const rawPincode = (item.pincode || item.billingPincode) ? String(item.pincode || item.billingPincode).trim() : '';
      const rawCountry = item.country || item.billingCountry || 'India';

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
        address: rawAddress,
        billingAddress: rawAddress,
        shippingAddress: item.shippingAddress || rawAddress,
        city: rawCity,
        billingCity: rawCity,
        shippingCity: item.shippingCity || rawCity,
        state: rawState,
        billingState: rawState,
        shippingState: item.shippingState || rawState,
        pincode: rawPincode,
        billingPincode: rawPincode,
        shippingPincode: item.shippingPincode || rawPincode,
        country: rawCountry,
        billingCountry: rawCountry,
        shippingCountry: item.shippingCountry || rawCountry,
        district: item.district || item.billingDistrict || '',
        billingDistrict: item.billingDistrict || item.district || '',
        shippingDistrict: item.shippingDistrict || item.district || '',
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
        updatedByName: userName
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
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
        updatedByName: userName
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
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
        updatedByName: userName
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
