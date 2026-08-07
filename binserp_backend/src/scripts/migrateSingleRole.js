import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getTenantModel } from '../db/tenant.js';
import { userSchema } from '../models/user/index.js';
import { Company } from '../models/company/index.js';
import { DB_NAME } from '../constants.js';

mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME }).then(async () => {
    console.log("Connected to Main DB");
    const companies = await Company.find({});
    for (const c of companies) {
        if(!c.dbName) continue;
        console.log(`Migrating company: ${c.companyName}`);
        const User = getTenantModel(c.dbName, 'User', userSchema);
        const users = await User.find({});
        for (const user of users) {
            let roleToSet = user.role;
            if (!roleToSet && user.get('roles') && user.get('roles').length > 0) {
                roleToSet = user.get('roles')[0];
            }
            if (roleToSet) {
                await User.updateOne({ _id: user._id }, { $set: { role: roleToSet } });
                console.log('Migrated user', user.userId, 'role to', roleToSet);
            }
        }
    }
    process.exit(0);
}).catch(console.error);
