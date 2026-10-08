import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";

const COLLECTIONS_TO_BACKUP = [
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

async function createBackup() {
  console.log("================================================================================");
  console.log("🛡️  BINSERP PRE-MIGRATION BACKUP GENERATOR");
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

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const companies = await Company.find({}).lean();
  console.log(`🏢 Creating snapshots for ${companies.length} companies with tag: [${timestamp}]\n`);

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    console.log(`📦 Backing up tenant: ${company.companyName} (${dbName})`);
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

    for (const collName of COLLECTIONS_TO_BACKUP) {
      try {
        const sourceColl = tenantDb.collection(collName);
        const count = await sourceColl.countDocuments();
        if (count > 0) {
          const backupCollName = `_backup_uom_${collName}_${timestamp}`;
          const backupColl = tenantDb.collection(backupCollName);
          const docs = await sourceColl.find({}).toArray();
          await backupColl.insertMany(docs);
          console.log(`   ✅ ${collName} (${count} docs) -> ${backupCollName}`);
        } else {
          console.log(`   ℹ️  ${collName} (0 docs, skipped)`);
        }
      } catch (err) {
        console.warn(`   ⚠️ Warning on ${collName}: ${err.message}`);
      }
    }
  }

  const metaPath = path.resolve("./scripts/latest_backup_timestamp.txt");
  fs.writeFileSync(metaPath, timestamp, "utf8");
  console.log(`\n💾 Snapshot tag saved to: ${metaPath} (${timestamp})`);

  await mongoose.disconnect();
  console.log("🎉 Pre-migration backup completed successfully!\n");
  return timestamp;
}

createBackup().catch((err) => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
