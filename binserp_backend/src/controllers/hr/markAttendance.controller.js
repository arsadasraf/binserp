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

        const companyId = getCompanyId(req);
        const formData = new FormData();
        formData.append("file", fs.createReadStream(file.path), { filename: file.originalname });
        formData.append("company_id", String(companyId || "default"));

        let response;
        try {
            logMsg(`[markAttendance] Calling python service at ${PYTHON_SERVICE_URL}/recognize for company: ${companyId}`);
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

        // Handle Anti-Spoofing Failure
        if (response.data.status === "spoof_detected" || response.data.anti_spoof_passed === false) {
            return res.status(200).json({
                status: "spoof_detected",
                message: response.data.message || "Live human face required. Photos, screens, or printed copies are not permitted.",
                liveness_score: response.data.liveness_score
            });
        }

        if (response.data.status !== "success") {
            return res.status(200).json(response.data);
        }

        const employeeId = response.data.employee_id;
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

        // Logic Implementation with 36-hour Lookback Window (Supports overnight/cross-midnight/extended shifts)
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const lookbackWindow = new Date(now.getTime() - 36 * 60 * 60 * 1000);

        // 1. Check if there is an open check-in session in the last 36 hours
        let openAttendance = await Attendance.findOne({
            employee: employeeId,
            company: companyId,
            "checkIn.time": { $gte: lookbackWindow },
            $or: [
                { "checkOut.time": { $exists: false } },
                { "checkOut.time": null }
            ]
        }).sort({ "checkIn.time": -1 });

        if (openAttendance) {
            // === CHECK-OUT ATTEMPT ===
            const checkInTime = new Date(openAttendance.checkIn.time);
            const diffMs = now.getTime() - checkInTime.getTime();
            const diffMins = diffMs / (1000 * 60);
            const diffHours = diffMs / (1000 * 60 * 60);

            // Rule 1: 5-Minute Anti-Double-Scan Debounce
            if (diffMins < 5) {
                const waitSecs = Math.max(1, Math.round(300 - (diffMs / 1000)));
                return res.status(200).json({
                    status: "warning",
                    type: "debounce",
                    message: `You just checked in ${Math.floor(diffMins)}m ago. Check-out is available after 5 minutes (wait ${waitSecs}s).`,
                    employee: employee.name
                });
            }

            // Rule 2: Early Check-Out (< 4 Hours) Confirmation Check
            const forceCheckOut = req.body.forceCheckOut === true || req.body.forceCheckOut === "true";
            if (diffHours < 4 && !forceCheckOut) {
                const hoursWorkedFormatted = Math.floor(diffHours);
                const minsWorkedFormatted = Math.round((diffHours % 1) * 60);
                return res.status(200).json({
                    status: "requires_confirmation",
                    type: "early_checkout",
                    employee: employee.name,
                    employeeId: employee._id,
                    hoursWorked: parseFloat(diffHours.toFixed(2)),
                    workedText: `${hoursWorkedFormatted}h ${minsWorkedFormatted}m`,
                    message: `You have worked for ${hoursWorkedFormatted}h ${minsWorkedFormatted}m (less than 4 hours). Do you confirm early check-out?`
                });
            }

            // Perform Check-out (Standard or Confirmed Early Departure)
            openAttendance.checkOut = {
                time: now,
                location: req.body.location || "Office",
                markedBy: req.user?._id || req.user?.id,
                method: "Face"
            };
            openAttendance.hoursWorked = parseFloat(diffHours.toFixed(2));
            openAttendance.verificationMethod = "Face";
            if (diffHours < 4) {
                openAttendance.earlyDeparture = true;
            }

            await openAttendance.save();

            return res.status(200).json({
                status: "success",
                type: "Check-Out",
                method: "Face",
                employee: employee.name,
                time: currentTime,
                hoursWorked: openAttendance.hoursWorked,
                earlyDeparture: diffHours < 4
            });
        }

        // 2. Check if employee already completed a shift today (prevent duplicate check-ins in the same calendar day if already completed)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completedToday = await Attendance.findOne({
            employee: employeeId,
            company: companyId,
            "checkIn.time": {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            },
            "checkOut.time": { $exists: true, $ne: null }
        });

        if (completedToday) {
            return res.status(200).json({
                status: "warning",
                message: "Attendance already completed for today",
                employee: employee.name
            });
        }

        // 3. Create a new Check-In
        const newAttendance = await Attendance.create({
            employee: employeeId,
            company: companyId,
            date: now,
            checkIn: {
                time: now,
                location: req.body.location || "Office",
                markedBy: req.user?._id || req.user?.id,
                method: "Face"
            },
            status: "Present",
            hoursWorked: 0,
            verificationMethod: "Face"
        });

        return res.status(200).json({
            status: "success",
            type: "Check-In",
            method: "Face",
            employee: employee.name,
            time: currentTime
        });

    } catch (error) {
        console.error("Mark Attendance Error:", error.message);
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { } }

        res.status(500).json({
            message: "Failed to mark attendance",
            detail: error.response?.data?.detail || error.message
        });
    }
};
