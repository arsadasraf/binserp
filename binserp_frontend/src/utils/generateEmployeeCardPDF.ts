import jsPDF from "jspdf";
import QRCode from "qrcode";
import axios from "axios";
import { Employee } from "@/app/dashboard/hr/types/hr.types";
import { getApiBaseUrl } from "./config";

export interface CompanyCardDetails {
  companyName: string;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
}

/**
 * Detects appropriate jsPDF image format from a Data URL
 */
const getImageFormat = (dataUrl: string): "PNG" | "JPEG" | "WEBP" => {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
};

/**
 * Loads an image from a URL or Base64 and returns a base64 Data URL.
 * First calls the backend service to bypass browser CORS / tainted canvas,
 * then tries Next.js route handler, and falls back to offscreen Image element & canvas.
 */
const loadImageDataUrl = async (src?: string | null): Promise<string | null> => {
  if (!src) return null;
  if (src.startsWith("data:image")) return src;

  // 1. First attempt: Call Express backend image-to-base64 endpoint
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await axios.post(
      `${getApiBaseUrl()}/api/company/image-to-base64`,
      { url: src },
      { headers, timeout: 10000 }
    );
    if (res.data?.dataUrl) {
      return res.data.dataUrl;
    }
  } catch (err: any) {
    console.warn("Backend image-to-base64 conversion failed, trying local proxy:", err.message);
  }

  // 2. Second attempt: Call Next.js local route handler
  try {
    const res = await fetch("/api/image-to-base64", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: src }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.dataUrl) return data.dataUrl;
    }
  } catch (err: any) {
    console.warn("Local image-to-base64 conversion failed:", err.message);
  }

  // 3. Third attempt: Browser Image element & Canvas
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Could not convert image to Data URL (CORS or canvas error):", err);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn("Failed to load image for card:", src);
      resolve(null);
    };
    img.src = src;
  });
};

/**
 * Generates a standard CR80 (54mm x 86mm) Employee ID Card PDF with Page 1 (Front) & Page 2 (Back).
 */
