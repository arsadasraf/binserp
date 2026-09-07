import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

const s3Client = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
});

/**
 * Uploads a file to S3
 * @param {string} localFilePath - Path to the local file
 * @param {string} folder - S3 folder path
 * @param {string} companyId - Optional company ID for prefixing
 * @returns {Promise<{secure_url: string, key: string} | null>}
 */
const uploadOnS3 = async (localFilePath, folder = "uploads", companyId = "") => {
    try {
        if (!localFilePath) return null;

        const rawFileName = path.basename(localFilePath);
        const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const prefix = companyId ? `${companyId}-` : "";
        const key = `${folder}/${prefix}${Date.now()}-${safeFileName}`;

        const fileContent = fs.readFileSync(localFilePath);
        
        const putCommand = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: getContentType(rawFileName),
        });

        await s3Client.send(putCommand);

        // Delete local file after upload
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        // Return the public URL, key, and a signed URL for immediate preview
        const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_BUCKET_REGION}.amazonaws.com/${key}`;
        const signedUrl = await getSignedUrlForGet(key, 604800); // 7 days expiration

        return {
            secure_url: signedUrl || publicUrl,
            url: signedUrl || publicUrl,
            public_url: publicUrl,
            key: key
        };

    } catch (error) {
        console.error("S3 upload failed:", error);
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
};

/**
 * Generates a signed URL for viewing a file
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default 1 hour)
 * @returns {Promise<string>}
 */
const getSignedUrlForGet = async (key, expiresIn = 3600) => {
    try {
        const decodedKey = decodeS3Key(key);
        const isPdf = decodedKey.toLowerCase().endsWith('.pdf');
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: decodedKey,
            ResponseContentDisposition: "inline",
            ResponseContentType: isPdf ? "application/pdf" : undefined,
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error("Error generating signed GET URL:", error);
        return null;
    }
};

/**
 * Generates a signed URL for uploading a file directly from frontend
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type of the file
 * @param {number} expiresIn - Expiration time in seconds (default 1 hour)
 * @returns {Promise<string>}
 */
const getSignedUrlForPut = async (key, contentType, expiresIn = 3600) => {
    try {
        const decodedKey = decodeS3Key(key);
        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: decodedKey,
            ContentType: contentType
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error("Error generating signed PUT URL:", error);
        return null;
    }
};

/**
 * Recursively decodes a key or URL pathname so it can be correctly matched in S3
 */
const decodeS3Key = (keyOrUrl) => {
    if (!keyOrUrl) return "";
    let key = keyOrUrl;
    if (key.startsWith('http')) {
        try {
            const url = new URL(key);
            key = url.pathname.substring(1);
        } catch (e) {
            return keyOrUrl;
        }
    }
    try {
        while (key.includes('%')) {
            const decoded = decodeURIComponent(key);
            if (decoded === key) break;
            key = decoded;
        }
    } catch (_) {}
    return key;
};

/**
 * Deletes a file from S3
 * @param {string} keyOrUrl - S3 object key or full public URL
 * @returns {Promise<boolean>}
 */
const deleteFromS3 = async (keyOrUrl) => {
    try {
        if (!keyOrUrl) return false;

        const key = decodeS3Key(keyOrUrl);

        const command = new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
        return true;
    } catch (error) {
        console.error("Error deleting from S3:", error);
        return false;
    }
};

/**
 * Helper to determine content type from filename
 */
const getContentType = (fileName) => {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Signs an array of S3 keys or URLs
 * @param {string[]} photos - Array of keys or URLs
 * @param {number} expiresIn - Expiration in seconds
 * @returns {Promise<string[]>}
 */
const signPhotos = async (photos, expiresIn = 604800) => {
    if (!photos || !Array.isArray(photos)) return [];
    
    const signedPhotos = await Promise.all(photos.map(async (photo) => {
        if (!photo) return null;
        const key = decodeS3Key(photo);
        return await getSignedUrlForGet(key, expiresIn);
    }));
    
    return signedPhotos.filter(Boolean);
};

/**
 * Fetches an object directly from S3 and returns a base64 Data URL
 */
const fetchS3ImageBase64 = async (keyOrUrl) => {
    try {
        const key = decodeS3Key(keyOrUrl);
        if (!key) return null;

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        });

        const s3Response = await s3Client.send(command);
        const byteArray = await s3Response.Body.transformToByteArray();
        const base64 = Buffer.from(byteArray).toString('base64');
        const contentType = s3Response.ContentType || getContentType(key);
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error("fetchS3ImageBase64 error:", error.message);
        return null;
    }
};

export { uploadOnS3, getSignedUrlForGet, getSignedUrlForPut, deleteFromS3, signPhotos, fetchS3ImageBase64, decodeS3Key };
