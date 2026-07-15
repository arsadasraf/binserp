import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from 'fs';
import path from 'path';
import passport from "passport";
import { configurePassport } from "./config/passport.js";



const app = express();

app.set('trust proxy', true); // Trust proxy for correct IP resolution

const origin = process.env.FRONTEND_URL || "http://localhost:3000";
// ✅ Fixed CORS configuration for credentials support
app.use(
    cors({
        origin: origin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
// app.use(cors());


app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "16mb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Passport Initialization
configurePassport();
app.use(passport.initialize());

// Global Request Logger

//routes import
import { globalErrorHandler } from "./middlewares/error.middleware.js";
import companyRoutes from "./routes/company.routes.js";
import userRoutes from "./routes/user.routes.js";
import storeRoutes from "./routes/store.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import ppcRoutes from "./routes/ppc.routes.js";
import saasAdminRoutes from "./routes/saasadmin.routes.js";
import visitorRoutes from "./routes/visitor.routes.js";
import vehicleRoutes from "./routes/vehicle.routes.js";
import prefixRoutes from "./routes/prefix.routes.js";
import hrPrefixRoutes from "./routes/hrPrefix.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import qualityRoutes from "./routes/quality.routes.js";
import crmRoutes from "./routes/crm.routes.js";
import authRoutes from "./routes/auth.routes.js";
import accountsRoutes from "./routes/accounts.routes.js";
import documentRoutes from "./routes/document.routes.js";

//routes declaration
app.use("/api/company", companyRoutes);
app.use("/api/user", userRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/ppc", ppcRoutes);
app.use("/api/saasadmin", saasAdminRoutes);
app.use("/api/visitor", visitorRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/prefix", prefixRoutes);
app.use("/api/hr-prefix", hrPrefixRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/quality", qualityRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/documents", documentRoutes);

app.use(globalErrorHandler);
// http://localhost:8000/api/v1/users/register

export { app };
