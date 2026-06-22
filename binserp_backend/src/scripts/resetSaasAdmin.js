import mongoose from "mongoose";
import { SaasAdmin } from "../models/saasadmin.model.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const resetSaasAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB");

        // Delete existing SaaS admin
        await SaasAdmin.deleteMany({ username: "saasadmin" });
        console.log("🗑️  Deleted existing SaaS admin accounts");

        // Create new SaaS Admin
        const saasAdmin = new SaasAdmin({
            username: "saasadmin",
            email: "admin@binssaas.com",
            password: "Admin@123", // This will be hashed automatically
            roleLevel: 100,
        });

        await saasAdmin.save();

        console.log("✅ SaaS Admin created successfully!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📧 Email:", saasAdmin.email);
        console.log("👤 Username:", saasAdmin.username);
        console.log("🔑 Password: Admin@123");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("\n🌐 Access the SaaS Admin Panel at:");
        console.log("   http://localhost:3000/binssaas");

        // Test the password immediately
        console.log("\n🔍 Testing password...");
        const isValid = await saasAdmin.comparePassword("Admin@123");
        console.log("Password test result:", isValid ? "✅ VALID" : "❌ INVALID");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

resetSaasAdmin();
