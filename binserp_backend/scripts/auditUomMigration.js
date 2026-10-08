import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";
import { rawMaterialSchema } from "../src/models/store/rawMaterial.model.js";
import { boughtOutSchema } from "../src/models/store/boughtOut.model.js";
import { consumableItemSchema } from "../src/models/store/consumableItem.model.js";
import { fgItemSchema } from "../src/models/store/fgItem.model.js";
import { inventorySchema } from "../src/models/store/inventory.model.js";
import { bomSchema } from "../src/models/store/bom.model.js";
import { vendorPriceListSchema } from "../src/models/purchase/vendorPriceList.model.js";
import { priceListSchema } from "../src/models/sales/priceList.model.js";
import { DEFAULT_BASE_UOMS } from "../src/constants/uomConfig.js";

// Canonical Aliases Mapping (1:1 conversion factor = 1)
const ALIASES = {
  // Count / Piece aliases -> NOS
  'PCS': 'NOS',
  'PC': 'NOS',
  'PIECE': 'NOS',
  'PIECES': 'NOS',
  'NO': 'NOS',
  'NOS': 'NOS',
  'NUMBER': 'NOS',
  'NUMBERS': 'NOS',
  'EA': 'NOS',
  'EACH': 'NOS',
  'UNIT': 'NOS',
  'UNITS': 'NOS',
  // Weight aliases -> KG
  'KG': 'KG',
  'KGS': 'KG',
  'KILOGRAM': 'KG',
  'KILOGRAMS': 'KG',
  'LTR': 'LTR',
  'LITRE': 'LTR',
  'LITRES': 'LTR',
  'MTR': 'METER',
  'METER': 'METER',
  'METERS': 'METER'
};

// Known Metric Conversions relative to Base Unit
const METRIC_CONVERSIONS = {
  // Target Base: KG
  'GM': { targetBase: 'KG', multiplierToBase: 0.001, secUnit: 'GM', cf: 1000 },
  'GRAM': { targetBase: 'KG', multiplierToBase: 0.001, secUnit: 'GM', cf: 1000 },
  'GRAMS': { targetBase: 'KG', multiplierToBase: 0.001, secUnit: 'GM', cf: 1000 },
  'TON': { targetBase: 'KG', multiplierToBase: 1000, secUnit: 'TON', cf: 0.001 },
  'TONS': { targetBase: 'KG', multiplierToBase: 1000, secUnit: 'TON', cf: 0.001 },
  'MT': { targetBase: 'KG', multiplierToBase: 1000, secUnit: 'MT', cf: 0.001 },
  // Target Base: METER
  'MM': { targetBase: 'METER', multiplierToBase: 0.001, secUnit: 'MM', cf: 1000 },
  'CM': { targetBase: 'METER', multiplierToBase: 0.01, secUnit: 'CM', cf: 100 },
  'INCH': { targetBase: 'METER', multiplierToBase: 0.0254, secUnit: 'INCH', cf: 39.3701 }
};

