import axios from "axios";
import mongoose from "mongoose";
import { Company } from "../models/company.model.js";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "http://localhost:8000/api/v1";

const runVerification = async () => {
    try {
        console.log("🚀 Starting verification...");

        let uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
        if (uri.endsWith("/")) uri = uri.slice(0, -1);
        const connectionString = `${uri}/BinsAnalytics_Verification`;

        console.log(`🔌 Connecting to DB: ${connectionString}`);

        await mongoose.connect(connectionString);
        console.log("✅ DB Connected");

        // 1. Register
        const companyData = {
            companyName: `Test Co ${Date.now()}`,
            contactNumber: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            email: `test${Date.now()}@example.com`,
            city: "Test City",
            pincode: "123456",
            country: "Test Country",
        };

        console.log("1️⃣ Registering...");
        const regRes = await axios.post(`${API_URL}/company/register/step1`, companyData);
        const { companyId } = regRes.data;
        console.log(`   Registered CompanyID: ${companyId}`);

        // 2. Get Code
        const companyDoc = await Company.findOne({ companyId });
        if (!companyDoc) throw new Error("Company not found in DB");
        const code = companyDoc.verificationCode;
        console.log(`   Verification Code: ${code}`);

        // 3. Verify
        const userId = `admin_${Date.now()}`;
        const password = "password123";
        console.log("3️⃣ Verifying...");
        const verifyRes = await axios.post(`${API_URL}/company/register/verify`, {
            companyId, verificationCode: code, userId, password
        });
        const companyToken = verifyRes.data.token;
        console.log("   Verified. Token acquired.");

        // 4. Create User
        console.log("4️⃣ Creating User...");
        const userPayload = {
            name: "Test User",
            userId: `user_${Date.now()}`,
            email: `user${Date.now()}@test.com`,
            password: "userpass",
            department: "Store"
        };
        const userCreateRes = await axios.post(`${API_URL}/users/create`, userPayload, {
            headers: { Authorization: `Bearer ${companyToken}` }
        });
        console.log(`   User Created: ${userCreateRes.data.user.userId}`);

        // 5. Login User
        console.log("5️⃣ Logging in User...");
        const userLoginRes = await axios.post(`${API_URL}/users/login`, {
            companyId,
            userId: userPayload.userId,
            password: userPayload.password
        });
        console.log("   User Login Success! Token acquired.");

        console.log("✅ ALL TESTS PASSED");

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        if (err.response) console.error("   API Response:", err.response.data);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
