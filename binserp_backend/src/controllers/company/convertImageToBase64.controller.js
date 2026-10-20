import axios from "axios";
import { fetchS3ImageBase64 } from "../../utils/s3.js";

/**
 * Checks whether a hostname belongs to private, loopback, or cloud metadata address space (SSRF prevention).
 */
const isPrivateOrInternalHost = (hostname) => {
  if (!hostname) return true;
  const h = hostname.toLowerCase();

  // Localhost & loopback
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") {
    return true;
  }

  // Cloud metadata endpoint (AWS IMDS, GCP metadata, Azure instance metadata)
  if (h === "169.254.169.254" || h.startsWith("169.254.")) {
    return true;
  }

  // RFC 1918 Private IPv4 ranges
  // 10.0.0.0 - 10.255.255.255
  if (/^10\./.test(h)) return true;
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\./.test(h)) return true;

  // Internal / cluster local DNS domains
  if (h.endsWith(".internal") || h.endsWith(".local") || h.endsWith(".cluster") || h.endsWith(".corp")) {
    return true;
  }

  return false;
};

/**
 * Controller to convert image URLs (S3 presigned or external HTTPS) to base64 Data URLs.
 * Protected against SSRF and restricted to image MIME types.
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

    // 2. Validate external URL against SSRF
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: "Invalid URL format" });
    }

    // Strictly permit http and https protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ message: "Only HTTP and HTTPS protocols are allowed" });
    }

    // Block access to private/internal/cloud metadata addresses
    if (isPrivateOrInternalHost(parsedUrl.hostname)) {
      return res.status(403).json({ message: "Access to internal or private network addresses is forbidden" });
    }

    // 3. Fetch via Axios with strict timeout and image validation
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 8000,
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        headers: {
          "User-Agent": "Binserp-MediaService/1.0",
          Accept: "image/*",
        },
      });

      const contentType = (response.headers["content-type"] || "image/jpeg").toLowerCase();

      // Enforce image content-type to prevent SSRF data exfiltration of non-image endpoints
      if (!contentType.startsWith("image/") && contentType !== "application/octet-stream") {
        return res.status(400).json({ message: "Remote resource is not a valid image" });
      }

      const buffer = Buffer.from(response.data);
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      return res.status(200).json({ dataUrl });
    } catch (httpErr) {
      // 4. If HTTP fetch failed, retry S3 direct fetch as fallback
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
