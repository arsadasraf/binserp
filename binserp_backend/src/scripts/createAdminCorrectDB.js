import mongoose from "mongoose";
import { SaasAdmin } from "../models/saasadmin/index.js";
import { DB_NAME } from "../constants.js";
import dotenv from "dotenv";

dotenv.config();

const createAdminInCorrectDB = async () => {
    try {
        // Connect to the SAME database as the server
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log("✅ Connected to MongoDB");
        console.log("📁 Database:", mongoose.connection.name);
        console.log("🔗 Full connection string:", mongoose.connection.host);

        // Delete any existing SaaS admins in this database
        const deleteResult = await SaasAdmin.deleteMany({});
        console.log(`\n🗑️  Deleted ${deleteResult.deletedCount} existing SaaS admin(s)`);

        // Create new SaaS Admin
        const saasAdmin = new SaasAdmin({
            username: "saasadmin",
            email: "admin@binssaas.com",
            password: "Admin@123", // Will be hashed automatically
            roleLevel: 100,
        });

        await saasAdmin.save();

        console.log("\n✅ SaaS Admin created successfully!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📧 Email:", saasAdmin.email);
        console.log("👤 Username:", saasAdmin.username);
        console.log("🔑 Password: Admin@123");
        console.log("📁 Database:", DB_NAME);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Test the password
        console.log("\n🔍 Testing password...");
        const isValid = await saasAdmin.comparePassword("Admin@123");
        console.log("Password test result:", isValid ? "✅ VALID" : "❌ INVALID");

        // Verify it can be found
        console.log("\n🔍 Verifying admin can be found...");
        const foundAdmin = await SaasAdmin.findOne({ username: "saasadmin" });
        console.log("Admin found:", foundAdmin ? "✅ YES" : "❌ NO");

        console.log("\n🌐 Access the SaaS Admin Panel at:");
        console.log("   http://localhost:3000/binssaas");
        console.log("\n⚠️  IMPORTANT: Restart your backend server for changes to take effect!");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

createAdminInCorrectDB();
