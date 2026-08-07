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

      const defaultRoles = [
        { name: "Store Default Role", department: "Store", policies: [{ module: "Store", tabs: [{ name: "inventory", actions: ["all"] }, { name: "masters", actions: ["all"] }, { name: "job-work", actions: ["all"] }, { name: "material-issue", actions: ["all"] }, { name: "dc", actions: ["all"] }] }] },
        { name: "HR Default Role", department: "HR", policies: [{ module: "HR", tabs: [{ name: "home", actions: ["all"] }, { name: "attendance", actions: ["all"] }, { name: "salaries", actions: ["all"] }, { name: "master", actions: ["all"] }, { name: "present", actions: ["all"] }] }] },
        { name: "PPC Default Role", department: "PPC", policies: [{ module: "PPC", tabs: [{ name: "overview", actions: ["all"] }, { name: "orders", actions: ["all"] }, { name: "planning", actions: ["all"] }, { name: "master", actions: ["all"] }] }] },
        { name: "Admin Default Role", department: "Admin", policies: [{ module: "Admin", tabs: [{ name: "all", actions: ["all"] }] }] },
        { name: "Security Default Role", department: "Security", policies: [{ module: "Security", tabs: [{ name: "overview", actions: ["all"] }, { name: "kiosk", actions: ["all"] }, { name: "visitor", actions: ["all"] }, { name: "vehicle", actions: ["all"] }] }] },
        { name: "CRM Default Role", department: "CRM", policies: [{ module: "CRM", tabs: [{ name: "all", actions: ["all"] }] }] },
      ];

      const roleMap = {};

      for (const dr of defaultRoles) {
        let role = await RoleModel.findOne({ name: dr.name });
        if (!role) {
          role = await RoleModel.create({
            company: company._id,
            name: dr.name,
            description: `Auto-generated default role for ${dr.department} department`,
            policies: dr.policies,
            isDefault: true
          });
        } else {
          // If already exists but doesn't have isDefault, set it
          if (!role.isDefault) {
            role.isDefault = true;
            await role.save({ validateBeforeSave: false });
          }
        }
        roleMap[dr.department] = role._id;
      }

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
