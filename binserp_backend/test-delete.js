import mongoose from "mongoose";
import { productionOrderSchema } from "./src/models/ppc/index.js";
import { config } from "dotenv";

config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/binserp").then(async () => {
  try {
    const ProductionOrder = mongoose.model('ProductionOrder', productionOrderSchema);
    const order = await ProductionOrder.findOne();
    if (order) {
        console.log("Found order, attempting to delete...");
        await order.deleteOne();
        console.log("Deleted.");
    } else {
        console.log("No order found");
    }
  } catch(e) {
    console.error("Error:", e);
  }
  process.exit(0);
});
