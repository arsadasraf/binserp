import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";
import { createBomBackup } from "./backupBeforeBomMigration.js";
import { rawMaterialSchema } from "../src/models/store/rawMaterial.model.js";
import { boughtOutSchema } from "../src/models/store/boughtOut.model.js";
import { consumableItemSchema } from "../src/models/store/consumableItem.model.js";
import { fgItemSchema } from "../src/models/store/fgItem.model.js";
import { inventorySchema } from "../src/models/store/inventory.model.js";
import { bomSchema } from "../src/models/store/bom.model.js";
import { rmBoItemSchema } from "../src/models/store/rmBoItem.model.js";
import { mrpPlanSchema } from "../src/models/purchase/mrpPlan.model.js";
import { vendorPriceListSchema } from "../src/models/purchase/vendorPriceList.model.js";
import { purchaseOrderSchema } from "../src/models/purchase/purchaseOrder.model.js";
import { vendorSchema } from "../src/models/store/vendor.model.js";
import { priceListSchema } from "../src/models/sales/priceList.model.js";
import { storePrefixSchema } from "../src/models/store/storePrefix.model.js";
import { categorySchema } from "../src/models/store/category.model.js";
import { userSchema } from "../src/models/user/index.js";
import { recalculateMRPWithLatestBOM } from "../src/controllers/purchase/mrpPlan.controller.js";
import { getTenantModel } from "../src/db/tenant.js";

const isDryRun = process.argv.includes("--dry-run") || !process.argv.includes("--execute");