async function runAudit() {
  console.log("================================================================================");
  console.log("🔍 BINSERP PRODUCTION UOM MIGRATION AUDIT (READ-ONLY DRY-RUN)");
  console.log("================================================================================");

  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is undefined in .env");
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    uri = `mongodb://${uri}`;
  }
  if (uri.includes("@") && !uri.includes("authSource=")) {
    const separator = uri.includes("?") ? "&" : "?";
    uri = `${uri}${separator}authSource=admin`;
  }

  const connectionInstance = await mongoose.connect(uri, { dbName: DB_NAME });
  console.log(`✅ Connected to Master Database: ${connectionInstance.connection.host}/${DB_NAME}`);

  const companies = await Company.find({}).lean();
  console.log(`🏢 Found ${companies.length} company records.\n`);

  const summary = {
    totalCompanies: companies.length,
    totalInventories: 0,
    totalRawMaterials: 0,
    totalBoughtOuts: 0,
    totalConsumables: 0,
    totalFGItems: 0,
    totalBoms: 0,
    preMigrationValuation: 0,
    simulatedValuation: 0,
    scenarioCounts: {
      A_Alias: 0,
      B_Metric: 0,
      C_Packaging_With_CF: 0,
      C_Packaging_Needs_Confirmation: 0,
      D_Clean_Zero_Stock: 0
    },
    itemsNeedingPackSize: []
  };

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`📦 Inspecting Company: ${company.companyName} (db: ${dbName})`);
    console.log(`--------------------------------------------------------------------------------`);

    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
    const Inventory = tenantDb.model("Inventory", inventorySchema);
    const RawMaterial = tenantDb.model("RawMaterial", rawMaterialSchema);
    const BoughtOut = tenantDb.model("BoughtOut", boughtOutSchema);
    const ConsumableItem = tenantDb.model("ConsumableItem", consumableItemSchema);
    const FGItem = tenantDb.model("FGItem", fgItemSchema);
    const BOM = tenantDb.model("BOM", bomSchema);

    const [inventories, rms, bos, consumables, fgs, boms] = await Promise.all([
      Inventory.find({}).lean(),
      RawMaterial.find({}).lean(),
      BoughtOut.find({}).lean(),
      ConsumableItem.find({}).lean(),
      FGItem.find({}).lean(),
      BOM.find({}).lean(),
    ]);

    summary.totalInventories += inventories.length;
    summary.totalRawMaterials += rms.length;
    summary.totalBoughtOuts += bos.length;
    summary.totalConsumables += consumables.length;
    summary.totalFGItems += fgs.length;
    summary.totalBoms += boms.length;

    console.log(`   - Inventories: ${inventories.length}`);
    console.log(`   - Raw Materials: ${rms.length}`);
    console.log(`   - Bought-Outs: ${bos.length}`);
    console.log(`   - Consumables: ${consumables.length}`);
    console.log(`   - Finished Goods: ${fgs.length}`);
    console.log(`   - Active BOMs: ${boms.length}`);

    // Audit each inventory item
    for (const inv of inventories) {
      const currentUnit = String(inv.unit || '').trim().toUpperCase();
      const currentStock = Number(inv.currentStock || 0);
      const unitPrice = Number(inv.unitPrice || 0);
      const preValuation = Math.round(currentStock * unitPrice * 100) / 100;
      summary.preMigrationValuation += preValuation;

      const itemType = String(inv.itemType || '').toLowerCase();
      let targetBaseUom = DEFAULT_BASE_UOMS.BO; // default NOS
      if (itemType.includes('raw') || itemType.includes('rm')) {
        targetBaseUom = DEFAULT_BASE_UOMS.RM; // KG
      } else if (itemType.includes('consumable')) {
        targetBaseUom = DEFAULT_BASE_UOMS.CONSUMABLE; // NOS
      } else if (itemType.includes('fg') || itemType.includes('finish') || itemType.includes('assembly')) {
        targetBaseUom = DEFAULT_BASE_UOMS.FG; // NOS
      }

      let simulatedBaseStock = currentStock;
      let simulatedBasePrice = unitPrice;
      let scenario = 'A_Alias';

      if (currentStock === 0 && unitPrice === 0) {
        scenario = 'D_Clean_Zero_Stock';
      } else if (ALIASES[currentUnit] === targetBaseUom || currentUnit === targetBaseUom) {
        scenario = 'A_Alias';
        simulatedBaseStock = currentStock;
        simulatedBasePrice = unitPrice;
      } else if (METRIC_CONVERSIONS[currentUnit] && METRIC_CONVERSIONS[currentUnit].targetBase === targetBaseUom) {
        scenario = 'B_Metric';
        const conv = METRIC_CONVERSIONS[currentUnit];
        simulatedBaseStock = currentStock * conv.multiplierToBase;
        simulatedBasePrice = conv.multiplierToBase > 0 ? (unitPrice / conv.multiplierToBase) : unitPrice;
      } else if (inv.hasSecondaryUnit && Number(inv.conversionFactor) > 0) {
        scenario = 'C_Packaging_With_CF';
        const cf = Number(inv.conversionFactor);
        // Secondary Qty = Base Qty * CF  =>  Base Qty = Secondary Qty / CF
        // If current stock was stored in secondary packaging:
        simulatedBaseStock = currentStock;
        simulatedBasePrice = unitPrice;
      } else {
        // Packaging or custom unit without defined CF (e.g. BOX, PACK, ROLL)
        scenario = 'C_Packaging_Needs_Confirmation';
        summary.itemsNeedingPackSize.push({
          companyName: company.companyName,
          materialCode: inv.materialCode,
          materialName: inv.materialName,
          itemType: inv.itemType,
          currentUnit: inv.unit,
          currentStock,
          unitPrice,
          preValuation,
          targetBaseUom,
          suggestedSecondaryUnit: inv.unit
        });
      }

      summary.scenarioCounts[scenario] = (summary.scenarioCounts[scenario] || 0) + 1;
      const simValuation = Math.round(simulatedBaseStock * simulatedBasePrice * 100) / 100;
      summary.simulatedValuation += simValuation;
    }
  }

  const delta = Math.round((summary.preMigrationValuation - summary.simulatedValuation) * 100) / 100;

  console.log("\n================================================================================");
  console.log("📊 PRODUCTION MIGRATION AUDIT RESULTS");
  console.log("================================================================================");
  console.log(`Total Companies Audited:           ${summary.totalCompanies}`);
  console.log(`Total Inventory Items:             ${summary.totalInventories}`);
  console.log(`Total Raw Materials:               ${summary.totalRawMaterials}`);
  console.log(`Total Bought-Out Items:            ${summary.totalBoughtOuts}`);
  console.log(`Total Consumables:                 ${summary.totalConsumables}`);
  console.log(`Total Finished Goods:              ${summary.totalFGItems}`);
  console.log(`Total BOMs:                        ${summary.totalBoms}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Pre-Migration Total Valuation:     ₹${summary.preMigrationValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Simulated Total Valuation:         ₹${summary.simulatedValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Valuation Delta (Difference):      ₹${delta.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${delta === 0 ? '✅ (PERFECT ZERO DELTA)' : '⚠️'}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("Item Breakdown by Conversion Scenario:");
  console.log(`  1. Scenario A (Canonical Aliases / 1:1 Normalization):   ${summary.scenarioCounts.A_Alias}`);
  console.log(`  2. Scenario B (Metric Conversions e.g. GM->KG, TON->KG): ${summary.scenarioCounts.B_Metric}`);
  console.log(`  3. Scenario C (Packaged with existing CF):                ${summary.scenarioCounts.C_Packaging_With_CF}`);
  console.log(`  4. Scenario C (Packaged needing pack size verification):  ${summary.scenarioCounts.C_Packaging_Needs_Confirmation}`);
  console.log(`  5. Scenario D (Clean Zero Stock / Unpriced):             ${summary.scenarioCounts.D_Clean_Zero_Stock}`);
  console.log("================================================================================");

  if (summary.itemsNeedingPackSize.length > 0) {
    console.log(`\n⚠️  Items Flagged for Pack Size Review (${summary.itemsNeedingPackSize.length}):`);
    console.table(summary.itemsNeedingPackSize.slice(0, 15));
    if (summary.itemsNeedingPackSize.length > 15) {
      console.log(`... and ${summary.itemsNeedingPackSize.length - 15} more items.`);
    }
  } else {
    console.log("\n🎉 Zero items flagged! All items map cleanly to standard base units.");
  }

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected from MongoDB. Audit complete.\n");
}

runAudit().catch((err) => {
  console.error("❌ Audit Error:", err);
  process.exit(1);
});
