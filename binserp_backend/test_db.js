import mongoose from 'mongoose';
import { employeeSchema, attendanceSchema } from './src/models/hr.model.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    // We need to use req.getModel logic or just compile it for testing.
    // The codebase uses multi-tenant architecture, so we need to know the DB name or tenant DB.
    // Wait, let's just connect to the main DB and look at the collections.
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    // Look at the latest attendance records
    const attendanceRecords = await mongoose.connection.db.collection('attendances').find().sort({createdAt: -1}).limit(5).toArray();
    console.log("Latest attendances:", JSON.stringify(attendanceRecords, null, 2));

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
