import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { generateFrontendDcPDF, generateFrontendInvoicePDF } from "./frontendPdfHelper";
import { getCurrencySymbol, convertAmountToWords } from "./currencyHelper";

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

export const download4CopyPDF = (type: "dc" | "invoice", { doc, companyInfo, copyType = "all" }: DocumentOptions) => {
  try {
    if (!doc) {
      alert("No document data provided for PDF generation");
      return;
    }

    if (type === "dc") {
      generateFrontendDcPDF({ doc, companyInfo, copyType });
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
      const grandTotal = doc.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

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
    const grandTotal = dc.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

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
