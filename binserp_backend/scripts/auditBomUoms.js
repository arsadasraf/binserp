import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";

async function auditBomUoms() {
  console.log("================================================================================");
  console.log("🔍 BINSERP BOM & MRP POST-MIGRATION AUDIT SUITE");
  console.log("================================================================================");

  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is undefined");
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) uri = `mongodb://${uri}`;
  if (uri.includes("@") && !uri.includes("authSource=")) {
    const separator = uri.includes("?") ? "&" : "?";
    uri = `${uri}${separator}authSource=admin`;
  }

  await mongoose.connect(uri, { dbName: DB_NAME });
  const companies = await Company.find({}).lean();

  let totalBOMItemsChecked = 0;
  let totalViolations = 0;
  let totalMRPChecked = 0;
  let totalMRPViolations = 0;

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    console.log(`\n🏢 Auditing: ${company.companyName} (${dbName})`);
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

    // 1. Audit FG BOM items
    const fgColl = tenantDb.collection("fgitems");
    const fgs = await fgColl.find({ "bom.0": { $exists: true } }).toArray();

    for (const fg of fgs) {
      for (const b of (fg.bom || [])) {
        totalBOMItemsChecked++;
        const isRM = b.itemType === "RawMaterial" || b.itemType === "Material";
        const isBO = b.itemType === "BoughtOut";
        const expectedBase = isRM ? "KG" : "NOS";

        if (b.unit !== expectedBase) {
          totalViolations++;
          console.error(`   ❌ [FG BOM VIOLATION] FG: "${fg.name}", Item: "${b.itemName}", Type: ${b.itemType}, Unit: "${b.unit}" (Expected: "${expectedBase}")`);
        } else {
          console.log(`   ✅ [FG BOM PASS] FG: "${fg.name}", Item: "${b.itemName}", Type: ${b.itemType}, Unit: "${b.unit}", Qty: ${b.quantity}${b.hasSecondaryUnit ? ` (Sec: ${b.secondaryQuantity} ${b.secondaryUnit})` : ''}`);
        }
      }
    }

    // 2. Audit Standalone BOM items
    const bomColl = tenantDb.collection("boms");
    const boms = await bomColl.find({}).toArray();
    for (const bom of boms) {
      for (const it of (bom.items || [])) {
        totalBOMItemsChecked++;
        if (!["KG", "NOS"].includes(it.unit)) {
          totalViolations++;
          console.error(`   ❌ [BOM VIOLATION] BOM: "${bom.bomNumber}", Mat: "${it.materialName}", Unit: "${it.unit}"`);
        } else {
          console.log(`   ✅ [BOM PASS] BOM: "${bom.bomNumber}", Mat: "${it.materialName}", Unit: "${it.unit}"`);
        }
      }
    }

    // 3. Audit Active MRP plans
    const mrpColl = tenantDb.collection("mrpplans");
    const activePlans = await mrpColl.find({ status: { $in: ["Planned", "Draft", "In Procurement"] } }).toArray();
    for (const plan of activePlans) {
      totalMRPChecked++;
      console.log(`\n   📋 MRP Plan: "${plan.mrpNumber}" (Status: ${plan.status})`);
      for (const req of (plan.rmRequirements || [])) {
        if (req.unit !== "KG") {
          totalMRPViolations++;
          console.error(`      ❌ [MRP RM VIOLATION] Mat: "${req.materialName}", Unit: "${req.unit}" (Expected: "KG")`);
        } else {
          console.log(`      ✅ [MRP RM PASS] Mat: "${req.materialName}", Req: ${req.requiredQuantity} KG, Shortage: ${req.shortage} KG`);
        }
      }
      for (const req of (plan.boRequirements || [])) {
        if (req.unit !== "NOS") {
          totalMRPViolations++;
          console.error(`      ❌ [MRP BO VIOLATION] Mat: "${req.materialName}", Unit: "${req.unit}" (Expected: "NOS")`);
        } else {
          console.log(`      ✅ [MRP BO PASS] Mat: "${req.materialName}", Req: ${req.requiredQuantity} NOS, Shortage: ${req.shortage} NOS`);
        }
      }
    }
  }

  console.log("\n================================================================================");
  console.log("🏁 AUDIT SUITE RESULTS");
  console.log("================================================================================");
  console.log(`BOM Items Checked:     ${totalBOMItemsChecked}`);
  console.log(`BOM Unit Violations:   ${totalViolations}`);
  console.log(`MRP Plans Checked:     ${totalMRPChecked}`);
  console.log(`MRP Unit Violations:   ${totalMRPViolations}`);
  console.log("================================================================================\n");

  if (totalViolations === 0 && totalMRPViolations === 0) {
    console.log("🎉 AUDIT PASSED 100%! All BOMs and Active MRP Plans strictly adhere to canonical UOMs.");
  } else {
    console.error("❌ AUDIT FAILED with violations.");
    process.exit(1);
  }

  await mongoose.disconnect();
}

auditBomUoms().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
