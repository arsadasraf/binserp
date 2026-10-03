import path from "path";
import fs from "fs";
import { leadSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { uploadOnS3 } from "../../utils/s3.js";

// Helper to persist file either to S3 or local public/uploads directory
const resolveUploadedFile = async (file, folder = "crm/followups", companyId = "") => {
    if (!file) return null;

    try {
        const s3Result = await uploadOnS3(file.path, folder, companyId);
        if (s3Result && s3Result.secure_url) {
            return s3Result.secure_url;
        }
    } catch (err) {
        console.warn("S3 upload failed for CRM follow-up, using local storage fallback:", err.message);
    }

    // Local fallback: move from temp to public/uploads/crm/followups
    const destDir = path.join(process.cwd(), "public", "uploads", "crm", "followups");
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
        return `/uploads/crm/followups/${uniqueName}`;
    } catch (e) {
        // Fallback to relative temp path
        const base = path.basename(file.path);
        return `/temp/${base}`;
    }
};

/**
 * Add a new follow-up interaction to a lead (voice, photos, files, text, schedule)
 */
export const addLeadFollowUp = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel("Lead", leadSchema);

    const lead = await Lead.findOne({ _id: id, company: req.company._id });
    if (!lead) throw new ApiError(404, "Lead not found");

    const {
        text,
        type = "Call",
        nextFollowUpDate,
        voiceDuration = 0,
        newStage,
        stageRemarks
    } = req.body;

    if (!text || !text.trim()) {
        throw new ApiError(400, "Follow-up text is required");
    }

    const companyId = req.company?._id?.toString() || "";

    // 1. Process Voice Note
    let voiceUrl = null;
    if (req.files && req.files["voice"] && req.files["voice"][0]) {
        voiceUrl = await resolveUploadedFile(req.files["voice"][0], "crm/voice", companyId);
    }

    // 2. Process Photos
    const photoUrls = [];
    if (req.files && req.files["photos"] && req.files["photos"].length > 0) {
        for (const photoFile of req.files["photos"]) {
            const url = await resolveUploadedFile(photoFile, "crm/photos", companyId);
            if (url) photoUrls.push(url);
        }
    }

    // 3. Process Document Attachments
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

    // 4. Handle Pipeline Stage Movement if requested
    let stageChange = undefined;
    if (newStage && newStage !== lead.status) {
        const fromStage = lead.status;
        stageChange = { fromStage, toStage: newStage };
        lead.status = newStage;
        lead.stageHistory.push({
            fromStage,
            toStage: newStage,
            changedBy: req.user._id,
            changedAt: new Date(),
            remarks: stageRemarks || `Stage updated during follow-up (${type})`
        });
    }

    // 5. Build New Follow-Up Object
    const newFollowUp = {
        type,
        text: text.trim(),
        voiceUrl,
        voiceDuration: voiceDuration ? Number(voiceDuration) : 0,
        photos: photoUrls,
        attachments: attachmentObjs,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        stageChange,
        createdBy: req.user._id,
        createdByName: req.user.name || "User",
        createdAt: new Date()
    };

    // Prepend to followUps (newest on top)
    lead.followUps.unshift(newFollowUp);

    // Update denormalized latestFollowUp for instant high-speed list & kanban previews
    lead.latestFollowUp = {
        type: newFollowUp.type,
        text: newFollowUp.text,
        voiceUrl: newFollowUp.voiceUrl,
        voiceDuration: newFollowUp.voiceDuration,
        hasVoice: Boolean(newFollowUp.voiceUrl),
        photos: newFollowUp.photos,
        photosCount: newFollowUp.photos.length,
        attachments: newFollowUp.attachments,
        attachmentsCount: newFollowUp.attachments.length,
        nextFollowUpDate: newFollowUp.nextFollowUpDate,
        createdBy: newFollowUp.createdBy,
        createdByName: newFollowUp.createdByName,
        createdAt: newFollowUp.createdAt
    };

    lead.updatedBy = req.user._id;
    lead.updatedByName = req.user.name || "User";

    await lead.save();

    const updated = await Lead.findById(lead._id)
        .populate("assignedTo", "name email")
        .populate("convertedToCustomer", "name email");

    return res.status(201).json(new ApiResponse(201, updated, "Follow-up note logged successfully"));
});

/**
 * Get all follow-ups for a specific lead
 */
export const getLeadFollowUps = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const Lead = req.getModel("Lead", leadSchema);

    const lead = await Lead.findOne({ _id: id, company: req.company._id })
        .select("name companyName status phone email followUps latestFollowUp");

    if (!lead) throw new ApiError(404, "Lead not found");

    return res.status(200).json(
        new ApiResponse(200, lead.followUps || [], "Lead follow-up history fetched successfully")
    );
});

/**
 * Delete a specific follow-up entry
 */
export const deleteLeadFollowUp = asyncHandler(async (req, res) => {
    const { id, followUpId } = req.params;
    const Lead = req.getModel("Lead", leadSchema);

    const lead = await Lead.findOne({ _id: id, company: req.company._id });
    if (!lead) throw new ApiError(404, "Lead not found");

    lead.followUps = lead.followUps.filter((f) => f._id.toString() !== followUpId);

    // Recalculate latestFollowUp
    if (lead.followUps.length > 0) {
        const top = lead.followUps[0];
        lead.latestFollowUp = {
            type: top.type,
            text: top.text,
            voiceUrl: top.voiceUrl,
            voiceDuration: top.voiceDuration,
            hasVoice: Boolean(top.voiceUrl),
            photos: top.photos,
            photosCount: top.photos?.length || 0,
            attachments: top.attachments,
            attachmentsCount: top.attachments?.length || 0,
            nextFollowUpDate: top.nextFollowUpDate,
            createdBy: top.createdBy,
            createdByName: top.createdByName,
            createdAt: top.createdAt
        };
    } else {
        lead.latestFollowUp = undefined;
    }

    await lead.save();

    const updated = await Lead.findById(lead._id)
        .populate("assignedTo", "name email")
        .populate("convertedToCustomer", "name email");

    return res.status(200).json(new ApiResponse(200, updated, "Follow-up entry removed successfully"));
});
