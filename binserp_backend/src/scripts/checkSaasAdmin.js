import mongoose from "mongoose";
import { SaasAdmin } from "../models/saasadmin/index.js";
import dotenv from "dotenv";

dotenv.config();

const checkAdmin = async () => {
    try {
        console.log(process.env.os);
        await mongoose.connect(`${process.env.MONGODB_URI}/binsbackendsaas`);
        console.log("✅ Connected to MongoDB");
        console.log("📁 Database:", mongoose.connection.name);

        // Find all SaaS admins
        const admins = await SaasAdmin.find({});
        console.log("\n📋 All SaaS Admins in database:");
        console.log("Total count:", admins.length);

        admins.forEach((admin, index) => {
            console.log(`\n${index + 1}. Admin:`);
            console.log("   Username:", `"${admin.username}"`);
            console.log("   Email:", admin.email);
            console.log("   Password hash length:", admin.password?.length);
            console.log("   Created:", admin.createdAt);
        });

        // Try to find with exact username
        const exactMatch = await SaasAdmin.findOne({ username: "saasadmin" });
        console.log("\n🔍 Exact match for 'saasadmin':", exactMatch ? "FOUND" : "NOT FOUND");

        if (exactMatch) {
            console.log("\n✅ Testing password for found admin...");
            const testResult = await exactMatch.comparePassword("Admin@123");
            console.log("Password test result:", testResult ? "✅ VALID" : "❌ INVALID");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

checkAdmin();
