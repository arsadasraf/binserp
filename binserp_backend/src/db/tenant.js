import mongoose from "mongoose";
// import { User, userSchema } from "../models/user.model.js";
// Import other schemas as needed, or load them dynamically if possible. 
// For now, we will import specific schemas we know we need to register on the tenant DB.

const tenantConnections = {}; // Cache connections: { dbName: Connection }
const tenantModels = {}; // Cache models: { dbName: { ModelName: Model } }

/**
 * Get or create a connection to a specific tenant database.
 * @param {string} dbName - The name of the tenant database.
 * @returns {mongoose.Connection}
 */
export const getTenantConnection = (dbName) => {
    if (tenantConnections[dbName]) {
        return tenantConnections[dbName];
    }

    // Use the existing connection pool but switch database
    const connection = mongoose.connection.useDb(dbName, { useCache: true });
    tenantConnections[dbName] = connection;
    console.log(`🔌 Connected to tenant DB: ${dbName}`);
    return connection;
};

/**
 * Get a model for a specific tenant.
 * @param {string} dbName - The database name for the tenant.
 * @param {string} modelName - The name of the model (e.g., "User").
 * @param {mongoose.Schema} schema - The schema for the model.
 * @returns {mongoose.Model}
 */
export const getTenantModel = (dbName, modelName, schema) => {
    if (!dbName) throw new Error("Database name is required to get tenant model");

    // Initialize cache structure if not exists
    if (!tenantModels[dbName]) {
        tenantModels[dbName] = {};
    }

    // Return cached model if exists
    if (tenantModels[dbName][modelName]) {
        return tenantModels[dbName][modelName];
    }

    // Get connection and register model
    const connection = getTenantConnection(dbName);

    // Create model on this specific connection
    const model = connection.model(modelName, schema);

    // Cache and return
    tenantModels[dbName][modelName] = model;
    return model;
};
