import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
    try {
        let uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI is undefined");
        if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
            // Assume localhost if just a port or partial string, or prepend scheme
            uri = `mongodb://${uri}`;
        }
        if (uri.endsWith("/")) uri = uri.slice(0, -1);

        const connectionInstance = await mongoose.connect(uri, {
            dbName: DB_NAME
        })
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB