import path from "path";
import fs from "fs";
import { uploadOnS3 } from "../../utils/s3.js";

const getCompanyLoginId = (req) => {
  return req.company?.companyId || req.user?.companyId || req.user?.company?.companyId || "general";
};

/**
 * Upload an attachment (photo or PDF) for a process routing step
 * POST /api/ppc/routing/upload-attachment
 */
export const uploadRoutingAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const file = req.file;
    const companyLoginId = getCompanyLoginId(req);
    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const isPdf = ext === ".pdf" || file.mimetype === "application/pdf";
    const fileType = isPdf ? "pdf" : "image";

    let fileUrl = "";

    try {
      const uploadResult = await uploadOnS3(file.path, "ppc/routing", companyLoginId);
      if (uploadResult && uploadResult.secure_url) {
        fileUrl = uploadResult.secure_url;
      }
    } catch (s3Err) {
      console.warn("S3 upload failed or not configured, using local path fallback:", s3Err.message);
    }

    // Fallback if S3 is not configured in local environment
    if (!fileUrl) {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "routing");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeFilename = `${Date.now()}-${path.basename(file.path)}`;
      const targetPath = path.join(uploadDir, safeFilename);

      if (fs.existsSync(file.path)) {
        fs.copyFileSync(file.path, targetPath);
        fs.unlinkSync(file.path);
      }
      fileUrl = `/uploads/routing/${safeFilename}`;
    }

    return res.status(200).json({
      success: true,
      message: "Attachment uploaded successfully",
      data: {
        url: fileUrl,
        secure_url: fileUrl,
        name: originalName,
        fileType,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Error in uploadRoutingAttachment:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to upload attachment" });
  }
};
