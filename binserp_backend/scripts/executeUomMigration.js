import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";
import {
  convertItemUom,
  CANONICAL_BASE_UOMS,
  ALIAS_MAP
} from "./uomConversionEngine.js";

async function executeMigration() {
  console.log("================================================================================");
  console.log("🚀 BINSERP PRODUCTION UOM & PRICE MIGRATION EXECUTION");
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

  const companies = await Company.find({}).lean();
  console.log(`🏢 Processing ${companies.length} company databases...\n`);

  const stats = {
    totalInventoriesUpdated: 0,
    totalRawMaterialsUpdated: 0,
    totalBoughtOutsUpdated: 0,
    totalConsumablesUpdated: 0,
    totalFGItemsUpdated: 0,
    totalRmBoUpdated: 0,
    totalVendorPricesUpdated: 0,
    totalCustomerPricesUpdated: 0,
    totalBomsUpdated: 0,
    preValuationSum: 0,
    postValuationSum: 0
  };

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`🏢 Migrating: ${company.companyName} (${dbName})`);
    console.log(`--------------------------------------------------------------------------------`);
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

    // 1. Raw Materials (Base UOM: KG)
    const rawMaterialsColl = tenantDb.collection("rawmaterials");
    const rms = await rawMaterialsColl.find({}).toArray();
    for (const rm of rms) {
      const conv = convertItemUom(rm, "RM");
      await rawMaterialsColl.updateOne(
        { _id: rm._id },
        {
          $set: {
            unit: conv.baseUnit,
            hasSecondaryUnit: conv.hasSecondaryUnit,
            secondaryUnit: conv.secondaryUnit,
            conversionFactor: conv.conversionFactor
          }
        }
      );
      stats.totalRawMaterialsUpdated++;
      console.log(`   [RM] ${rm.name} (${rm.code || 'N/A'}): ${rm.unit} -> Base: ${conv.baseUnit}, Sec: ${conv.secondaryUnit || 'none'} (CF: ${conv.conversionFactor})`);
    }

    // 2. Bought-Outs (Base UOM: NOS)
    const boughtOutsColl = tenantDb.collection("boughtouts");
    const bos = await boughtOutsColl.find({}).toArray();
    for (const bo of bos) {
      const conv = convertItemUom(bo, "BO");
      await boughtOutsColl.updateOne(
        { _id: bo._id },
        {
          $set: {
            unit: conv.baseUnit,
            hasSecondaryUnit: conv.hasSecondaryUnit,
            secondaryUnit: conv.secondaryUnit,
            conversionFactor: conv.conversionFactor
          }
        }
      );
      stats.totalBoughtOutsUpdated++;
      console.log(`   [BO] ${bo.name} (${bo.code || 'N/A'}): ${bo.unit} -> Base: ${conv.baseUnit}, Sec: ${conv.secondaryUnit || 'none'} (CF: ${conv.conversionFactor})`);
    }

    // 3. Consumables (Base UOM: NOS)
    const consumablesColl = tenantDb.collection("consumableitems");
    const cons = await consumablesColl.find({}).toArray();
    for (const con of cons) {
      const conv = convertItemUom(con, "Consumable");
      await consumablesColl.updateOne(
        { _id: con._id },
        {
          $set: {
            unit: conv.baseUnit,
            hasSecondaryUnit: conv.hasSecondaryUnit,
            secondaryUnit: conv.secondaryUnit,
            conversionFactor: conv.conversionFactor
          }
        }
      );
      stats.totalConsumablesUpdated++;
      console.log(`   [CON] ${con.name} (${con.code || 'N/A'}): ${con.unit} -> Base: ${conv.baseUnit}, Sec: ${conv.secondaryUnit || 'none'} (CF: ${conv.conversionFactor})`);
    }

    // 4. Finished Goods (Base UOM: NOS)
    const fgColl = tenantDb.collection("fgitems");
    const fgs = await fgColl.find({}).toArray();
    for (const fg of fgs) {
      const conv = convertItemUom(fg, "FG");
      await fgColl.updateOne(
        { _id: fg._id },
        {
          $set: {
            unit: conv.baseUnit,
            hasSecondaryUnit: conv.hasSecondaryUnit,
            secondaryUnit: conv.secondaryUnit,
            conversionFactor: conv.conversionFactor
          }
        }
      );
      stats.totalFGItemsUpdated++;
      console.log(`   [FG] ${fg.name || fg.productName} (${fg.code || fg.partCode || 'N/A'}): ${fg.unit} -> Base: ${conv.baseUnit}, Sec: ${conv.secondaryUnit || 'none'} (CF: ${conv.conversionFactor})`);
    }

    // 5. RmBoItems
    const rmBoColl = tenantDb.collection("rmboitems");
    const rmBos = await rmBoColl.find({}).toArray();
    for (const item of rmBos) {
      const classification = item.type === "Bought Out" ? "BO" : "RM";
      const conv = convertItemUom(item, classification);
      await rmBoColl.updateOne(
        { _id: item._id },
        {
          $set: {
            unit: conv.baseUnit,
            hasSecondaryUnit: conv.hasSecondaryUnit,
            secondaryUnit: conv.secondaryUnit,
            conversionFactor: conv.conversionFactor,
            baseRate: conv.newBasePrice
          }
        }
      );
      stats.totalRmBoUpdated++;
    }

    // 6. Inventories (Recalculate Stock, Secondary Stock, Unit Price, Secondary Price)
    const invColl = tenantDb.collection("inventories");
    const inventories = await invColl.find({}).toArray();
    for (const inv of inventories) {
      const preVal = Math.round(Number(inv.currentStock || 0) * Number(inv.unitPrice || 0) * 100) / 100;
      stats.preValuationSum += preVal;

      const classification = String(inv.itemType || '').toLowerCase().includes('raw') ? 'RM' :
                             String(inv.itemType || '').toLowerCase().includes('consumable') ? 'Consumable' : 'BO';
      const conv = convertItemUom(inv, classification);

      const postVal = Math.round(conv.newBaseStock * conv.newBasePrice * 100) / 100;
      stats.postValuationSum += postVal;

      await invColl.updateOne(
        { _id: inv._id },
        {
          $set: {
            unit: conv.baseUnit,
            currentStock: conv.newBaseStock,
            secondaryCurrentStock: conv.newSecondaryStock,
            unitPrice: conv.newBasePrice,
            hasSecondaryUnit: conv.hasSecondaryUnit,
            secondaryUnit: conv.secondaryUnit,
            conversionFactor: conv.conversionFactor,
            // Scale QC pending stock if metric converted
            qcPendingStock: conv.conversionFactor > 0 && inv.qcPendingStock ? (inv.qcPendingStock / (inv.conversionFactor === 1000 ? 1000 : 1)) : (inv.qcPendingStock || 0),
            secondaryQcPendingStock: conv.hasSecondaryUnit && conv.conversionFactor > 0 ? ((inv.qcPendingStock || 0) * conv.conversionFactor) : 0
          }
        }
      );
      stats.totalInventoriesUpdated++;
      console.log(`   [INV] ${inv.materialName} (${inv.materialCode}): Old [${inv.currentStock} ${inv.unit} @ ₹${inv.unitPrice}] -> New Base [${conv.newBaseStock} ${conv.baseUnit} @ ₹${conv.newBasePrice}] | Sec [${conv.newSecondaryStock} ${conv.secondaryUnit || '-'} @ ₹${conv.newSecondaryPrice.toFixed(2)}]`);
    }

    // 7. Vendor Price Lists
    const vplColl = tenantDb.collection("vendorpricelists");
    const vpls = await vplColl.find({}).toArray();
    for (const vpl of vpls) {
      if (vpl.pricingUnit) {
        const normUnit = ALIAS_MAP[vpl.pricingUnit.toUpperCase()] || vpl.pricingUnit;
        await vplColl.updateOne({ _id: vpl._id }, { $set: { pricingUnit: normUnit } });
        stats.totalVendorPricesUpdated++;
      }
    }

    // 8. Customer Price Lists
    const plColl = tenantDb.collection("pricelists");
    const pls = await plColl.find({}).toArray();
    for (const pl of pls) {
      if (pl.pricingUnit) {
        const normUnit = ALIAS_MAP[pl.pricingUnit.toUpperCase()] || pl.pricingUnit;
        await plColl.updateOne({ _id: pl._id }, { $set: { pricingUnit: normUnit } });
        stats.totalCustomerPricesUpdated++;
      }
    }

    // 9. BOMs (Ensure BOM items reference new base UOM)
    const bomColl = tenantDb.collection("boms");
    const boms = await bomColl.find({}).toArray();
    for (const bom of boms) {
      if (Array.isArray(bom.items) && bom.items.length > 0) {
        const updatedItems = bom.items.map((it) => {
          const normUnit = ALIAS_MAP[String(it.unit || '').toUpperCase()] || it.unit;
          return {
            ...it,
            unit: normUnit
          };
        });
        await bomColl.updateOne({ _id: bom._id }, { $set: { items: updatedItems } });
        stats.totalBomsUpdated++;
      }
    }
  }

  const delta = Math.round((stats.preValuationSum - stats.postValuationSum) * 100) / 100;

  console.log("\n================================================================================");
  console.log("🏁 MIGRATION EXECUTION COMPLETED SUCCESSFULLY");
  console.log("================================================================================");
  console.log(`Inventories Converted:             ${stats.totalInventoriesUpdated}`);
  console.log(`Raw Materials Updated:             ${stats.totalRawMaterialsUpdated}`);
  console.log(`Bought-Outs Updated:               ${stats.totalBoughtOutsUpdated}`);
  console.log(`Consumables Updated:               ${stats.totalConsumablesUpdated}`);
  console.log(`Finished Goods Updated:            ${stats.totalFGItemsUpdated}`);
  console.log(`RmBoItems Updated:                 ${stats.totalRmBoUpdated}`);
  console.log(`Vendor Price Lists Normalized:     ${stats.totalVendorPricesUpdated}`);
  console.log(`Customer Price Lists Normalized:   ${stats.totalCustomerPricesUpdated}`);
  console.log(`BOMs Updated:                      ${stats.totalBomsUpdated}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Pre-Migration Total Valuation:     ₹${stats.preValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Post-Migration Total Valuation:    ₹${stats.postValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Valuation Delta:                   ₹${delta.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${delta === 0 ? '✅ (PERFECT INVARIANT)' : '⚠️'}`);
  console.log("================================================================================\n");

  await mongoose.disconnect();
}

executeMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
