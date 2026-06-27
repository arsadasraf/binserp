import axios from "axios";
import FormData from "form-data";
import { uploadOnS3 } from "../../utils/s3.js";
import fs from "fs";
import { attendanceSchema, employeeSchema } from "../../models/hr/index.js"; // Unified Model Import
import mongoose from "mongoose";

const getCompanyId = (req) => {
    return req.company?._id || (req.userType === "company" ? req.user.id : req.user.company?._id);
};

const getCompanyLoginId = (req) => {
    return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "";
};
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

export const checkPythonHealth = async (req, res) => {
    try {
        // Simple ping to the root endpoint of the python service
        await axios.get(`${PYTHON_SERVICE_URL}/`, { timeout: 3000 });
        return res.status(200).json({ status: "online" });
    } catch (error) {
        // If it throws an ECONNREFUSED or Timeout, it is offline
        // Even if it returns 404 (because `/` might not exist), as long as it responds, it's technically online
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
            return res.status(503).json({ status: "offline" });
        }
        
        if (error.response) {
            // It responded with a HTTP error status, meaning server is reachable
            return res.status(200).json({ status: "online" });
        }

        // Catch-all for other network errors
        return res.status(503).json({ status: "offline" });
    }
};
