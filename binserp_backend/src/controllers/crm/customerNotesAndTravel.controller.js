import path from "path";
import fs from "fs";
import { customerSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { uploadOnS3 } from "../../utils/s3.js";

// Helper to persist uploaded files (S3 or local uploads fallback)
const resolveUploadedFile = async (file, folder = "crm/customers", companyId = "") => {
    if (!file) return null;

    try {
        const s3Result = await uploadOnS3(file.path, folder, companyId);
        if (s3Result && s3Result.secure_url) {
            return s3Result.secure_url;
        }
    } catch (err) {
        console.warn("S3 upload failed for CRM customer attachment, using local fallback:", err.message);
    }

    const destDir = path.join(process.cwd(), "public", "uploads", folder);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname || file.filename);
    const destPath = path.join(destDir, uniqueName);

    try {
        if (fs.existsSync(file.path)) {
            fs.copyFileSync(file.path, destPath);
            fs.unlinkSync(file.path);
        }
        return `/uploads/${folder}/${uniqueName}`;
    } catch (e) {
        const base = path.basename(file.path);
        return `/temp/${base}`;
    }
};

/**
 * Add a rich multi-modal contact note to a customer
 * Supports: Voice recording, Photos, Document attachments, Formatted text
 */
export const addCustomerNote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel("Customer", customerSchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id });
    if (!customer) throw new ApiError(404, "Customer not found");

    const {
        text,
        type = "Note",
        voiceDuration = 0
    } = req.body;

    if (!text || !text.trim()) {
        throw new ApiError(400, "Note text or discussion summary is required");
    }

    const companyId = req.company?._id?.toString() || "";

    // 1. Voice Note
    let voiceUrl = null;
    if (req.files && req.files["voice"] && req.files["voice"][0]) {
        voiceUrl = await resolveUploadedFile(req.files["voice"][0], "crm/voice", companyId);
    }

    // 2. Photos
    const photoUrls = [];
    if (req.files && req.files["photos"] && req.files["photos"].length > 0) {
        for (const photoFile of req.files["photos"]) {
            const url = await resolveUploadedFile(photoFile, "crm/photos", companyId);
            if (url) photoUrls.push(url);
        }
    }

    // 3. Document Attachments
    const attachmentObjs = [];
    if (req.files && req.files["files"] && req.files["files"].length > 0) {
        for (const docFile of req.files["files"]) {
            const url = await resolveUploadedFile(docFile, "crm/docs", companyId);
            if (url) {
                attachmentObjs.push({
                    name: docFile.originalname || path.basename(url),
                    url,
                    size: docFile.size || 0,
                    mimeType: docFile.mimetype || "application/octet-stream"
                });
            }
        }
    }

    const newNote = {
        type,
        text: text.trim(),
        voiceUrl,
        voiceDuration: voiceDuration ? Number(voiceDuration) : 0,
        photos: photoUrls,
        attachments: attachmentObjs,
        createdBy: req.user._id,
        createdByName: req.user.name || "Executive",
        createdAt: new Date()
    };

    if (!customer.notesHistory) customer.notesHistory = [];
    customer.notesHistory.unshift(newNote);
    await customer.save();

    return res.status(201).json(
        new ApiResponse(201, {
            notesHistory: customer.notesHistory,
            addedNote: newNote
        }, "Contact note added successfully")
    );
});

/**
 * Get all contact notes for a customer
 */
export const getCustomerNotes = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel("Customer", customerSchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id })
        .select("name customerCode notes notesHistory");

    if (!customer) throw new ApiError(404, "Customer not found");

    return res.status(200).json(
        new ApiResponse(200, customer.notesHistory || [], "Customer contact notes fetched successfully")
    );
});

/**
 * Delete a contact note from customer
 */
export const deleteCustomerNote = asyncHandler(async (req, res) => {
    const { id, noteId } = req.params;
    const Customer = req.getModel("Customer", customerSchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id });
    if (!customer) throw new ApiError(404, "Customer not found");

    customer.notesHistory = (customer.notesHistory || []).filter(
        (n) => n._id?.toString() !== noteId
    );
    await customer.save();

    return res.status(200).json(
        new ApiResponse(200, customer.notesHistory, "Contact note removed successfully")
    );
});

/**
 * Add a customer travel & visit log
 * Tracks: Visit date, Visitor, Purpose, KM, Mode, Expense, MOM, Outcome, Next visit date, Photos
 */
export const addCustomerTravelLog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel("Customer", customerSchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id });
    if (!customer) throw new ApiError(404, "Customer not found");

    const {
        visitDate,
        visitorName,
        purpose,
        location,
        distanceKm = 0,
        travelMode = "Car",
        expense = 0,
        minutesOfMeeting,
        outcome = "Positive",
        nextVisitDate
    } = req.body;

    if (!purpose || !purpose.trim()) {
        throw new ApiError(400, "Visit purpose is required");
    }

    const companyId = req.company?._id?.toString() || "";

    // Photos
    const photoUrls = [];
    if (req.files && req.files["photos"] && req.files["photos"].length > 0) {
        for (const photoFile of req.files["photos"]) {
            const url = await resolveUploadedFile(photoFile, "crm/travel", companyId);
            if (url) photoUrls.push(url);
        }
    }

    // Attachments
    const attachmentObjs = [];
    if (req.files && req.files["files"] && req.files["files"].length > 0) {
        for (const docFile of req.files["files"]) {
            const url = await resolveUploadedFile(docFile, "crm/travel-docs", companyId);
            if (url) {
                attachmentObjs.push({
                    name: docFile.originalname || path.basename(url),
                    url
                });
            }
        }
    }

    const travelEntry = {
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        visitorName: visitorName || req.user.name || "Field Executive",
        visitorId: req.user._id,
        purpose: purpose.trim(),
        location: location ? location.trim() : (customer.address?.city || ""),
        distanceKm: Number(distanceKm) || 0,
        travelMode,
        expense: Number(expense) || 0,
        minutesOfMeeting: minutesOfMeeting ? minutesOfMeeting.trim() : "",
        outcome,
        nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
        photos: photoUrls,
        attachments: attachmentObjs,
        createdBy: req.user._id,
        createdAt: new Date()
    };

    if (!customer.travelHistory) customer.travelHistory = [];
    customer.travelHistory.unshift(travelEntry);
    await customer.save();

    return res.status(201).json(
        new ApiResponse(201, {
            travelHistory: customer.travelHistory,
            addedTravel: travelEntry
        }, "Customer travel & visit log added successfully")
    );
});

/**
 * Get customer travel & visit logs
 */
export const getCustomerTravelLogs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Customer = req.getModel("Customer", customerSchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id })
        .select("name customerCode travelHistory");

    if (!customer) throw new ApiError(404, "Customer not found");

    return res.status(200).json(
        new ApiResponse(200, customer.travelHistory || [], "Travel history fetched successfully")
    );
});

/**
 * Delete a travel log
 */
export const deleteCustomerTravelLog = asyncHandler(async (req, res) => {
    const { id, travelId } = req.params;
    const Customer = req.getModel("Customer", customerSchema);

    const customer = await Customer.findOne({ _id: id, company: req.company._id });
    if (!customer) throw new ApiError(404, "Customer not found");

    customer.travelHistory = (customer.travelHistory || []).filter(
        (t) => t._id?.toString() !== travelId
    );
    await customer.save();

    return res.status(200).json(
        new ApiResponse(200, customer.travelHistory, "Travel log removed successfully")
    );
});
