import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";

export async function createBomBackup(customTag = "") {
  console.log("================================================================================");
  console.log("🛡️ BINSERP BOM & MRP PRE-MIGRATION BACKUP UTILITY");
  console.log("================================================================================");

  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is undefined");
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) uri = `mongodb://${uri}`;
  if (uri.includes("@") && !uri.includes("authSource=")) {
    const separator = uri.includes("?") ? "&" : "?";
    uri = `${uri}${separator}authSource=admin`;
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { dbName: DB_NAME });
  }

  const timestamp = customTag || new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  console.log(`📦 Backup Tag: ${timestamp}`);

  const companies = await Company.find({}).lean();
  console.log(`🏢 Found ${companies.length} company databases to backup.\n`);

  const manifest = {
    timestamp,
    createdAt: new Date().toISOString(),
    companies: []
  };

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
    console.log(`📁 Backing up collections for: ${company.companyName} (${dbName})`);

    const collectionsToBackup = ["fgitems", "boms", "mrpplans"];
    const companySummary = { companyName: company.companyName, dbName, backups: {} };

    for (const collName of collectionsToBackup) {
      const sourceColl = tenantDb.collection(collName);
      const count = await sourceColl.countDocuments();
      const backupCollName = `backup_${collName}_${timestamp}`;

      if (count > 0) {
        const docs = await sourceColl.find({}).toArray();
        const backupColl = tenantDb.collection(backupCollName);
        await backupColl.deleteMany({});
        await backupColl.insertMany(docs);
        companySummary.backups[collName] = { backupCollName, count };
        console.log(`   ✅ ${collName.padEnd(12)} -> ${backupCollName} (${count} docs)`);
      } else {
        companySummary.backups[collName] = { backupCollName: null, count: 0 };
        console.log(`   ℹ️ ${collName.padEnd(12)} -> (0 docs, skipped)`);
      }
    }
    manifest.companies.push(companySummary);
  }

  // Save manifest into admin db
  const adminDb = mongoose.connection.useDb(DB_NAME, { useCache: true });
  await adminDb.collection("uom_migration_manifests").insertOne({
    type: "BOM_MIGRATION_BACKUP",
    ...manifest
  });

  console.log("\n================================================================================");
  console.log(`🎉 BOM BACKUP COMPLETED SUCCESSFULLY (Tag: ${timestamp})`);
  console.log("================================================================================\n");

  return manifest;
}

if (process.argv[1]?.endsWith("backupBeforeBomMigration.js")) {
  createBomBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ BOM Backup failed:", err);
      process.exit(1);
    });
}
