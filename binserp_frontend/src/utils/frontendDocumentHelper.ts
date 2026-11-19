import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { generateFrontendDcPDF, generateFrontendInvoicePDF } from "./frontendPdfHelper";
import { getCurrencySymbol, convertAmountToWords } from "./currencyHelper";
import { API_BASE_URL } from "./config";

interface LoadedPdfLogo {
  dataUrl: string;
  format: "PNG" | "JPEG" | "WEBP";
  widthMm: number;
  heightMm: number;
}

const loadPdfLogoInfo = async (logoUrl?: string | null): Promise<LoadedPdfLogo | null> => {
  if (!logoUrl || typeof window === "undefined") return null;

  let dataUrl: string | null = null;
  if (logoUrl.startsWith("data:image")) {
    dataUrl = logoUrl;
  } else {
    // 1. Express backend proxy (bypasses S3/external CORS cleanly)
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/company/image-to-base64`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: logoUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.dataUrl) dataUrl = data.dataUrl;
      }
    } catch {
      // fall through
    }

    // 2. Next.js local route fallback
    if (!dataUrl) {
      try {
        const res = await fetch("/api/image-to-base64", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: logoUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.dataUrl) dataUrl = data.dataUrl;
        }
      } catch {
        // fall through
      }
    }
  }

  if (!dataUrl) return null;

  // Measure natural dimensions to preserve aspect ratio inside max 26mm x 16mm box
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 26;
      const maxH = 16;
      const natW = img.naturalWidth || maxW;
      const natH = img.naturalHeight || maxH;
      const ratio = Math.min(maxW / natW, maxH / natH);
      const widthMm = Math.max(8, Number((natW * ratio).toFixed(2)));
      const heightMm = Math.max(8, Number((natH * ratio).toFixed(2)));
      const format: "PNG" | "JPEG" | "WEBP" = dataUrl!.includes("image/jpeg") || dataUrl!.includes("image/jpg")
        ? "JPEG"
        : dataUrl!.includes("image/webp")
        ? "WEBP"
        : "PNG";
      resolve({ dataUrl: dataUrl!, format, widthMm, heightMm });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl!;
  });
};

const formatDateTime = (dateStr?: string | Date) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export interface DocumentOptions {
  doc: any;
  companyInfo?: any;
  copyType?: "all" | "original" | "duplicate" | "triplicate";
}

export const downloadDirectDcPDF = async ({ doc, companyInfo, copyType = "all" }: DocumentOptions) => {
  try {
    if (!doc) {
      alert("No Delivery Challan data provided for PDF generation");
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const marginX = 12;
    const contentW = pageW - marginX * 2; // 186mm

    let copies = [
      "ORIGINAL FOR RECIPIENT",
      "DUPLICATE FOR TRANSPORTER",
      "TRIPLICATE FOR SUPPLIER"
    ];
    if (copyType === "original") copies = ["ORIGINAL FOR RECIPIENT"];
    else if (copyType === "duplicate") copies = ["DUPLICATE FOR TRANSPORTER"];
    else if (copyType === "triplicate") copies = ["TRIPLICATE FOR SUPPLIER"];

    // 1. Resolve Company Master Details (same order as DCPreviewModal)
    let masterCompany = companyInfo;
    if (!masterCompany || !masterCompany.companyName) {
      try {
        const storeCached = localStorage.getItem("storeCompanyInfo");
        const storedCompany = localStorage.getItem("companyInfo");
        const storedUser = localStorage.getItem("userInfo");
        if (storeCached) masterCompany = { ...JSON.parse(storeCached), ...companyInfo };
        else if (storedCompany) masterCompany = { ...JSON.parse(storedCompany), ...companyInfo };
        else if (storedUser) masterCompany = { ...JSON.parse(storedUser), ...companyInfo };
      } catch (e) {
        console.warn("Could not parse cached company info:", e);
      }
    }

    const compName = masterCompany?.companyName || masterCompany?.name || "BINSERP ENTERPRISE";
    const compAddressRaw = masterCompany?.billingAddress || masterCompany?.address || masterCompany?.location || "";
    const compCityState = [masterCompany?.city, masterCompany?.state, masterCompany?.pincode ? `- ${masterCompany.pincode}` : ""].filter(Boolean).join(" ");
    const compAddress = [compAddressRaw, compCityState].filter(Boolean).join(", ");
    const compGst = masterCompany?.gstin || masterCompany?.gstNumber || masterCompany?.gst || "N/A";
    const compPan = masterCompany?.panNumber || masterCompany?.pan || "N/A";
    const compPhone = masterCompany?.contactNumber || masterCompany?.phone || "";
    const compEmail = masterCompany?.email || "";

    // 2. Bank Details (prefer DC-specific override, fallback to master)
    const dcBank = doc.bankDetails || {};
    const masterBank = masterCompany?.bankDetails || {};
    const bankName = dcBank.bankName || masterBank.bankName || masterCompany?.bankName || "-";
    const accountName = dcBank.accountName || masterBank.accountName || compName;
    const accountNumber = dcBank.accountNumber || masterBank.accountNumber || masterCompany?.accountNumber || "-";
    const ifscCode = dcBank.ifscCode || masterBank.ifscCode || masterCompany?.ifscCode || "-";
    const branch = dcBank.branch || dcBank.branchName || masterBank.branch || masterBank.branchName || masterCompany?.branchName || "-";

    // 3. Terms & Conditions (prefer DC-specific override, fallback to master)
    const DEFAULT_DC_TERMS =
      "1. Material delivered against this Delivery Challan is subject to terms agreed in the purchase contract.\n" +
      "2. Goods must be verified and acknowledged upon receipt by an authorized receiver.\n" +
      "3. Any discrepancy or damage must be notified within 24 hours of delivery.\n" +
      "4. Subject to local jurisdiction only.";
    const termsAndConditions =
      doc.termsAndConditions ||
      masterCompany?.printSettings?.dc?.termsAndConditions ||
      masterCompany?.commercialTerms ||
      DEFAULT_DC_TERMS;

    // 4. Customer Details
    const custObj = typeof doc.customer === "object" && doc.customer !== null ? doc.customer : {};
    const custName = doc.customerName || custObj?.name || custObj?.companyName || "Internal / Cash Customer";
    const custAddressRaw = doc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || "-";
    const custCityState = [custObj?.city, custObj?.state, custObj?.pincode].filter(Boolean).join(" ");
    const custAddress = custAddressRaw !== "-" && custCityState && !custAddressRaw.includes(custObj?.city || "___")
      ? `${custAddressRaw}, ${custCityState}`
      : custAddressRaw;
    const custGst = doc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "-";
    const custPhone = doc.customerPhone || custObj?.phone || custObj?.contactNumber || custObj?.mobile || "-";
    const custEmail = doc.customerEmail || custObj?.email || "-";
    const custPoRef = doc.customerPoReference || doc.poNumber || "-";

    // 5. Logistics & Financials
    const docNum = doc.dcNumber || "DC-001";
    const creationDateTimeStr = formatDateTime(doc.createdAt || doc.date);
    const vehicleNo = (doc.vehicleNumber || doc.vehicleNo || "-").toUpperCase();
    const transportMode = doc.transportationType || doc.transportType || "Road Transport";
    const packagingType = doc.packagingType || "Standard Packaging";
    const eWayNo = doc.eWayBillNo || doc.eWayNo || "";
    const currCode = doc.currency || "INR";

    const items = Array.isArray(doc.items) ? doc.items : [];
    const subtotal = doc.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(doc.transportationCharges || doc.freightCharges || 0);
    const packagingCharges = Number(doc.packagingCharges || 0);
    const discount = Number(doc.discount || 0);
    const rawExactTotal = parseFloat((subtotal + transportCharges + packagingCharges - discount).toFixed(2));
    const isRoundOffEnabled = doc.isRoundOff !== undefined ? Boolean(doc.isRoundOff) : true;
    const roundOff = doc.roundOff !== undefined ? Number(doc.roundOff) : (isRoundOffEnabled ? parseFloat((Math.round(rawExactTotal) - rawExactTotal).toFixed(2)) : 0);
    const grandTotal = doc.totalAmount || (isRoundOffEnabled ? Math.round(rawExactTotal) : rawExactTotal);

    // Prepare line items with Name + Description together in Column 2 (Rule 1)
    const itemMetaList = items.map((item: any) => {
      const refObj = item.fgItem || item.rawMaterial || item.boughtOut || item.consumableItem || item.material;
      const itemName = item.materialName || item.productName || item.name || (typeof refObj === "object" ? refObj?.name : "") || "Item";
      const itemDesc = item.description || item.descriptions || (typeof refObj === "object" ? (refObj?.description || refObj?.descriptions || "") : "");
      return { itemName, itemDesc };
    });

    const tableRows = items.map((item: any, idx: number) => {
      const { itemName, itemDesc } = itemMetaList[idx];
      const qty = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const lineAmt = Number(item.amount || (qty * rate));
      const unit = (item.unit || item.uom || "PCS").toUpperCase();
      const combinedCell = itemDesc ? `${itemName}\n${itemDesc}` : itemName;

      return [
        String(idx + 1),
        combinedCell,
        item.hsnCode || item.hsn || "-",
        `${qty} ${unit}`,
        rate.toFixed(2),
        lineAmt.toFixed(2)
      ];
    });

    // Sales Tax Invoice Indigo Palette
    const INDIGO_DARK: [number, number, number] = [55, 48, 163];   // #3730a3
    const INDIGO_MAIN: [number, number, number] = [79, 70, 229];   // #4f46e5
    const INDIGO_SOFT: [number, number, number] = [238, 242, 255]; // #eef2ff
    const INDIGO_BDR: [number, number, number] = [199, 210, 254];  // #c7d2fe
    const SLATE_BDR: [number, number, number] = [148, 163, 184];   // #94a3b8
    const SLATE_BG: [number, number, number] = [248, 250, 252];    // #f8fafc
    const SLATE_DARK: [number, number, number] = [15, 23, 42];     // #0f172a
    const SLATE_MID: [number, number, number] = [71, 85, 105];     // #475569

    const compLogoUrl = masterCompany?.logo || "";
    const loadedLogo = compLogoUrl ? await loadPdfLogoInfo(compLogoUrl) : null;

    copies.forEach((copyTitle, pageIndex) => {
      if (pageIndex > 0) pdf.addPage();

      let curY = 12;
      const headerTopY = curY;

      // 1. Company Header (Left: Optional Logo + Company Info) & Solid Indigo Copy Badge (Right) — Matches Sales Tax Invoice
      pdf.setFillColor(...INDIGO_DARK);
      const badgeW = 58;
      pdf.roundedRect(pageW - marginX - badgeW, curY, badgeW, 6.5, 1.2, 1.2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text(copyTitle, pageW - marginX - badgeW / 2, curY + 4.3, { align: "center" });

      let textStartX = marginX;
      let maxCompTextW = 122;
      if (loadedLogo) {
        try {
          pdf.addImage(loadedLogo.dataUrl, loadedLogo.format, marginX, headerTopY, loadedLogo.widthMm, loadedLogo.heightMm);
          textStartX = marginX + loadedLogo.widthMm + 3.5;
          maxCompTextW = 122 - loadedLogo.widthMm - 3.5;
        } catch (logoErr) {
          console.warn("Could not embed company logo in DC PDF:", logoErr);
        }
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(...INDIGO_DARK);
      pdf.text(compName.toUpperCase(), textStartX, curY + 4.5);
      curY += 8.5;

      if (compAddress) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...SLATE_MID);
        const addrLines = pdf.splitTextToSize(compAddress, maxCompTextW);
        pdf.text(addrLines, textStartX, curY);
        curY += addrLines.length * 3.4;
      }

      const contactLine = [compPhone ? `Ph: ${compPhone}` : "", compEmail ? `Email: ${compEmail}` : ""].filter(Boolean).join(" | ");
      if (contactLine) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...SLATE_MID);
        pdf.text(contactLine, textStartX, curY + 0.5);
        curY += 3.8;
      }

      const taxLineParts = [`GSTIN: ${compGst}`];
      if (compPan !== "N/A") taxLineParts.push(`PAN: ${compPan}`);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...SLATE_DARK);
      pdf.text(taxLineParts.join("  |  "), textStartX, curY + 0.5);
      curY += 3.5;

      if (loadedLogo) {
        curY = Math.max(curY, headerTopY + loadedLogo.heightMm + 2.5);
      }

      // 2px Indigo Accent Bottom Border
      pdf.setDrawColor(...INDIGO_MAIN);
      pdf.setLineWidth(0.7);
      pdf.line(marginX, curY, pageW - marginX, curY);
      curY += 3;

      // 2. Soft Indigo Title Banner — DELIVERY CHALLAN
      pdf.setFillColor(...INDIGO_SOFT);
      pdf.setDrawColor(...INDIGO_BDR);
      pdf.setLineWidth(0.35);
      pdf.rect(marginX, curY, contentW, 7.5, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...INDIGO_DARK);
      pdf.text("DELIVERY CHALLAN", pageW / 2, curY + 5.2, { align: "center" });
      curY += 10.5;

      // 3. Buyer & Logistics 2-Column Grid (52% Left #f8fafc | 48% Right White)
      const metaTopY = curY;
      const leftColW = contentW * 0.52;
      const midX = marginX + leftColW;
      const leftTextW = leftColW - 6;

      // Pre-measure heights
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      const custNameLines = pdf.splitTextToSize(custName, leftTextW);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const custAddrLines = custAddress && custAddress !== "-" ? pdf.splitTextToSize(`Address: ${custAddress}`, leftTextW) : [];
      const leftExtraLines =
        (custPhone && custPhone !== "-" ? 1 : 0) +
        (custEmail && custEmail !== "-" ? 1 : 0) +
        (custGst && custGst !== "-" && custGst !== "N/A" ? 1 : 0) +
        (custPoRef && custPoRef !== "-" ? 1 : 0);
      const leftNeededH = 9 + custNameLines.length * 4 + custAddrLines.length * 3.5 + leftExtraLines * 4 + 4;
      const rightRowCount = 5 + (eWayNo ? 1 : 0);
      const rightNeededH = 6 + rightRowCount * 4.5 + 3;
      const metaBoxH = Math.max(leftNeededH, rightNeededH, 28);

      // Draw boxes
      pdf.setFillColor(...SLATE_BG);
      pdf.rect(marginX, metaTopY, leftColW, metaBoxH, "F");
      pdf.setDrawColor(...SLATE_BDR);
      pdf.setLineWidth(0.3);
      pdf.rect(marginX, metaTopY, contentW, metaBoxH);
      pdf.line(midX, metaTopY, midX, metaTopY + metaBoxH);

      // Left Panel Text
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...INDIGO_MAIN);
      pdf.text("CONSIGNEE / BUYER DETAILS", marginX + 3, metaTopY + 4.5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...SLATE_DARK);
      pdf.text(custNameLines, marginX + 3, metaTopY + 9);
      let leftY = metaTopY + 9 + custNameLines.length * 4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...SLATE_MID);
      if (custAddrLines.length > 0) {
        pdf.text(custAddrLines, marginX + 3, leftY);
        leftY += custAddrLines.length * 3.5 + 0.5;
      }
      if (custPhone && custPhone !== "-") {
        pdf.text(`Contact: ${custPhone}`, marginX + 3, leftY);
        leftY += 3.8;
      }
      if (custEmail && custEmail !== "-") {
        pdf.text(`Email: ${custEmail}`, marginX + 3, leftY);
        leftY += 3.8;
      }
      if (custGst && custGst !== "-" && custGst !== "N/A") {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...SLATE_DARK);
        pdf.text(`GSTIN: ${custGst}`, marginX + 3, leftY + 0.5);
        leftY += 4;
      }
      if (custPoRef && custPoRef !== "-") {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...INDIGO_DARK);
        pdf.text(`PO Ref: ${custPoRef}`, marginX + 3, leftY + 0.5);
      }

      // Right Panel Logistics Metadata
      let rightY = metaTopY + 5;
      const drawMetaRow = (label: string, val: string, isHighlight = false) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, midX + 3, rightY);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...(isHighlight ? INDIGO_DARK : SLATE_DARK));
        pdf.text(val, pageW - marginX - 3, rightY, { align: "right" });
        rightY += 4.5;
      };
      drawMetaRow("Challan Number:", docNum, true);
      drawMetaRow("Creation Date & Time:", creationDateTimeStr);
      drawMetaRow("Transport Mode:", transportMode);
      drawMetaRow("Vehicle Number:", vehicleNo);
      drawMetaRow("Packaging Type:", packagingType);
      if (eWayNo) drawMetaRow("E-Way Bill No:", eWayNo, true);

      curY = metaTopY + metaBoxH + 3.5;

      // 4. Itemized Table (Matches Sales Tax Invoice Indigo Header & Columns)
      autoTable(pdf, {
        startY: curY,
        head: [["S.No", "Item Name & Description", "HSN", "Qty", `Unit Rate (${currCode})`, `Total Amount (${currCode})`]],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: INDIGO_SOFT,
          textColor: INDIGO_DARK,
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          lineColor: SLATE_BDR,
          lineWidth: 0.3
        },
        bodyStyles: {
          fontSize: 8,
          textColor: SLATE_DARK,
          lineColor: SLATE_BDR,
          lineWidth: 0.25,
          cellPadding: 2.3,
          valign: "top"
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 11 },
          1: { halign: "left", cellWidth: 83 },
          2: { halign: "center", cellWidth: 22 },
          3: { halign: "center", cellWidth: 22, fontStyle: "bold", textColor: INDIGO_DARK },
          4: { halign: "right", cellWidth: 23 },
          5: { halign: "right", cellWidth: 25, fontStyle: "bold" }
        },
        margin: { left: marginX, right: marginX },
        didParseCell: (hookData) => {
          if (hookData.section === "body" && hookData.column.index === 1) {
            hookData.cell.styles.textColor = [255, 255, 255];
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section === "body" && hookData.column.index === 1) {
            const meta = itemMetaList[hookData.row.index];
            if (!meta) return;
            const cellX = hookData.cell.x + 2.3;
            const maxTextW = hookData.cell.width - 4.6;
            let textY = hookData.cell.y + 4.4;

            // Bold Item Name
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.2);
            pdf.setTextColor(...SLATE_DARK);
            const nameLines = pdf.splitTextToSize(meta.itemName, maxTextW);
            pdf.text(nameLines, cellX, textY);
            textY += nameLines.length * 3.5;

            // Italic Technical Description directly below
            if (meta.itemDesc) {
              pdf.setFont("helvetica", "italic");
              pdf.setFontSize(7.3);
              pdf.setTextColor(...SLATE_MID);
              const descLines = pdf.splitTextToSize(meta.itemDesc, maxTextW);
              pdf.text(descLines, cellX, textY + 0.5);
            }
          }
        }
      });

      curY = ((pdf as any).lastAutoTable?.finalY || curY + 50) + 3.5;

      if (curY > 224) {
        pdf.addPage();
        curY = 14;
      }

      // 5. Bottom 2-Column Summary Grid (55% Left Bank & Terms + Words | 45% Right Financial Totals)
      const bottomTopY = curY;
      const sumLeftW = contentW * 0.55;
      const sumMidX = marginX + sumLeftW;
      const sumLeftTextW = sumLeftW - 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      const bankLineStr = `Bank: ${bankName} | A/c: ${accountNumber} | IFSC: ${ifscCode}${branch && branch !== "-" ? ` | Branch: ${branch}` : ""}`;
      const bankWrapped = pdf.splitTextToSize(bankLineStr, sumLeftTextW);
      const remarkWrapped = (doc.remarks || doc.otherDetails) ? pdf.splitTextToSize(`Remarks: ${doc.remarks || doc.otherDetails}`, sumLeftTextW) : [];
      pdf.setFontSize(7);
      const termsWrapped = pdf.splitTextToSize(termsAndConditions, sumLeftTextW);
      pdf.setFont("helvetica", "bolditalic");
      pdf.setFontSize(8);
      const wordsWrapped = pdf.splitTextToSize(`Amount in Words: ${convertAmountToWords(grandTotal, doc.currency)}`, sumLeftTextW);

      const leftSumH =
        7 +
        bankWrapped.length * 3.5 +
        (remarkWrapped.length > 0 ? remarkWrapped.length * 3.4 + 1 : 0) +
        4.5 +
        termsWrapped.length * 3.1 +
        3.5 +
        wordsWrapped.length * 3.6 +
        4;

      const rightLineCount =
        1 +
        (transportCharges > 0 ? 1 : 0) +
        (packagingCharges > 0 ? 1 : 0) +
        (discount > 0 ? 1 : 0) +
        (isRoundOffEnabled && Math.abs(roundOff) > 0.001 ? 1 : 0);
      const rightSumH = 5 + rightLineCount * 4.5 + 12;
      const bottomBoxH = Math.max(leftSumH, rightSumH, 38);

      // Draw Summary Box
      pdf.setFillColor(250, 250, 250);
      pdf.rect(marginX, bottomTopY, sumLeftW, bottomBoxH, "F");
      pdf.setDrawColor(...SLATE_BDR);
      pdf.setLineWidth(0.3);
      pdf.rect(marginX, bottomTopY, contentW, bottomBoxH);
      pdf.line(sumMidX, bottomTopY, sumMidX, bottomTopY + bottomBoxH);

      // Left Content
      let bLeftY = bottomTopY + 4.5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...INDIGO_DARK);
      pdf.text("BANK DETAILS & REMARKS", marginX + 3, bLeftY);
      bLeftY += 4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...SLATE_DARK);
      pdf.text(bankWrapped, marginX + 3, bLeftY);
      bLeftY += bankWrapped.length * 3.5 + 0.5;

      if (remarkWrapped.length > 0) {
        pdf.setTextColor(...SLATE_MID);
        pdf.text(remarkWrapped, marginX + 3, bLeftY);
        bLeftY += remarkWrapped.length * 3.4 + 0.5;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...SLATE_MID);
      pdf.text("Terms & Conditions:", marginX + 3, bLeftY + 1);
      bLeftY += 4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);
      pdf.text(termsWrapped, marginX + 3, bLeftY);
      bLeftY += termsWrapped.length * 3.1 + 2;

      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.2);
      pdf.line(marginX + 3, bLeftY - 1, sumMidX - 3, bLeftY - 1);

      pdf.setFont("helvetica", "bolditalic");
      pdf.setFontSize(7.8);
      pdf.setTextColor(...SLATE_DARK);
      pdf.text(wordsWrapped, marginX + 3, bLeftY + 2.5);

      // Right Content: Financial Totals + Indigo Highlighted GRAND TOTAL
      let rY = bottomTopY + 5.5;
      const drawTotalLine = (label: string, valStr: string, isGreen = false) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...(isGreen ? [6, 95, 70] as [number, number, number] : SLATE_MID));
        pdf.text(label, sumMidX + 3, rY);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...(isGreen ? [6, 95, 70] as [number, number, number] : SLATE_DARK));
        pdf.text(valStr, pageW - marginX - 3, rY, { align: "right" });
        rY += 4.5;
      };

      drawTotalLine("Subtotal:", subtotal.toFixed(2));
      if (transportCharges > 0) drawTotalLine("Freight / Transport:", `+ ${transportCharges.toFixed(2)}`);
      if (packagingCharges > 0) drawTotalLine("Packaging Charges:", `+ ${packagingCharges.toFixed(2)}`);
      if (discount > 0) drawTotalLine("Discount:", `- ${discount.toFixed(2)}`, true);
      if (isRoundOffEnabled && Math.abs(roundOff) > 0.001) {
        drawTotalLine("Round Off:", `${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}`);
      }

      // Indigo Grand Total Box docked at bottom of right panel
      const gtBoxY = bottomTopY + bottomBoxH - 10;
      pdf.setFillColor(...INDIGO_SOFT);
      pdf.setDrawColor(...INDIGO_BDR);
      pdf.setLineWidth(0.35);
      pdf.rect(sumMidX + 2.5, gtBoxY, contentW - sumLeftW - 5, 7.5, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.8);
      pdf.setTextColor(...INDIGO_DARK);
      pdf.text(`GRAND TOTAL (${currCode}):`, sumMidX + 4.5, gtBoxY + 5);
      pdf.text(grandTotal.toFixed(2), pageW - marginX - 4.5, gtBoxY + 5, { align: "right" });

      // 6. Signatures Pinned at Bottom
      const signY = Math.max(bottomTopY + bottomBoxH + 14, 266);
      pdf.setDrawColor(...SLATE_BDR);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, signY + 8, marginX + 45, signY + 8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Receiver's Signature / Seal", marginX, signY + 12);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...SLATE_DARK);
      pdf.text(`For ${compName}`, pageW - marginX, signY - 2, { align: "right" });

      pdf.setDrawColor(51, 65, 85);
      pdf.line(pageW - marginX - 48, signY + 8, pageW - marginX, signY + 8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...SLATE_DARK);
      pdf.text("Authorized Signatory", pageW - marginX - 24, signY + 12, { align: "center" });
    });

    const sanitizedDocNum = String(docNum).replace(/[^a-zA-Z0-9_-]/g, "_");
    const copySuffix = copyType && copyType !== "all" ? `_${copyType.toUpperCase()}` : "_3COPY";
    pdf.save(`DELIVERY_CHALLAN_${sanitizedDocNum}${copySuffix}.pdf`);
  } catch (error) {
    console.error("Failed to generate Delivery Challan PDF:", error);
    alert("Failed to generate Delivery Challan PDF. Please try again.");
  }
};

export const download4CopyPDF = (type: "dc" | "invoice", { doc, companyInfo, copyType = "all" }: DocumentOptions) => {
  try {
    if (!doc) {
      alert("No document data provided for PDF generation");
      return;
    }

    if (type === "dc") {
      downloadDirectDcPDF({ doc, companyInfo, copyType });
      return;
    }

    if (type === "invoice") {
      generateFrontendInvoicePDF({ doc, companyInfo, copyType });
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    let copies = [
      "ORIGINAL FOR RECIPIENT",
      "DUPLICATE FOR TRANSPORTER",
      "TRIPLICATE FOR SUPPLIER"
    ];

    if (copyType === "original") {
      copies = ["ORIGINAL FOR RECIPIENT"];
    } else if (copyType === "duplicate") {
      copies = ["DUPLICATE FOR TRANSPORTER"];
    } else if (copyType === "triplicate") {
      copies = ["TRIPLICATE FOR SUPPLIER"];
    }

    const isInvoice = type === "invoice";
    const documentTitle = isInvoice ? "TAX INVOICE" : "DELIVERY CHALLAN";
    const docNum = isInvoice ? (doc.invoiceNumber || "INV-001") : (doc.dcNumber || "DC-001");

    // 1. Master Company Details Resolution (With Cache Fallbacks)
    let masterCompany = companyInfo;
    if (!masterCompany || !masterCompany.companyName) {
      try {
        const storedCompany = localStorage.getItem("companyInfo");
        const storedUser = localStorage.getItem("userInfo");
        if (storedCompany) {
          masterCompany = { ...JSON.parse(storedCompany), ...companyInfo };
        } else if (storedUser) {
          masterCompany = { ...JSON.parse(storedUser), ...companyInfo };
        }
      } catch (e) {
        console.warn("Could not parse cached company info:", e);
      }
    }

    const companyName = masterCompany?.companyName || masterCompany?.name || "COMPANY MASTER";
    const compAddressRaw = masterCompany?.billingAddress || masterCompany?.address || masterCompany?.location || "";
    const compCityState = [masterCompany?.city, masterCompany?.state, masterCompany?.pincode ? `- ${masterCompany.pincode}` : ""].filter(Boolean).join(" ");
    const companyAddress = [compAddressRaw, compCityState].filter(Boolean).join(", ");

    const compContact = masterCompany?.contactNumber || masterCompany?.phone || masterCompany?.mobile || "-";
    const compEmail = masterCompany?.email || "-";
    const compGst = masterCompany?.gstin || masterCompany?.gstNumber || masterCompany?.gst || "-";
    const compPan = masterCompany?.panNumber || masterCompany?.pan || "-";

    const bankName = masterCompany?.bankDetails?.bankName || masterCompany?.bankName || "-";
    const accountNumber = masterCompany?.bankDetails?.accountNumber || masterCompany?.accountNumber || "-";
    const ifscCode = masterCompany?.bankDetails?.ifscCode || masterCompany?.ifscCode || "-";
    const branchName = masterCompany?.bankDetails?.branchName || masterCompany?.branchName || "";

    // 2. Customer Details Resolution
    const custObj = typeof doc.customer === 'object' ? doc.customer : {};
    const custName = doc.customerName || custObj?.name || custObj?.companyName || "Internal / Cash Customer";
    const custAddressRaw = doc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || "-";
    const custCityState = [custObj?.city, custObj?.state, custObj?.pincode].filter(Boolean).join(" ");
    const custAddress = custAddressRaw !== "-" && custCityState ? `${custAddressRaw}, ${custCityState}` : custAddressRaw;
    const custGst = doc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "-";
    const custPhone = doc.customerPhone || custObj?.phone || custObj?.contactNumber || "-";
    const custPoRef = doc.customerPoReference || doc.poNumber || "-";
    const custPoDate = doc.poDate ? new Date(doc.poDate).toLocaleDateString("en-IN") : "-";

    // 3. Document Logistics Metadata
    const creationDateTimeStr = formatDateTime(doc.createdAt || doc.date || Date.now());
    const transportMode = doc.transportationType || doc.transportType || doc.transportMode || "Road Transport";
    const vehicleNo = doc.vehicleNumber || doc.vehicleNo || "-";
    const packagingType = doc.packagingType || "Standard Packaging";
    const eWayNo = doc.eWayBillNo || doc.eWayNo || "-";

    copies.forEach((copyTitle, pageIndex) => {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      // Outer Frame Grid (Dark Slate Border)
      pdf.setLineWidth(0.4);
      pdf.setDrawColor(30, 41, 59);
      pdf.rect(8, 8, 194, 281);

      // Top Primary Header Banner (Slate Gradient Box)
      pdf.setFillColor(248, 250, 252);
      pdf.rect(8.4, 8.4, 193.2, 30, "F");

      // Copy Badge Box (Top Right Pill Container)
      pdf.setFillColor(30, 41, 59);
      pdf.rect(130, 11, 70, 7.5, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "bold");
      pdf.text(copyTitle, 165, 16, { align: "center" });

      // Company Header Info
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(companyName.toUpperCase(), 12, 17);

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(51, 65, 85);
      
      let compY = 21.5;
      if (companyAddress) {
        const addressLines = pdf.splitTextToSize(companyAddress, 115);
        pdf.text(addressLines, 12, compY);
        compY += (addressLines.length * 3.5);
      }

      const contactStr = `Phone: ${compContact} | Email: ${compEmail}`;
      pdf.text(contactStr, 12, compY);
      compY += 3.5;

      const taxIdStr = `GSTIN: ${compGst} | PAN: ${compPan}`;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(taxIdStr, 12, compY);

      // Document Title Banner (Centered Bar)
      pdf.setFillColor(241, 245, 249);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(8.4, 40, 193.2, 8.5, "FD");
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(documentTitle, 105, 45.8, { align: "center" });

      // Two-Column Grid Dividers
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(8.4, 48.5, 201.6, 48.5);
      pdf.line(105, 48.5, 105, 84);
      pdf.line(8.4, 84, 201.6, 84);

      // Customer Details (Left Panel)
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text("BUYER / CONSIGNEE DETAILS:", 12, 53);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(custName, 12, 58);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      
      let custY = 62.5;
      if (custAddress && custAddress !== "-") {
        const custAddrLines = pdf.splitTextToSize(`Address: ${custAddress}`, 88);
        pdf.text(custAddrLines, 12, custY);
        custY += (custAddrLines.length * 3.5);
      }

      if (custGst && custGst !== "-") {
        pdf.text(`GSTIN: ${custGst}`, 12, custY);
        custY += 3.5;
      }

      if (custPhone && custPhone !== "-") {
        pdf.text(`Contact: ${custPhone}`, 12, custY);
        custY += 3.5;
      }

      if (custPoRef && custPoRef !== "-") {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text(`PO Ref: ${custPoRef} ${custPoDate !== "-" ? `(Date: ${custPoDate})` : ""}`, 12, custY);
      }

      // Document & Logistics Details (Right Panel)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      pdf.text("DOCUMENT & LOGISTICS INFO:", 108, 53);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      
      let logY = 58;
      const drawMetaLine = (label: string, val: string, isBoldVal = true) => {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(label, 108, logY);
        pdf.setFont("helvetica", isBoldVal ? "bold" : "normal");
        pdf.setTextColor(15, 23, 42);
        pdf.text(val, 150, logY);
        logY += 4;
      };

      drawMetaLine(isInvoice ? "Invoice No:" : "DC No:", docNum, true);
      drawMetaLine("Creation Time:", creationDateTimeStr, true);
      drawMetaLine("Transport Mode:", transportMode, false);
      drawMetaLine("Vehicle No:", vehicleNo, true);
      drawMetaLine("Packaging Type:", packagingType, false);
      if (eWayNo && eWayNo !== "-") {
        drawMetaLine("E-Way Bill No:", eWayNo, true);
      }

// Vector Rupee Symbol ₹ Drawer for jsPDF (Works across all PDF viewers without broken font glyphs)
function drawRupeeSymbol(pdf: jsPDF, x: number, y: number, size: number = 2.4) {
  const oldWidth = pdf.getLineWidth();
  const oldColor = pdf.getDrawColor();

  pdf.setLineWidth(0.3);
  pdf.setDrawColor(15, 23, 42); // Dark Slate

  const topY = y - size + 0.4;
  const midY = y - size + 1.2;
  const botY = y - size + 1.9;

  // Top horizontal bar
  pdf.line(x, topY, x + size * 0.7, topY);
  // Second horizontal bar
  pdf.line(x, midY, x + size * 0.65, midY);
  // Vertical stem
  pdf.line(x + size * 0.18, topY, x + size * 0.18, botY);
  // Upper curve
  pdf.line(x + size * 0.18, botY, x + size * 0.6, botY - 0.25);
  // Slanted leg
  pdf.line(x + size * 0.22, botY - 0.2, x + size * 0.75, y);

  pdf.setLineWidth(oldWidth);
  pdf.setDrawColor(oldColor);
}

      const docCurrSym = getCurrencySymbol(doc.currency);

      // Line Items AutoTable
      const tableHeaders = isInvoice
        ? [["S.No.", "Material / Item Description", "HSN Code", "Qty", "Unit", `Rate (${docCurrSym})`, "Tax %", `Amount (${docCurrSym})`]]
        : [["S.No.", "Material / Item Description", "HSN Code", "Qty", "Unit", `Rate (${docCurrSym})`, `Amount (${docCurrSym})`, "Remarks"]];

      const items = doc.items || [];
      const tableRows = items.map((item: any, idx: number) => {
        const qty = Number(item.quantity || item.qty || 0);
        const rate = Number(item.rate || item.unitPrice || item.price || 0);
        const amount = Number(item.amount || item.lineTotal || (qty * rate));
        const taxRate = Number(item.taxRate || 0);
        const taxAmt = amount * (taxRate / 100);
        const total = amount + taxAmt;

        if (isInvoice) {
          return [
            idx + 1,
            item.materialName || item.productName || item.itemName || item.name || "Item",
            item.hsnCode || item.hsn || "-",
            qty,
            item.unit || item.uom || "PCS",
            rate ? rate.toFixed(2) : "0.00",
            `${taxRate}%`,
            total ? total.toFixed(2) : "0.00"
          ];
        } else {
          return [
            idx + 1,
            item.materialName || item.productName || item.itemName || item.name || "Item",
            item.hsnCode || item.hsn || "-",
            qty,
            item.unit || item.uom || "PCS",
            rate ? rate.toFixed(2) : "-",
            amount ? amount.toFixed(2) : "-",
            item.remarks || item.description || item.specifications || "-"
          ];
        }
      });

      // Pad minimum rows to maintain elegant aesthetic
      while (tableRows.length < 5) {
        tableRows.push(["", "", "", "", "", "", "", ...(isInvoice ? [] : [])]);
      }

      autoTable(pdf, {
        startY: 85,
        head: tableHeaders,
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
          cellPadding: 2.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [15, 23, 42],
          cellPadding: 2.5
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: isInvoice ? {
          0: { halign: "center", cellWidth: 12 },
          1: { cellWidth: 54 },
          2: { halign: "center", cellWidth: 20 },
          3: { halign: "center", cellWidth: 15 },
          4: { halign: "center", cellWidth: 15 },
          5: { halign: "right", cellWidth: 24 },
          6: { halign: "center", cellWidth: 18 },
          7: { halign: "right", cellWidth: 35.2 }
        } : {
          0: { halign: "center", cellWidth: 12 },
          1: { cellWidth: 54 },
          2: { halign: "center", cellWidth: 20 },
          3: { halign: "center", cellWidth: 15 },
          4: { halign: "center", cellWidth: 15 },
          5: { halign: "right", cellWidth: 24 },
          6: { halign: "right", cellWidth: 26 },
          7: { cellWidth: 27.2 }
        },
        margin: { left: 8.4, right: 8.4 }
      });

      const autoTableFinalY = (pdf as any).lastAutoTable.finalY || 165;
      // Dock Bank Details & Grand Total section at bottom of page (min Y = 202mm)
      const footerStartY = Math.max(autoTableFinalY + 4, 202);

      // Dividers above bottom summary section
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(8.4, footerStartY, 201.6, footerStartY);

      // Calculation Breakdown & Financial Totals
      const subtotal = doc.subtotal || (doc.items || []).reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
      const transportCharges = Number(doc.transportationCharges || doc.freightCharges || 0);
      const packagingCharges = Number(doc.packagingCharges || 0);
      const discount = Number(doc.discount || 0);
      const taxAmount = doc.taxAmount || (doc.items || []).reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
      const rawExactTotal = parseFloat((subtotal + taxAmount + transportCharges + packagingCharges - discount).toFixed(2));
      const isRoundOffEnabled = doc.isRoundOff !== undefined ? Boolean(doc.isRoundOff) : true;
      const roundOff = doc.roundOff !== undefined ? Number(doc.roundOff) : (isRoundOffEnabled ? parseFloat((Math.round(rawExactTotal) - rawExactTotal).toFixed(2)) : 0);
      const grandTotal = doc.totalAmount || (isRoundOffEnabled ? Math.round(rawExactTotal) : rawExactTotal);

      // Left Column: Bank Info & Remarks
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text("BANK DETAILS & REMARKS:", 12, footerStartY + 5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);

      let footerY = footerStartY + 9;
      const bankDetailsStr = `Bank: ${bankName} | A/c: ${accountNumber} | IFSC: ${ifscCode} ${branchName ? `| Branch: ${branchName}` : ""}`;
      pdf.text(bankDetailsStr, 12, footerY);
      footerY += 4;

      if (doc.remarks || doc.otherDetails) {
        const remarkStr = `Remarks: ${doc.remarks || doc.otherDetails}`;
        const remarkLines = pdf.splitTextToSize(remarkStr, 110);
        pdf.text(remarkLines, 12, footerY);
        footerY += (remarkLines.length * 3.5);
      }

      pdf.text("Terms: Subject to local jurisdiction. Goods dispatched in good condition.", 12, footerY);
      footerY += 4;

      // Amount in Words Highlight
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      const wordsStr = `Amount in Words: ${convertAmountToWords(grandTotal, doc.currency)}`;
      const wordLines = pdf.splitTextToSize(wordsStr, 110);
      pdf.text(wordLines, 12, footerY);

      // Right Column: Summary Calculation Table
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(15, 23, 42);

      let calcY = footerStartY + 5;
      const drawValWithCurrency = (label: string, val: number, prefix = "") => {
        pdf.text(label, 130, calcY);
        const valStr = `${prefix}${val.toFixed(2)}`;
        const valWidth = pdf.getTextWidth(valStr);
        pdf.text(valStr, 196, calcY, { align: "right" });
        if (docCurrSym === '₹') {
          drawRupeeSymbol(pdf, 196 - valWidth - 3.2, calcY, 2.3);
        } else {
          pdf.text(docCurrSym, 196 - valWidth - 3.2, calcY, { align: "right" });
        }
      };

      drawValWithCurrency("Subtotal:", subtotal);

      if (transportCharges > 0) {
        calcY += 4.5;
        drawValWithCurrency("Freight / Transport:", transportCharges, "+ ");
      }

      if (packagingCharges > 0) {
        calcY += 4.5;
        drawValWithCurrency("Packaging Charges:", packagingCharges, "+ ");
      }

      if (discount > 0) {
        calcY += 4.5;
        drawValWithCurrency("Discount:", discount, "- ");
      }

      if (isInvoice || taxAmount > 0) {
        calcY += 4.5;
        drawValWithCurrency("Tax Amount (GST):", taxAmount);
      }

      if (isRoundOffEnabled && Math.abs(roundOff) > 0.001) {
        calcY += 4.5;
        drawValWithCurrency("Round Off:", Math.abs(roundOff), roundOff >= 0 ? "+ " : "- ");
      }

      calcY += 6;
      // Boxed Grand Total Highlight Container (Docked cleanly at bottom)
      pdf.setFillColor(241, 245, 249);
      pdf.setDrawColor(30, 41, 59);
      pdf.rect(125, calcY - 4, 76.6, 9.5, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`GRAND TOTAL (${doc.currency || 'INR'}):`, 128, calcY + 2);
      
      const grandStr = grandTotal.toFixed(2);
      const grandWidth = pdf.getTextWidth(grandStr);
      pdf.text(grandStr, 196, calcY + 2, { align: "right" });
      if (docCurrSym === '₹') {
        drawRupeeSymbol(pdf, 196 - grandWidth - 3.5, calcY + 2, 2.6);
      } else {
        pdf.text(docCurrSym, 196 - grandWidth - 3.5, calcY + 2, { align: "right" });
      }

      // Bottom Signatures Block (Pinned to bottom frame)
      const signY = Math.max(calcY + 16, 260);
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(8.4, signY - 4, 201.6, signY - 4);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text("Receiver's Signature / Seal", 12, signY + 14);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`For ${companyName}`, 196, signY + 2, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text("Authorized Signatory", 196, signY + 14, { align: "right" });
    });

    const copySuffix = copyType && copyType !== "all" ? `_${copyType.toUpperCase()}` : "_3COPY";
    pdf.save(`${(type as string).toUpperCase()}_${docNum}${copySuffix}.pdf`);
  } catch (error) {
    console.error("Failed to generate PDF document:", error);
    alert("Failed to generate PDF document. Please try again.");
  }
};

export const download3CopyPDF = download4CopyPDF;

/**
 * Generate Itemized Excel/CSV Export directly in Browser
 */
export const downloadFrontendExcel = (filename: string, rows: any[]) => {
  try {
    if (!rows || rows.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = Object.keys(rows[0]).join(",");
    const csvRows = rows.map(r => 
      Object.values(r).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Failed to export Excel/CSV:", err);
    alert("Failed to export spreadsheet.");
  }
};

/**
 * Generate a complete, beautifully structured Delivery Challan Excel Sheet (.xlsx)
 * matching company master details, customer consignee info, line items, totals, bank details, and amount in words.
 */
export const downloadDCExcelDocument = (dc: any, companyInfo?: any) => {
  try {
    if (!dc) {
      alert("No Delivery Challan data provided for Excel export");
      return;
    }

    // Master Company Resolution
    let masterCompany = companyInfo;
    if (!masterCompany || !masterCompany.companyName) {
      try {
        const storedCompany = localStorage.getItem("companyInfo");
        const storedUser = localStorage.getItem("userInfo");
        if (storedCompany) masterCompany = { ...JSON.parse(storedCompany), ...companyInfo };
        else if (storedUser) masterCompany = { ...JSON.parse(storedUser), ...companyInfo };
      } catch (e) {}
    }

    const compName = masterCompany?.companyName || masterCompany?.name || 'COMPANY MASTER';
    const compAddressRaw = masterCompany?.billingAddress || masterCompany?.address || masterCompany?.location || '';
    const compCityState = [masterCompany?.city, masterCompany?.state, masterCompany?.pincode ? `- ${masterCompany.pincode}` : ''].filter(Boolean).join(' ');
    const compAddress = [compAddressRaw, compCityState].filter(Boolean).join(', ');
    const compPhone = masterCompany?.contactNumber || masterCompany?.phone || masterCompany?.mobile || '-';
    const compEmail = masterCompany?.email || '-';
    const compGst = masterCompany?.gstin || masterCompany?.gstNumber || masterCompany?.gst || 'N/A';
    const compPan = masterCompany?.panNumber || masterCompany?.pan || 'N/A';

    const bankName = masterCompany?.bankDetails?.bankName || masterCompany?.bankName || '-';
    const accountNumber = masterCompany?.bankDetails?.accountNumber || masterCompany?.accountNumber || '-';
    const ifscCode = masterCompany?.bankDetails?.ifscCode || masterCompany?.ifscCode || '-';
    const branchName = masterCompany?.bankDetails?.branchName || masterCompany?.branchName || '';

    // Customer Details Resolution
    const custObj = typeof dc.customer === 'object' ? dc.customer : {};
    const custName = dc.customerName || custObj?.name || custObj?.companyName || 'Internal Customer / Cash Sales';
    const custAddressRaw = dc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || '';
    const custCityState = [custObj?.city, custObj?.state, custObj?.pincode].filter(Boolean).join(' ');
    const custAddress = custAddressRaw && custCityState ? `${custAddressRaw}, ${custCityState}` : (custAddressRaw || '-');
    const custGst = dc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || 'N/A';
    const custPhone = dc.customerPhone || custObj?.phone || custObj?.contactNumber || '-';
    const custPoRef = dc.customerPoReference || dc.poNumber || '-';
    const custPoDate = dc.poDate ? new Date(dc.poDate).toLocaleDateString("en-IN") : '-';

    // Logistics & Metadata
    const docNum = dc.dcNumber || 'DC-001';
    const creationTime = formatDateTime(dc.createdAt || dc.date);
    const transportMode = dc.transportationType || dc.transportType || dc.transportMode || 'Road Transport';
    const vehicleNo = dc.vehicleNumber || dc.vehicleNo || '-';
    const packagingType = dc.packagingType || 'Standard Packaging';
    const eWayNo = dc.eWayBillNo || dc.eWayNo || '-';

    const items = dc.items || [];
    const subtotal = dc.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(dc.transportationCharges || dc.freightCharges || 0);
    const packagingCharges = Number(dc.packagingCharges || 0);
    const discount = Number(dc.discount || 0);
    const taxAmount = dc.taxAmount || items.reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
    const rawExactTotal = parseFloat((subtotal + taxAmount + transportCharges + packagingCharges - discount).toFixed(2));
    const isRoundOffEnabled = dc.isRoundOff !== undefined ? Boolean(dc.isRoundOff) : true;
    const roundOff = dc.roundOff !== undefined ? Number(dc.roundOff) : (isRoundOffEnabled ? parseFloat((Math.round(rawExactTotal) - rawExactTotal).toFixed(2)) : 0);
    const grandTotal = dc.totalAmount || (isRoundOffEnabled ? Math.round(rawExactTotal) : rawExactTotal);

    const merges: XLSX.Range[] = [];
    const sheetData: any[][] = [];

    let rowIdx = 0;

    // Row 0: Company Name (A1:H1)
    sheetData.push([compName.toUpperCase(), '', '', '', '', '', '', '']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
    rowIdx++;

    // Row 1: Company Address (A2:H2)
    sheetData.push([`Address: ${compAddress}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
    rowIdx++;

    // Row 2: Company Phone / Email / GSTIN / PAN (A3:H3)
    sheetData.push([`Phone: ${compPhone} | Email: ${compEmail} | GSTIN: ${compGst} | PAN: ${compPan}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 7 } });
    rowIdx++;

    // Row 3: Blank
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Row 4: Title Banner - DELIVERY CHALLAN (A5:H5)
    sheetData.push(['DELIVERY CHALLAN', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 7 } });
    rowIdx++;

    // Row 5: Blank
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Row 6: Section Headers (A7:D7 - BUYER / CONSIGNEE DETAILS, E7:H7 - DOCUMENT & LOGISTICS INFO)
    sheetData.push(['BUYER / CONSIGNEE DETAILS', '', '', '', 'DOCUMENT & LOGISTICS INFO', '', '', '']);
    merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 3 } });
    merges.push({ s: { r: 6, c: 4 }, e: { r: 6, c: 7 } });
    rowIdx++;

    // Row 7: Customer Name & DC Number
    sheetData.push([`Customer Name: ${custName}`, '', '', '', `DC Number: ${docNum}`, '', '', '']);
    merges.push({ s: { r: 7, c: 0 }, e: { r: 7, c: 3 } });
    merges.push({ s: { r: 7, c: 4 }, e: { r: 7, c: 7 } });
    rowIdx++;

    // Row 8: Customer Address & Creation Date & Time
    sheetData.push([`Address: ${custAddress}`, '', '', '', `Creation Date & Time: ${creationTime}`, '', '', '']);
    merges.push({ s: { r: 8, c: 0 }, e: { r: 8, c: 3 } });
    merges.push({ s: { r: 8, c: 4 }, e: { r: 8, c: 7 } });
    rowIdx++;

    // Row 9: Customer GSTIN/Phone & Transport Mode
    sheetData.push([`GSTIN: ${custGst} | Contact: ${custPhone}`, '', '', '', `Transport Mode: ${transportMode}`, '', '', '']);
    merges.push({ s: { r: 9, c: 0 }, e: { r: 9, c: 3 } });
    merges.push({ s: { r: 9, c: 4 }, e: { r: 9, c: 7 } });
    rowIdx++;

    // Row 10: Customer PO Ref & Vehicle/E-Way
    sheetData.push([`PO Ref: ${custPoRef} ${custPoDate !== '-' ? `(Date: ${custPoDate})` : ''}`, '', '', '', `Vehicle No: ${vehicleNo} | E-Way: ${eWayNo}`, '', '', '']);
    merges.push({ s: { r: 10, c: 0 }, e: { r: 10, c: 3 } });
    merges.push({ s: { r: 10, c: 4 }, e: { r: 10, c: 7 } });
    rowIdx++;

    // Row 11: Blank
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    const dcCurrCode = dc.currency || 'INR';
    const dcCurrSym = getCurrencySymbol(dc.currency);

    // Row 12: Itemized Table Headers
    sheetData.push(['S.No.', 'Product / Material Description', 'HSN Code', 'Quantity', 'Unit', `Unit Rate (${dcCurrCode})`, `Line Amount (${dcCurrCode})`, 'Remarks']);
    rowIdx++;

    // Item rows
    items.forEach((item: any, idx: number) => {
      const qty = Number(item.quantity || item.qty || 0);
      const rate = Number(item.rate || item.unitPrice || item.price || 0);
      const amount = Number(item.amount || item.lineTotal || (qty * rate));
      const itemName = item.materialName || item.productName || item.itemName || item.name || 'Item';
      const hsn = item.hsnCode || item.hsn || '-';
      const remarks = item.remarks || item.description || item.specifications || '-';

      sheetData.push([
        idx + 1,
        itemName,
        hsn,
        qty,
        item.unit || item.uom || 'PCS',
        rate,
        amount,
        remarks
      ]);
      rowIdx++;
    });

    // Blank row
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Summary & Bank Section
    sheetData.push([`Bank: ${bankName} | A/c: ${accountNumber} | IFSC: ${ifscCode} ${branchName ? `| Branch: ${branchName}` : ''}`, '', '', '', `Subtotal (${dcCurrCode})`, '', subtotal, '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 3 } });
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
    merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    if (transportCharges > 0) {
      sheetData.push(['', '', '', '', `Freight Charges (${dcCurrCode})`, '', transportCharges, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (packagingCharges > 0) {
      sheetData.push(['', '', '', '', `Packaging Charges (${dcCurrCode})`, '', packagingCharges, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (discount > 0) {
      sheetData.push(['', '', '', '', `Discount (${dcCurrCode})`, '', discount, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (taxAmount > 0) {
      sheetData.push(['', '', '', '', `Tax Amount GST (${dcCurrCode})`, '', taxAmount, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (roundOff !== 0) {
      sheetData.push(['', '', '', '', `Round Off (${dcCurrCode})`, '', roundOff, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    // Grand Total Row
    sheetData.push(['Terms: Subject to local jurisdiction. Goods dispatched in good condition.', '', '', '', `GRAND TOTAL (${dcCurrCode})`, '', grandTotal, '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 3 } });
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
    merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    // Amount in Words Row
    sheetData.push([`Amount in Words: ${convertAmountToWords(grandTotal, dc.currency)}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    // Blank row
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Signatures Block
    sheetData.push(["Receiver's Signature / Seal", '', '', '', `For ${compName}`, '', '', '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 3 } });
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    sheetData.push(['', '', '', '', 'Authorized Signatory', '', '', '']);
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 7 } });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set SheetJS Cell Merges
    ws['!merges'] = merges;

    // Optimized Column Widths (Cols A-H)
    ws['!cols'] = [
      { wch: 8 },  // Col A: S.No
      { wch: 34 }, // Col B: Description
      { wch: 14 }, // Col C: HSN Code
      { wch: 11 }, // Col D: Qty
      { wch: 9 },  // Col E: Unit
      { wch: 16 }, // Col F: Unit Rate (₹)
      { wch: 18 }, // Col G: Line Amount (₹)
      { wch: 22 }  // Col H: Remarks
    ];

    // Page & Print Setup properties (A4 Portrait, Fit 1 Page Wide)
    (ws as any)['!pageSetup'] = {
      orientation: 'portrait',
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9 // A4
    };

    (ws as any)['!margins'] = {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    };

    const safeSheetName = `DC_${docNum}`.replace(/[:\\/?*\[\]]/g, "_").slice(0, 30);
    const safeFileName = `Delivery_Challan_${docNum}`.replace(/[:\\/?*\[\]]/g, "_");

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    XLSX.writeFile(wb, `${safeFileName}.xlsx`);
  } catch (err) {
    console.error("Failed to export Excel document:", err);
    alert("Failed to export Delivery Challan Excel document.");
  }
};

/**
 * Generate a complete, beautifully structured Tax Invoice Excel Sheet (.xlsx)
 * matching company master details, customer consignee info, line items, totals, bank details, and amount in words.
 */
export const downloadInvoiceExcelDocument = (invoice: any, companyInfo?: any) => {
  try {
    if (!invoice) {
      alert("No Tax Invoice data provided for Excel export");
      return;
    }

    // Master Company Resolution
    let masterCompany = companyInfo;
    if (!masterCompany || !masterCompany.companyName) {
      try {
        const storedCompany = localStorage.getItem("companyInfo");
        const storedUser = localStorage.getItem("userInfo");
        if (storedCompany) masterCompany = { ...JSON.parse(storedCompany), ...companyInfo };
        else if (storedUser) masterCompany = { ...JSON.parse(storedUser), ...companyInfo };
      } catch (e) {}
    }

    const compName = masterCompany?.companyName || masterCompany?.name || 'COMPANY MASTER';
    const compAddressRaw = masterCompany?.billingAddress || masterCompany?.address || masterCompany?.location || '';
    const compCityState = [masterCompany?.city, masterCompany?.state, masterCompany?.pincode ? `- ${masterCompany.pincode}` : ''].filter(Boolean).join(' ');
    const compAddress = [compAddressRaw, compCityState].filter(Boolean).join(', ');
    const compPhone = masterCompany?.contactNumber || masterCompany?.phone || masterCompany?.mobile || '-';
    const compEmail = masterCompany?.email || '-';
    const compGst = masterCompany?.gstin || masterCompany?.gstNumber || masterCompany?.gst || 'N/A';
    const compPan = masterCompany?.panNumber || masterCompany?.pan || 'N/A';

    const bankName = masterCompany?.bankDetails?.bankName || masterCompany?.bankName || '-';
    const accountNumber = masterCompany?.bankDetails?.accountNumber || masterCompany?.accountNumber || '-';
    const ifscCode = masterCompany?.bankDetails?.ifscCode || masterCompany?.ifscCode || '-';
    const branchName = masterCompany?.bankDetails?.branchName || masterCompany?.branchName || '';

    // Customer Details Resolution
    const custObj = typeof invoice.customer === 'object' ? invoice.customer : {};
    const custName = invoice.customerName || custObj?.name || custObj?.companyName || 'Internal Customer / Cash Sales';
    const custAddressRaw = invoice.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || '';
    const custCityState = [custObj?.city, custObj?.state, custObj?.pincode].filter(Boolean).join(' ');
    const custAddress = custAddressRaw && custCityState ? `${custAddressRaw}, ${custCityState}` : (custAddressRaw || '-');
    const custGst = invoice.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || 'N/A';
    const custPhone = invoice.customerPhone || custObj?.phone || custObj?.contactNumber || '-';
    const custPoRef = invoice.customerPoReference || invoice.poNumber || '-';
    const custPoDate = invoice.poDate ? new Date(invoice.poDate).toLocaleDateString("en-IN") : '-';

    // Logistics & Metadata
    const docNum = invoice.invoiceNumber || 'INV-001';
    const creationTime = formatDateTime(invoice.createdAt || invoice.date);
    const transportMode = invoice.transportationType || invoice.transportType || invoice.transportMode || 'Road Transport';
    const vehicleNo = invoice.vehicleNumber || invoice.vehicleNo || '-';
    const packagingType = invoice.packagingType || 'Standard Packaging';
    const eWayNo = invoice.eWayBillNo || invoice.eWayNo || '-';

    const items = invoice.items || [];
    const subtotal = invoice.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(invoice.transportationCharges || invoice.freightCharges || 0);
    const packagingCharges = Number(invoice.packagingCharges || 0);
    const discount = Number(invoice.discount || 0);
    const taxAmount = invoice.taxAmount || items.reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
    const grandTotal = invoice.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

    const merges: XLSX.Range[] = [];
    const sheetData: any[][] = [];

    let rowIdx = 0;

    // Row 0: Company Name (A1:H1)
    sheetData.push([compName.toUpperCase(), '', '', '', '', '', '', '']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
    rowIdx++;

    // Row 1: Company Address (A2:H2)
    sheetData.push([`Address: ${compAddress}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
    rowIdx++;

    // Row 2: Company Phone / Email / GSTIN / PAN (A3:H3)
    sheetData.push([`Phone: ${compPhone} | Email: ${compEmail} | GSTIN: ${compGst} | PAN: ${compPan}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 7 } });
    rowIdx++;

    // Row 3: Blank
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Row 4: Title Banner - TAX INVOICE (A5:H5)
    sheetData.push(['TAX INVOICE', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 7 } });
    rowIdx++;

    // Row 5: Blank
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Row 6: Section Headers (A7:D7 - BUYER / CONSIGNEE DETAILS, E7:H7 - DOCUMENT & LOGISTICS INFO)
    sheetData.push(['BUYER / CONSIGNEE DETAILS', '', '', '', 'DOCUMENT & LOGISTICS INFO', '', '', '']);
    merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 3 } });
    merges.push({ s: { r: 6, c: 4 }, e: { r: 6, c: 7 } });
    rowIdx++;

    // Row 7: Customer Name & Invoice Number
    sheetData.push([`Customer Name: ${custName}`, '', '', '', `Invoice Number: ${docNum}`, '', '', '']);
    merges.push({ s: { r: 7, c: 0 }, e: { r: 7, c: 3 } });
    merges.push({ s: { r: 7, c: 4 }, e: { r: 7, c: 7 } });
    rowIdx++;

    // Row 8: Customer Address & Creation Date & Time
    sheetData.push([`Address: ${custAddress}`, '', '', '', `Creation Date & Time: ${creationTime}`, '', '', '']);
    merges.push({ s: { r: 8, c: 0 }, e: { r: 8, c: 3 } });
    merges.push({ s: { r: 8, c: 4 }, e: { r: 8, c: 7 } });
    rowIdx++;

    // Row 9: Customer GSTIN/Phone & Transport Mode
    sheetData.push([`GSTIN: ${custGst} | Contact: ${custPhone}`, '', '', '', `Transport Mode: ${transportMode}`, '', '', '']);
    merges.push({ s: { r: 9, c: 0 }, e: { r: 9, c: 3 } });
    merges.push({ s: { r: 9, c: 4 }, e: { r: 9, c: 7 } });
    rowIdx++;

    // Row 10: Customer PO Ref & Vehicle/E-Way
    sheetData.push([`PO Ref: ${custPoRef} ${custPoDate !== '-' ? `(Date: ${custPoDate})` : ''}`, '', '', '', `Vehicle No: ${vehicleNo} | E-Way: ${eWayNo}`, '', '', '']);
    merges.push({ s: { r: 10, c: 0 }, e: { r: 10, c: 3 } });
    merges.push({ s: { r: 10, c: 4 }, e: { r: 10, c: 7 } });
    rowIdx++;

    // Row 11: Blank
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    const invCurrCode = invoice.currency || 'INR';
    const invCurrSym = getCurrencySymbol(invoice.currency);

    // Row 12: Itemized Table Headers
    sheetData.push(['S.No.', 'Product / Material Description', 'HSN Code', 'Quantity', 'Unit', `Unit Rate (${invCurrCode})`, 'GST %', `Line Amount (${invCurrCode})`]);
    rowIdx++;

    // Item rows
    items.forEach((item: any, idx: number) => {
      const qty = Number(item.quantity || item.qty || 0);
      const rate = Number(item.rate || item.unitPrice || item.price || 0);
      const amount = Number(item.amount || (qty * rate));
      const taxRate = Number(item.taxRate || 0);
      const totalLine = amount + (amount * (taxRate / 100));
      const itemName = item.materialName || item.productName || item.itemName || item.name || 'Item';
      const hsn = item.hsnCode || item.hsn || '-';

      sheetData.push([
        idx + 1,
        itemName,
        hsn,
        qty,
        item.unit || item.uom || 'PCS',
        rate,
        taxRate > 0 ? `${taxRate}%` : '-',
        totalLine
      ]);
      rowIdx++;
    });

    // Blank row
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Summary & Bank Section
    sheetData.push([`Bank: ${bankName} | A/c: ${accountNumber} | IFSC: ${ifscCode} ${branchName ? `| Branch: ${branchName}` : ''}`, '', '', '', `Subtotal (${invCurrCode})`, '', subtotal, '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 3 } });
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
    merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    if (transportCharges > 0) {
      sheetData.push(['', '', '', '', `Freight Charges (${invCurrCode})`, '', transportCharges, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (packagingCharges > 0) {
      sheetData.push(['', '', '', '', `Packaging Charges (${invCurrCode})`, '', packagingCharges, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (discount > 0) {
      sheetData.push(['', '', '', '', `Discount (${invCurrCode})`, '', discount, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    if (taxAmount > 0) {
      sheetData.push(['', '', '', '', `Tax Amount GST (${invCurrCode})`, '', taxAmount, '']);
      merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
      merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
      rowIdx++;
    }

    // Grand Total Row
    sheetData.push(['Terms: Subject to local jurisdiction. Payment due as per agreed billing terms.', '', '', '', `GRAND TOTAL (${invCurrCode})`, '', grandTotal, '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 3 } });
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
    merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    // Amount in Words Row
    sheetData.push([`Amount in Words: ${convertAmountToWords(grandTotal, invoice.currency)}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    // Blank row
    sheetData.push(['', '', '', '', '', '', '', '']);
    rowIdx++;

    // Signatures Block
    sheetData.push(["Receiver's Signature / Seal", '', '', '', `For ${compName}`, '', '', '']);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 3 } });
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 7 } });
    rowIdx++;

    sheetData.push(['', '', '', '', 'Authorized Signatory', '', '', '']);
    merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 7 } });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set SheetJS Cell Merges
    ws['!merges'] = merges;

    // Optimized Column Widths (Cols A-H)
    ws['!cols'] = [
      { wch: 8 },  // Col A: S.No
      { wch: 34 }, // Col B: Description
      { wch: 14 }, // Col C: HSN Code
      { wch: 11 }, // Col D: Qty
      { wch: 9 },  // Col E: Unit
      { wch: 16 }, // Col F: Unit Rate (₹)
      { wch: 10 }, // Col G: GST %
      { wch: 18 }  // Col H: Line Amount (₹)
    ];

    // Page & Print Setup properties (A4 Portrait, Fit 1 Page Wide)
    (ws as any)['!pageSetup'] = {
      orientation: 'portrait',
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9 // A4
    };

    (ws as any)['!margins'] = {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    };

    const safeSheetName = `INV_${docNum}`.replace(/[:\\/?*\[\]]/g, "_").slice(0, 30);
    const safeFileName = `Tax_Invoice_${docNum}`.replace(/[:\\/?*\[\]]/g, "_");

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    XLSX.writeFile(wb, `${safeFileName}.xlsx`);
  } catch (err) {
    console.error("Failed to export Excel document:", err);
    alert("Failed to export Tax Invoice Excel document.");
  }
};
