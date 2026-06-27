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

export const markAttendance = async (req, res) => {
    try {
        const logMsg = (msg) => {
            console.log(msg);
            fs.appendFileSync('attendance_debug.log', new Date().toISOString() + ' - ' + msg + '\n');
        };

        logMsg("[markAttendance] Request received");
        const file = req.file;
        if (!file) {
            logMsg("[markAttendance] No image provided in req.file");
            return res.status(400).json({ message: "No image provided" });
        }

        const formData = new FormData();
        formData.append("file", fs.createReadStream(file.path), { filename: file.originalname });

        let response;
        try {
            logMsg(`[markAttendance] Calling python service at ${PYTHON_SERVICE_URL}/recognize`);
            response = await axios.post(`${PYTHON_SERVICE_URL}/recognize`, formData, {
                headers: { ...formData.getHeaders() },
            });
            logMsg(`[markAttendance] Python service responded with status: ${response.status} ${JSON.stringify(response.data)}`);
        } catch (error) {
            logMsg(`[markAttendance] Python Service Error: ${error.message}`);
            if (error.response) {
                logMsg(`[markAttendance] Python Service Error Response: ${JSON.stringify(error.response.data)}`);
            }
            try { fs.unlinkSync(file.path); } catch (e) { } // Cleanup
            return res.status(503).json({
                status: "error",
                message: "Face Recognition Service is unavailable. Please try again later."
            });
        }

        try { fs.unlinkSync(file.path); } catch (e) { console.error("Cleanup error", e); }

        if (response.data.status !== "success") {
            return res.status(200).json(response.data);
        }

        const employeeId = response.data.employee_id;
        const companyId = getCompanyId(req);
        const Employee = req.getModel('Employee', employeeSchema);
        const Attendance = req.getModel('Attendance', attendanceSchema);

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(404).json({
                status: "failed",
                message: `Face recognized as '${employeeId}', but this is not a valid system ID.`
            });
        }

        const employee = await Employee.findOne({ _id: employeeId, company: companyId });
        if (!employee) {
            // SYNC ERROR HANDLING
            console.warn(`Sync Error: Face ID ${employeeId} recognized but not found in DB.`);
            return res.status(200).json({
                status: "failed",
                message: "Face recognized, but employee record missing. Please retrain this face.",
                sync_error: true
            });
        }

        // Logic Implementation
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of day

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        // Find today's attendance using the generated Date object for query
        let attendance = await Attendance.findOne({
            employee: employeeId,
            company: companyId,
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        if (!attendance) {
            // === CHECK-IN ===
            attendance = await Attendance.create({
                employee: employeeId,
                company: companyId,
                date: now, // Stores full timestamp, but queried by range
                checkIn: {
                    time: now,
                    location: "Office"
                },
                status: "Present",
                hoursWorked: 0
            });

            return res.status(200).json({
                status: "success",
                type: "Check-In",
                employee: employee.name,
                time: currentTime
            });

        } else if (!attendance.checkOut?.time) {
            // === CHECK-OUT ATTEMPT ===

            const checkInTime = new Date(attendance.checkIn.time);
            const diffMs = now.getTime() - checkInTime.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // 4 Hours Validation
            if (diffHours < 4) {
                const hoursWait = Math.floor(4 - diffHours);
                const minsWait = Math.round(((4 - diffHours) % 1) * 60);

                return res.status(200).json({
                    status: "warning",
                    message: `Check-out allowed after 4 hours. Wait ${hoursWait}h ${minsWait}m.`,
                    employee: employee.name
                });
            }

            // Perform Check-out
            attendance.checkOut = {
                time: now,
                location: "Office"
            };
            attendance.hoursWorked = parseFloat(diffHours.toFixed(2));

            await attendance.save();

            return res.status(200).json({
                status: "success",
                type: "Check-Out",
                employee: employee.name,
                time: currentTime,
                hoursWorked: attendance.hoursWorked
            });

        } else {
            // === ALREADY COMPLETED ===
            return res.status(200).json({
                status: "warning",
                message: "Attendance already marked for today",
                employee: employee.name
            });
        }

    } catch (error) {
        console.error("Mark Attendance Error:", error.message);
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { } }

        res.status(500).json({
            message: "Failed to mark attendance",
            detail: error.response?.data?.detail || error.message
        });
    }
};