export async function generateEmployeeCardPDF(
  employee: Employee,
  companyInfo: CompanyCardDetails
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [54, 86],
  });

  const cardW = 54;
  const cardH = 86;

  // Resolve Images
  const [logoData, photoData] = await Promise.all([
    loadImageDataUrl(companyInfo.logo),
    loadImageDataUrl(employee.photo),
  ]);

  // Generate QR Code data URL
  const qrPayload = JSON.stringify({
    id: employee.employeeId,
    name: employee.name,
    dept: employee.department || "General",
    company: companyInfo.companyName,
    blood: employee.bloodGroup || "N/A",
  });

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 0,
      width: 160,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });
  } catch (err) {
    console.warn("QR code generation failed:", err);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PAGE 1: FRONT SIDE
  // ══════════════════════════════════════════════════════════════════════════

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, cardW, cardH, "F");

  // Top Header Banner (Indigo / Deep Blue Brand Gradient appearance)
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, cardW, 16, "F");

  // Subtle Accent Stripe
  doc.setFillColor(59, 130, 246); // Blue 500
  doc.rect(0, 16, cardW, 1.2, "F");

  // Company Logo & Name on Front Header
  if (logoData) {
    try {
      doc.addImage(logoData, getImageFormat(logoData), 3, 2.5, 11, 11, undefined, "FAST");
    } catch (err) {
      console.warn("Could not embed company logo into PDF:", err);
    }
  }

  const compNameX = logoData ? 16 : 3;
  const compNameMaxW = logoData ? 35 : 48;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(companyInfo.companyName || "COMPANY NAME", compNameX, 7.5, {
    maxWidth: compNameMaxW,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  doc.setTextColor(219, 234, 254);
  doc.text("EMPLOYEE IDENTITY CARD", compNameX, 11.5);

  // Employee Photo Frame (Center: X = (54 - 22) / 2 = 16)
  const photoSize = 22;
  const photoX = (cardW - photoSize) / 2;
  const photoY = 20;

  // Photo background / border
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.setLineWidth(0.4);
  doc.roundedRect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1, 2, 2, "FD");

  if (photoData) {
    try {
      doc.addImage(photoData, getImageFormat(photoData), photoX, photoY, photoSize, photoSize, undefined, "FAST");
    } catch (err) {
      console.warn("Could not embed employee photo into PDF:", err);
      drawPhotoPlaceholder(doc, employee.name, photoX, photoY, photoSize);
    }
  } else {
    drawPhotoPlaceholder(doc, employee.name, photoX, photoY, photoSize);
  }

  // Employee Name
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(employee.name || "Employee Name", cardW / 2, 46, { align: "center", maxWidth: 48 });

  // Designation
  doc.setTextColor(37, 99, 235); // Blue 600
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(employee.designation || "Designation", cardW / 2, 50, { align: "center", maxWidth: 48 });

  // Department
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(employee.department || "Department", cardW / 2, 53.5, { align: "center", maxWidth: 48 });

  // Employee ID Badge Pill
  const pillW = 28;
  const pillH = 4.5;
  const pillX = (cardW - pillW) / 2;
  const pillY = 56;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, "FD");

  doc.setTextColor(30, 58, 138);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(`ID: ${employee.employeeId || "N/A"}`, cardW / 2, pillY + 3.2, { align: "center" });

  // Quick Info Bar (Joining Date & Blood Group)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(71, 85, 105);

  const formattedDate = employee.joiningDate
    ? new Date(employee.joiningDate).toLocaleDateString("en-GB")
    : "-";
  doc.text(`DOJ: ${formattedDate}`, 6, 64);

  if (employee.bloodGroup) {
    doc.setTextColor(220, 38, 38); // Red for blood group
    doc.setFont("helvetica", "bold");
    doc.text(`Blood: ${employee.bloodGroup}`, cardW - 6, 64, { align: "right" });
  }

  // QR Code (Bottom Center)
  if (qrDataUrl) {
    const qrSize = 13;
    const qrX = (cardW - qrSize) / 2;
    const qrY = 67;
    try {
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
    } catch {
      // Ignore if QR fails
    }
  }

  // Bottom Accent Strip
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 83.5, cardW, 2.5, "F");

  // ══════════════════════════════════════════════════════════════════════════
  // ── PAGE 2: BACK SIDE
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage([54, 86], "portrait");

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, cardW, cardH, "F");

  // Top Back Header
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, cardW, 9, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("COMPANY INFORMATION", cardW / 2, 6, { align: "center" });

  // Company Name & Address Section
  let curY = 13;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(companyInfo.companyName || "Company Name", 4, curY, { maxWidth: 46 });

  curY += 4;
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);

  const fullAddress = [
    companyInfo.address,
    companyInfo.city,
    companyInfo.state,
    companyInfo.pincode ? `PIN: ${companyInfo.pincode}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  if (fullAddress) {
    const splitAddr = doc.splitTextToSize(fullAddress, 46);
    doc.text(splitAddr, 4, curY);
    curY += splitAddr.length * 2.6;
  }

  if (companyInfo.phone) {
    doc.text(`Phone: ${companyInfo.phone}`, 4, curY);
    curY += 2.8;
  }
  if (companyInfo.email) {
    doc.text(`Email: ${companyInfo.email}`, 4, curY);
    curY += 2.8;
  }

  // Divider line
  curY = Math.max(curY + 1, 29);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(4, curY, cardW - 4, curY);

  curY += 3;

  // Emergency Details Box
  doc.setFillColor(254, 242, 242); // Red 50
  doc.setDrawColor(254, 202, 202); // Red 200
  doc.roundedRect(4, curY, cardW - 8, 8.5, 1.5, 1.5, "FD");

  doc.setTextColor(185, 28, 28); // Red 700
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.text("EMERGENCY DETAILS:", 6, curY + 3.2);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  const contactText = employee.contact ? `Contact: ${employee.contact}` : "Contact: N/A";
  const bloodText = employee.bloodGroup ? `Blood Group: ${employee.bloodGroup}` : "";
  doc.text(`${contactText}   ${bloodText}`, 6, curY + 6.2);

  curY += 12;

  // Terms & Conditions / Declaration
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(4, curY, cardW - 8, 22, 1.5, 1.5, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.text("INSTRUCTIONS & TERMS:", 6, curY + 3.5);

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4);
  const terms = [
    "1. This card is valid only during employment with the company.",
    "2. The holder must wear/display this badge on office/factory premises.",
    "3. In case of loss or damage, report immediately to HR.",
    "4. This card is non-transferable and remains property of the company.",
    "5. If found, kindly return to the company address mentioned above.",
  ];

  let termY = curY + 6.5;
  terms.forEach((t) => {
    doc.text(t, 6, termY, { maxWidth: 42 });
    termY += 2.8;
  });

  // Authorized Signatory Section
  const sigY = 75;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(cardW - 24, sigY, cardW - 4, sigY);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.5);
  doc.text("Authorized Signatory", cardW - 14, sigY + 3, { align: "center" });

  // Bottom Accent Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 83.5, cardW, 2.5, "F");

  // Trigger browser download
  const cleanId = (employee.employeeId || "EMP").replace(/[^a-zA-Z0-9-_]/g, "");
  const cleanName = (employee.name || "Employee").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9-_]/g, "");
  doc.save(`ID_Card_${cleanId}_${cleanName}.pdf`);
}

/**
 * Helper to draw a fallback avatar with the employee's initial.
 */
function drawPhotoPlaceholder(
  doc: jsPDF,
  name: string,
  x: number,
  y: number,
  size: number
) {
  doc.setFillColor(224, 231, 255); // Indigo 100
  doc.rect(x, y, size, size, "F");

  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const initial = name ? name.charAt(0).toUpperCase() : "E";
  doc.text(initial, x + size / 2, y + size / 2 + 5, { align: "center" });
}
