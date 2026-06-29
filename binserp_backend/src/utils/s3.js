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

        const fileName = path.basename(localFilePath);
        const prefix = companyId ? `${companyId}-` : "";
        const key = `${folder}/${prefix}${Date.now()}-${fileName}`;

        const fileContent = fs.readFileSync(localFilePath);
        
        const putCommand = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: getContentType(fileName),
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
        const isPdf = key.toLowerCase().endsWith('.pdf');
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
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
        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: contentType
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error("Error generating signed PUT URL:", error);
        return null;
    }
};

/**
 * Deletes a file from S3
 * @param {string} keyOrUrl - S3 object key or full public URL
 * @returns {Promise<boolean>}
 */
const deleteFromS3 = async (keyOrUrl) => {
    try {
        if (!keyOrUrl) return false;

        let key = keyOrUrl;
        // If it's a URL, extract the key
        if (keyOrUrl.startsWith('http')) {
            const url = new URL(keyOrUrl);
            // Key is the pathname without the leading slash
            key = url.pathname.substring(1);
        }

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
        '.gif': 'image/gif',
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
        
        // If it's already a signed URL (has X-Amz-Signature), return as is or re-sign?
        // Usually, we should re-sign to ensure it hasn't expired.
        
        let key = photo;
        if (photo.startsWith('http')) {
            try {
                const url = new URL(photo);
                // Extract key from pathname
                key = url.pathname.substring(1);
            } catch (e) {
                return photo; // Not a valid URL, return as is
            }
        }
        
        return await getSignedUrlForGet(key, expiresIn);
    }));
    
    return signedPhotos.filter(Boolean);
};

export { uploadOnS3, getSignedUrlForGet, getSignedUrlForPut, deleteFromS3, signPhotos };
