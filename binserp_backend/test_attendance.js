import mongoose from 'mongoose';
import { employeeSchema, attendanceSchema, companySchema } from './src/models/hr.model.js';
import { Company } from './src/models/company.model.js'; // Wait, company.model.js
import dotenv from 'dotenv';
import { getTenantConnection, getTenantModel } from "./src/db/tenant.js";

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to Master DB");

  // Get the first company
  const company = await mongoose.connection.db.collection('companies').findOne({});
  if (!company) {
    console.log("No company found");
    process.exit(0);
  }

  console.log("Found company:", company.companyId, company.dbName);

  const tenantConn = getTenantConnection(company.dbName);
  const Attendance = getTenantModel(company.dbName, 'Attendance', attendanceSchema);
  const Employee = getTenantModel(company.dbName, 'Employee', employeeSchema);

  const todayStr = "2026-05-21";
  
  const query = {};
  const start = new Date(todayStr);
  const end = new Date(todayStr);
  end.setHours(23, 59, 59, 999);
  query.date = { $gte: start, $lte: end };

  console.log("Query:", query);

  const attendances = await Attendance.find(query).populate('employee');
  console.log(`Found ${attendances.length} records for today`);
  
  if (attendances.length > 0) {
      console.log(JSON.stringify(attendances.map(a => ({
          _id: a._id,
          employee_id: a.employee ? a.employee._id : a.employee,
          date: a.date,
          checkIn: a.checkIn,
          checkOut: a.checkOut
      })), null, 2));
  } else {
      // Find ANY attendance
      const anyAtt = await Attendance.find().sort({createdAt: -1}).limit(5);
      console.log("No records today. Showing latest 5 records instead:");
      console.log(JSON.stringify(anyAtt, null, 2));
  }

  process.exit(0);
}

test().catch(console.error);
