import axios from "axios";
import { fetchS3ImageBase64, decodeS3Key } from "../../utils/s3.js";

/**
 * Controller to convert any image URL (S3 presigned or external) to a base64 Data URL.
 * Bypasses browser CORS restrictions safely.
 */
export const convertImageToBase64 = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "Valid image URL is required" });
    }

    // If it's already a Data URL, return directly
    if (url.startsWith("data:image")) {
      return res.status(200).json({ dataUrl: url });
    }

    // 1. Try directly from S3 if it's an S3 URL or S3 key
    const bucketName = process.env.S3_BUCKET_NAME;
    if ((bucketName && url.includes(bucketName)) || !url.startsWith("http")) {
      const s3Base64 = await fetchS3ImageBase64(url);
      if (s3Base64) {
        return res.status(200).json({ dataUrl: s3Base64 });
      }
    }

    // 2. Fetch via Axios (Node.js has no browser CORS restrictions)
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers["content-type"] || "image/jpeg";
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      return res.status(200).json({ dataUrl });
    } catch (httpErr) {
      // 3. If HTTP fetch failed, retry S3 direct fetch as fallback
      const s3Fallback = await fetchS3ImageBase64(url);
      if (s3Fallback) {
        return res.status(200).json({ dataUrl: s3Fallback });
      }

      console.warn("convertImageToBase64 failed to fetch URL:", url, httpErr.message);
      return res.status(200).json({ dataUrl: null, error: httpErr.message });
    }
  } catch (error) {
    console.error("Error in convertImageToBase64:", error);
    return res.status(500).json({ dataUrl: null, message: error.message });
  }
};
