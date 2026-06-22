import mongoose from "mongoose";
import { SaasAdmin } from "../models/saasadmin.model.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const seedSaasAdmin = async () => {
    try {
        // Connect to MongoDB
        const DB_NAME = "binsbackendsaas";
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`✅ Connected to MongoDB (${DB_NAME})`);

        // Check if SaaS admin already exists
        const existingAdmin = await SaasAdmin.findOne({ username: "saasadmin" });
        if (existingAdmin) {
            console.log("⚠️  SaaS Admin already exists! Updating password...");
            existingAdmin.password = "Admin@123";
            await existingAdmin.save();
            console.log("✅ Password updated to: Admin@123");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("   http://localhost:3000/binssaas");
            process.exit(0);
        }

        // Create SaaS Admin
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

        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding SaaS Admin:", error);
        process.exit(1);
    }
};

seedSaasAdmin();
