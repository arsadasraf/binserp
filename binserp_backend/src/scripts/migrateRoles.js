import mongoose from "mongoose";
import { Company } from "../models/company/index.js";
import { userSchema, roleSchema } from "../models/user/index.js";
import { employeeSchema } from "../models/hr/index.js";
import { getTenantModel } from "../db/tenant.js";
import { DB_NAME } from "../constants.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { seedDefaultRoles } from "../utils/seedDefaultRoles.js";

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME });
    console.log("Connected to Main DB");

    const companies = await Company.find();
    
    for (const company of companies) {
      if (!company.dbName) continue;
      
      console.log(`Migrating company: ${company.companyName}`);
      const UserModel = getTenantModel(company.dbName, "User", userSchema);
      const EmployeeModel = getTenantModel(company.dbName, "Employee", employeeSchema);
      const RoleModel = getTenantModel(company.dbName, "Role", roleSchema);

      const gmRole = await seedDefaultRoles(RoleModel, company._id);
      const roleMap = {
        Admin: gmRole?._id,
        GM: gmRole?._id
      };

      // Update Users
      const users = await UserModel.find({ roles: { $exists: false } }); // Handle newly added array
      let userCount = 0;
      for (const user of users) {
        if (!user.roles || user.roles.length === 0) {
           if (roleMap[user.department]) {
             user.roles = [roleMap[user.department]];
             await user.save({ validateBeforeSave: false });
             userCount++;
           }
        }
      }
      
      const usersWithEmptyArray = await UserModel.find({ roles: { $size: 0 } }); 
      for (const user of usersWithEmptyArray) {
           if (roleMap[user.department]) {
             user.roles = [roleMap[user.department]];
             await user.save({ validateBeforeSave: false });
             userCount++;
           }
      }

      // Update Employees
      const employees = await EmployeeModel.find({ roles: { $exists: false } });
      let empCount = 0;
      for (const employee of employees) {
        if (!employee.roles || employee.roles.length === 0) {
           if (roleMap[employee.department]) {
             employee.roles = [roleMap[employee.department]];
             await employee.save({ validateBeforeSave: false });
             empCount++;
           }
        }
      }

      const empWithEmptyArray = await EmployeeModel.find({ roles: { $size: 0 } });
      for (const employee of empWithEmptyArray) {
           if (roleMap[employee.department]) {
             employee.roles = [roleMap[employee.department]];
             await employee.save({ validateBeforeSave: false });
             empCount++;
           }
      }

      console.log(`Migrated ${userCount} users and ${empCount} employees in ${company.companyName}`);
    }
    
    console.log("Migration complete.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed", error);
    process.exit(1);
  }
};

migrate();
