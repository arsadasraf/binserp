import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        let uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI is undefined");
        if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
            uri = `mongodb://${uri}`;
        }

        // 🐳 Docker & Multi-Tenant Helper: Ensure authSource=admin is present if URI contains credentials
        // This ensures mongoose.connection.useDb(tenantDb) preserves root/admin authentication across tenant DBs.
        if (uri.includes("@") && !uri.includes("authSource=")) {
            const separator = uri.includes("?") ? "&" : "?";
            uri = `${uri}${separator}authSource=admin`;
            console.log("🐳 Docker MongoDB URI updated with authSource=admin for multi-tenant access.");
        }

        const connectionInstance = await mongoose.connect(uri, {
            dbName: DB_NAME
        });
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1);
    }
};

export default connectDB;