async function runBomMigration() {
  console.log("================================================================================");
  console.log(`🚀 BINSERP BOM & MRP UOM STANDARDIZATION [${isDryRun ? "DRY-RUN MODE" : "LIVE EXECUTION"}]`);
  console.log("================================================================================");

  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is undefined");
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) uri = `mongodb://${uri}`;
  if (uri.includes("@") && !uri.includes("authSource=")) {
    const separator = uri.includes("?") ? "&" : "?";
    uri = `${uri}${separator}authSource=admin`;
  }

  await mongoose.connect(uri, { dbName: DB_NAME });
  console.log(`✅ Connected to Master Database: ${DB_NAME}`);

  let backupTag = "";
  if (!isDryRun) {
    const backupManifest = await createBomBackup();
    backupTag = backupManifest.timestamp;
  }

  const companies = await Company.find({}).lean();
  console.log(`🏢 Processing ${companies.length} company databases...\n`);

  const summary = {
    totalFGItemsUpdated: 0,
    totalBOMItemsConverted: 0,
    totalStandaloneBOMsUpdated: 0,
    totalMRPPlansResynced: 0
  };

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`🏢 Tenant: ${company.companyName} (${dbName})`);
    console.log(`--------------------------------------------------------------------------------`);
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

    // 1. Fetch Masters for O(1) matching
    const [rawMaterials, boughtOuts, rmBoItems, allFGItems] = await Promise.all([
      tenantDb.collection("rawmaterials").find({}).toArray(),
      tenantDb.collection("boughtouts").find({}).toArray(),
      tenantDb.collection("rmboitems").find({}).toArray(),
      tenantDb.collection("fgitems").find({}).toArray()
    ]);

    const rmById = new Map();
    const rmByName = new Map();
    rawMaterials.forEach(rm => {
      rmById.set(String(rm._id), rm);
      if (rm.name) rmByName.set(rm.name.toLowerCase().trim(), rm);
    });

    const boById = new Map();
    const boByName = new Map();
    boughtOuts.forEach(bo => {
      boById.set(String(bo._id), bo);
      if (bo.name) boByName.set(bo.name.toLowerCase().trim(), bo);
    });

    const rmBoById = new Map();
    const rmBoByName = new Map();
    rmBoItems.forEach(item => {
      rmBoById.set(String(item._id), item);
      if (item.name) rmBoByName.set(item.name.toLowerCase().trim(), item);
    });

    const fgById = new Map();
    const fgByName = new Map();
    allFGItems.forEach(fg => {
      fgById.set(String(fg._id), fg);
      if (fg.name) fgByName.set(fg.name.toLowerCase().trim(), fg);
    });

    // Sync rmboitems with canonical units
    if (!isDryRun) {
      const rmBoColl = tenantDb.collection("rmboitems");
      for (const bo of boughtOuts) {
        await rmBoColl.updateOne(
          { _id: bo._id },
          { $set: { unit: "NOS", type: "Bought Out" } }
        );
      }
      for (const rm of rawMaterials) {
        await rmBoColl.updateOne(
          { _id: rm._id },
          { $set: { unit: "KG", type: "Raw Material" } }
        );
      }
    }

    // 2. Process fgitems.bom
    const fgColl = tenantDb.collection("fgitems");
    const fgsWithBom = allFGItems.filter(f => Array.isArray(f.bom) && f.bom.length > 0);

    for (const fg of fgsWithBom) {
      let bomModified = false;
      const updatedBom = fg.bom.map((bItem, bIdx) => {
        const itemIdStr = String(bItem.item?._id || bItem.item || "");
        const rawName = String(bItem.itemName || "").trim().toLowerCase();
        const rawType = String(bItem.itemType || "RawMaterial");

        const matchedRM = rmById.get(itemIdStr) || rmByName.get(rawName);
        const matchedBO = boById.get(itemIdStr) || boByName.get(rawName);
        const matchedRmBo = rmBoById.get(itemIdStr) || rmBoByName.get(rawName);
        const matchedChildFG = fgById.get(itemIdStr) || fgByName.get(rawName);

        const isRM = rawType === "RawMaterial" || rawType === "Material" || Boolean(matchedRM) || (matchedRmBo && matchedRmBo.type === "Raw Material");
        const isBO = !isRM && (rawType === "BoughtOut" || Boolean(matchedBO) || (matchedRmBo && matchedRmBo.type === "Bought Out"));
        const isFG = !isRM && !isBO && (rawType === "FGItem" || Boolean(matchedChildFG));

        const oldUnit = String(bItem.unit || "").trim();
        const oldQty = Number(bItem.quantity) || 1;

        if (isRM) {
          const master = matchedRM || matchedRmBo;
          let newBaseQty = oldQty;
          let newSecQty = undefined;

          // Metric conversion (GMS -> KG)
          if (oldUnit.toUpperCase() === "GMS" || oldUnit.toUpperCase() === "GRAM" || oldUnit.toUpperCase() === "GRAMS") {
            newBaseQty = Number((oldQty / 1000).toFixed(4));
          } else if (master && master.hasSecondaryUnit && Number(master.conversionFactor) > 0) {
            const cf = Number(master.conversionFactor);
            const secUom = String(master.secondaryUnit || "").toUpperCase();
            if (oldUnit.toUpperCase() === secUom) {
              // 1 KG = cf secUom => Base Qty = oldQty / cf
              newBaseQty = Number((oldQty / cf).toFixed(4));
              newSecQty = oldQty;
            } else if (oldUnit.toUpperCase() === "KG") {
              newBaseQty = oldQty;
              newSecQty = Number((oldQty * cf).toFixed(4));
            } else {
              // Old unit was generic (e.g. Nos/PCS) while master has secondary unit
              newBaseQty = oldQty;
              newSecQty = Number((oldQty * cf).toFixed(4));
            }
          } else {
            newBaseQty = oldQty;
          }

          const hasSec = Boolean(master?.hasSecondaryUnit && master?.secondaryUnit && Number(master?.conversionFactor) > 0);
          const secUnit = master?.secondaryUnit || "";
          const convFactor = Number(master?.conversionFactor) || 1;
          if (hasSec && newSecQty === undefined) {
            newSecQty = Number((newBaseQty * convFactor).toFixed(4));
          }

          const isUnitChanged = oldUnit !== "KG" || bItem.quantity !== newBaseQty;
          if (isUnitChanged || !bItem.hasSecondaryUnit !== !hasSec) {
            bomModified = true;
          }

          console.log(`   [FG BOM] "${fg.name}" line #${bIdx + 1} (${bItem.itemName}):`);
          console.log(`      Old: [${oldQty} ${oldUnit || 'none'}]`);
          console.log(`      New: [${newBaseQty} KG] | Sec: [${hasSec ? `${newSecQty} ${secUnit} (CF: ${convFactor})` : 'none'}]`);
          summary.totalBOMItemsConverted++;

          return {
            ...bItem,
            itemType: "RawMaterial",
            unit: "KG",
            quantity: newBaseQty,
            hasSecondaryUnit: hasSec,
            secondaryUnit: secUnit,
            conversionFactor: convFactor,
            secondaryQuantity: hasSec ? newSecQty : undefined,
            selectedUnit: "KG",
            inputQuantity: newBaseQty
          };
        } else if (isBO) {
          const master = matchedBO || matchedRmBo;
          const hasSec = Boolean(master?.hasSecondaryUnit && master?.secondaryUnit && Number(master?.conversionFactor) > 0);
          const secUnit = master?.secondaryUnit || "";
          const convFactor = Number(master?.conversionFactor) || 1;
          const secQty = hasSec ? Number((oldQty * convFactor).toFixed(4)) : undefined;

          if (oldUnit !== "NOS") {
            bomModified = true;
          }

          console.log(`   [FG BOM] "${fg.name}" line #${bIdx + 1} (${bItem.itemName}):`);
          console.log(`      Old: [${oldQty} ${oldUnit || 'none'}] -> New: [${oldQty} NOS]`);
          summary.totalBOMItemsConverted++;

          return {
            ...bItem,
            itemType: "BoughtOut",
            unit: "NOS",
            quantity: oldQty,
            hasSecondaryUnit: hasSec,
            secondaryUnit: secUnit,
            conversionFactor: convFactor,
            secondaryQuantity: hasSec ? secQty : undefined,
            selectedUnit: "NOS",
            inputQuantity: oldQty
          };
        } else {
          // FGItem / Component
          if (oldUnit !== "NOS") bomModified = true;
          return {
            ...bItem,
            unit: "NOS",
            selectedUnit: "NOS"
          };
        }
      });

      if (bomModified) {
        summary.totalFGItemsUpdated++;
        if (!isDryRun) {
          await fgColl.updateOne(
            { _id: fg._id },
            { $set: { bom: updatedBom } }
          );
        }
      }
    }

    // 3. Process standalone boms collection
    const bomColl = tenantDb.collection("boms");
    const standaloneBoms = await bomColl.find({}).toArray();

    for (const bom of standaloneBoms) {
      if (Array.isArray(bom.items) && bom.items.length > 0) {
        let bModified = false;
        const updatedItems = bom.items.map((it, idx) => {
          const matId = String(it.material || "");
          const matName = String(it.materialName || "").toLowerCase();
          const matchedRM = rmById.get(matId) || rmByName.get(matName);
          const matchedBO = boById.get(matId) || boByName.get(matName);
          const matchedRmBo = rmBoById.get(matId) || rmBoByName.get(matName);

          const isRM = Boolean(matchedRM) || (matchedRmBo && matchedRmBo.type === "Raw Material");
          const targetUnit = isRM ? "KG" : "NOS";
          const oldUnit = String(it.unit || "").trim();

          if (oldUnit !== targetUnit) {
            bModified = true;
            console.log(`   [Standalone BOM] "${bom.bomNumber}" line #${idx + 1} (${it.materialName}): ${oldUnit} -> ${targetUnit}`);
          }

          return {
            ...it,
            unit: targetUnit
          };
        });

        if (bModified) {
          summary.totalStandaloneBOMsUpdated++;
          if (!isDryRun) {
            await bomColl.updateOne(
              { _id: bom._id },
              { $set: { items: updatedItems } }
            );
          }
        }
      }
    }

    // 4. Re-sync Active MRP Plans
    const mrpColl = tenantDb.collection("mrpplans");
    const activePlans = await mrpColl.find({
      status: { $in: ["Planned", "Draft", "In Procurement", "Partially Completed"] }
    }).toArray();

    console.log(`\n   📋 Found ${activePlans.length} active MRP plans to re-sync in ${dbName}`);

    if (!isDryRun && activePlans.length > 0) {
      // Pre-register common models for tenant DB
      getTenantModel(dbName, "Category", categorySchema);
      getTenantModel(dbName, "User", userSchema);
      getTenantModel(dbName, "RawMaterial", rawMaterialSchema);
      getTenantModel(dbName, "BoughtOut", boughtOutSchema);
      getTenantModel(dbName, "FGItem", fgItemSchema);
      getTenantModel(dbName, "Inventory", inventorySchema);
      getTenantModel(dbName, "BOM", bomSchema);
      getTenantModel(dbName, "RmBoItem", rmBoItemSchema);
      getTenantModel(dbName, "StorePrefix", storePrefixSchema);
      getTenantModel(dbName, "PriceList", priceListSchema);
      getTenantModel(dbName, "VendorPriceList", vendorPriceListSchema);
      getTenantModel(dbName, "PurchaseOrder", purchaseOrderSchema);
      getTenantModel(dbName, "Vendor", vendorSchema);
      getTenantModel(dbName, "MRPPlan", mrpPlanSchema);

      const mockReq = {
        company: company,
        getModel: (name, schema) => getTenantModel(dbName, name, schema)
      };

      for (const plan of activePlans) {
        try {
          await recalculateMRPWithLatestBOM(plan._id, mockReq, { force: true, companyId: company._id });
          summary.totalMRPPlansResynced++;
          console.log(`   ✅ Re-synced MRP Plan: ${plan.mrpNumber}`);
        } catch (err) {
          console.warn(`   ⚠️ Could not recalculate MRP Plan ${plan.mrpNumber}:`, err.message);
        }
      }
    }
  }

  console.log("\n================================================================================");
  console.log(`🏁 MIGRATION SUMMARY [${isDryRun ? "DRY-RUN (NO CHANGES MADE)" : "LIVE EXECUTION COMPLETE"}]`);
  console.log("================================================================================");
  console.log(`FG Items with BOM Updated:         ${summary.totalFGItemsUpdated}`);
  console.log(`Individual BOM Items Converted:    ${summary.totalBOMItemsConverted}`);
  console.log(`Standalone BOM Documents Updated:  ${summary.totalStandaloneBOMsUpdated}`);
  console.log(`Active MRP Plans Re-calculated:    ${summary.totalMRPPlansResynced}`);
  if (backupTag) {
    console.log(`Snapshot Backup Tag:               ${backupTag}`);
  }
  console.log("================================================================================\n");

  await mongoose.disconnect();
}

runBomMigration().catch(err => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
