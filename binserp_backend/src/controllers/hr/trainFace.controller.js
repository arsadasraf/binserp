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

export const trainFace = async (req, res) => {
    try {
        const { employeeId } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: "No photos uploaded" });
        }

        const formData = new FormData();
        formData.append("employee_id", employeeId);

        files.forEach((file) => {
            formData.append("files", fs.createReadStream(file.path), { filename: file.originalname });
        });

        const response = await axios.post(`${PYTHON_SERVICE_URL}/train`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        const companyId = getCompanyId(req);
        let photoUrl = null;
        if (files.length > 0) {
            try {
                const uploadResult = await uploadOnS3(files[0].path, "employees", getCompanyLoginId(req));
                if (uploadResult) {
                    photoUrl = uploadResult.secure_url;
                }
            } catch (err) {
                console.error("S3 upload failed during training:", err);
            }
        }

        const Employee = req.getModel('Employee', employeeSchema);
        await Employee.findOneAndUpdate(
            { _id: employeeId, company: companyId },
            {
                faceEncoding: "Active",
                ...(photoUrl && { photo: photoUrl })
            }
        );

        files.forEach(f => {
            try {
                if (fs.existsSync(f.path)) {
                    fs.unlinkSync(f.path);
                }
            } catch (e) {
                if (e.code !== 'ENOENT') {
                    console.error("Cleanup error", e);
                }
            }
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error("Train Face Error:", error.message);

        if (req.files) {
            req.files.forEach(f => {
                try { fs.unlinkSync(f.path); } catch (e) { }
            });
        }

        res.status(500).json({
            message: "Failed to train face",
            detail: error.response?.data?.detail || error.message
        });
    }
};
