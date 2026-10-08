import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Company } from "../src/models/company/index.js";

async function rollbackBomMigration() {
  const tagArg = process.argv[2];
  if (!tagArg) {
    console.error("Usage: node rollbackBomUomMigration.js <backupTag>");
    process.exit(1);
  }

  console.log("================================================================================");
  console.log(`🔄 BINSERP BOM & MRP ROLLBACK TO SNAPSHOT: ${tagArg}`);
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

  for (const company of companies) {
    const dbName = company.dbName || DB_NAME;
    const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
    console.log(`🏢 Restoring for: ${company.companyName} (${dbName})`);

    const collections = ["fgitems", "boms", "mrpplans"];
    for (const collName of collections) {
      const backupCollName = `backup_${collName}_${tagArg}`;
      const backupExists = await tenantDb.listCollections({ name: backupCollName }).hasNext();

      if (backupExists) {
        const backupColl = tenantDb.collection(backupCollName);
        const docs = await backupColl.find({}).toArray();
        const mainColl = tenantDb.collection(collName);

        await mainColl.deleteMany({});
        if (docs.length > 0) {
          await mainColl.insertMany(docs);
        }
        console.log(`   ✅ Restored ${collName} from ${backupCollName} (${docs.length} docs)`);
      } else {
        console.log(`   ⚠️ No backup collection found for ${collName} with tag ${tagArg}`);
      }
    }
  }

  console.log("\n================================================================================");
  console.log("🎉 BOM & MRP ROLLBACK COMPLETED SUCCESSFULLY");
  console.log("================================================================================\n");

  await mongoose.disconnect();
}

rollbackBomMigration().catch((err) => {
  console.error("❌ Rollback failed:", err);
  process.exit(1);
});
