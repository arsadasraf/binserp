import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";

const COLLECTIONS_TO_RESTORE = [
  "inventories",
  "rawmaterials",
  "boughtouts",
  "consumableitems",
  "fgitems",
  "rmboitems",
  "vendorpricelists",
  "pricelists",
  "boms"
];

async function rollback(tagOverride) {
  console.log("================================================================================");
  console.log("🔄 BINSERP UOM MIGRATION ROLLBACK RESTORE");
  console.log("================================================================================");

  let tag = tagOverride;
  if (!tag) {
    const metaPath = path.resolve("./scripts/latest_backup_timestamp.txt");
    if (fs.existsSync(metaPath)) {
      tag = fs.readFileSync(metaPath, "utf8").trim();
    }
  }

  if (!tag) {
    throw new Error("No backup timestamp tag found. Specify tag as argument: node rollbackUomMigration.js <timestamp>");
  }

  console.log(`Target Snapshot Tag to Restore: [${tag}]`);

  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is undefined");
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) uri = `mongodb://${uri}`;
  if (uri.includes("@") && !uri.includes("authSource=")) {
    const separator = uri.includes("?") ? "&" : "?";
    uri = `${uri}${separator}authSource=admin`;
  }

  await mongoose.connect(uri, { dbName: DB_NAME });
  const companies = await Company.find({}).lean();

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    console.log(`\n📦 Restoring tenant: ${company.companyName} (${dbName})`);
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

    for (const collName of COLLECTIONS_RESTORE_LIST(tenantDb, tag)) {
      const backupCollName = `_backup_uom_${collName}_${tag}`;
      const backupColl = tenantDb.collection(backupCollName);
      const backupCount = await backupColl.countDocuments();

      if (backupCount > 0) {
        const liveColl = tenantDb.collection(collName);
        await liveColl.deleteMany({});
        const docs = await backupColl.find({}).toArray();
        await liveColl.insertMany(docs);
        console.log(`   🔁 Restored ${collName} (${backupCount} docs) from ${backupCollName}`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("\n✅ Rollback completed. All collections restored to pre-migration state.\n");
}

function COLLECTIONS_RESTORE_LIST(tenantDb, tag) {
  return COLLECTIONS_TO_RESTORE;
}

const argTag = process.argv[2];
rollback(argTag).catch((err) => {
  console.error("❌ Rollback failed:", err);
  process.exit(1);
});
