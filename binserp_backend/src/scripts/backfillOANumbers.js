import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getTenantModel } from '../db/tenant.js';
import { incomingPOSchema } from '../models/sales/incomingPO.model.js';
import { Company } from '../models/company/index.js';
import { DB_NAME } from '../constants.js';
import { generateUniqueOANumber } from '../utils/oaNumberGenerator.js';

mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME }).then(async () => {
    console.log("Connected to MongoDB for OA Number Backfill");
    const companies = await Company.find({});
    
    for (const c of companies) {
        if (!c.dbName) continue;
        console.log(`Processing company: ${c.companyName} (${c.dbName})`);
        
        const IncomingPO = getTenantModel(c.dbName, 'IncomingPO', incomingPOSchema);
        const pos = await IncomingPO.find({
            $or: [
                { acknowledgementNumber: { $exists: false } },
                { acknowledgementNumber: null },
                { acknowledgementNumber: "" },
                { acknowledgementNumber: { $not: /^OA-\d{6}/ } }
            ]
        });

        console.log(`Found ${pos.length} Customer PO(s) to backfill for ${c.companyName}`);

        for (const po of pos) {
            const oaNum = await generateUniqueOANumber({
                poNumber: po.poNumber,
                date: po.date || po.createdAt || new Date(),
                companyId: c._id,
                IncomingPO,
                excludeId: po._id
            });

            await IncomingPO.updateOne({ _id: po._id }, { $set: { acknowledgementNumber: oaNum } });
            console.log(`  Updated PO ${po.poNumber} -> OA: ${oaNum}`);
        }
    }

    console.log("OA number backfill completed successfully.");
    process.exit(0);
}).catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
