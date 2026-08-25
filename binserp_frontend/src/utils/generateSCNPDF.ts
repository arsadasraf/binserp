import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SCNItemData {
  materialName: string;
  materialCode?: string;
  unit?: string;
  batchNumber?: string;
  receivedQuantity: number;
  inspectedQuantity?: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  rejectionReason?: string;
  defectCategory?: string;
  disposition?: string;
  overallStatus?: string;
  remarks?: string;
}

export interface SCNReportData {
  scnNumber?: string;
  inspectionDate?: string | Date;
  grnNumber?: string;
  grnDate?: string | Date;
  poReference?: string;
  poDate?: string | Date;
  invoiceNumber?: string;
  challanNumber?: string;
  
  // Vendor / Supplier details
  supplierName?: string;
  supplierCode?: string;
  supplierAddress?: string;
  supplierCityState?: string;
  supplierGst?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  customerName?: string;

  inspectorName?: string;
  items: SCNItemData[];
  overallRemarks?: string;
  companyInfo?: any;
}

export const generateSCNPDF = (data: SCNReportData) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Resolve Master Company Details (Store Master Company Info)
    let company = data.companyInfo;
    if (!company || (!company.companyName && !company.legalName)) {
      try {
        const storeCached = localStorage.getItem("storeCompanyInfo");
        const storedCompany = localStorage.getItem("companyInfo");
        const storedUser = localStorage.getItem("userInfo");
        if (storeCached) {
          company = { ...JSON.parse(storeCached), ...company };
        } else if (storedCompany) {
          company = { ...JSON.parse(storedCompany), ...company };
        } else if (storedUser) {
          company = { ...JSON.parse(storedUser), ...company };
        }
      } catch (e) {
        console.warn("Could not parse cached company info:", e);
      }
    }

    const companyName = company?.companyName || company?.legalName || company?.tradeName || company?.name || "ENTERPRISE MANUFACTURING ERP";
    const compAddressRaw = company?.billingAddress || company?.address || company?.shippingAddress || company?.location || "";
    const compCityState = [company?.city, company?.district, company?.state, company?.pincode ? `- ${company.pincode}` : ""].filter(Boolean).join(" ");
    const companyAddress = [compAddressRaw, compCityState].filter(Boolean).join(", ");
    const compGst = company?.gstNumber || company?.gstin || company?.gst || "-";
    const compPan = company?.panNumber || company?.pan || "-";
    const compEmail = company?.email || "-";
    const compPhone = company?.contactNumber || company?.phone || company?.mobile || "-";

    // 2. Resolve SCN Document Details
    const rawGrn = data.grnNumber || "GRN-LOT";
    const scnNumber = data.scnNumber || `SCN/${rawGrn.replace(/^(GRN-CON\/|GRN-RM\/|GRN-BO\/|GRN-FG\/|GRN-)/, '') || new Date().toISOString().slice(2,10).replace(/-/g,'')}`;
    
    const inspectionDateStr = data.inspectionDate 
      ? new Date(data.inspectionDate).toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const grnDateStr = data.grnDate 
      ? new Date(data.grnDate).toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' })
      : "-";

    // 3. Resolve Vendor Details
    const vendorName = data.supplierName || data.customerName || "Vendor / Supplier";
    const vendorCode = data.supplierCode || "-";
    const vendorAddress = data.supplierAddress || "-";
    const vendorGst = data.supplierGst || "-";
    const vendorPhone = data.supplierPhone || "-";
    const vendorEmail = data.supplierEmail || "-";

    const poRef = data.poReference || "-";
    const inspectorName = data.inspectorName || "QA Incharge";

    // Quantities Calculation
    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;

    data.items.forEach(item => {
      totalReceived += Number(item.receivedQuantity || 0);
      totalAccepted += Number(item.acceptedQuantity || 0);
      totalRejected += Number(item.rejectedQuantity || 0);
    });

    const isFullPass = totalRejected === 0 && totalAccepted > 0;
    const isFullFail = totalAccepted === 0 && totalRejected > 0;
    const isPartial = totalAccepted > 0 && totalRejected > 0;

    // --- Outer Clean Border (No background color) ---
    doc.setDrawColor(30, 41, 59); // slate-800
    doc.setLineWidth(0.35);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20, "S");

    // ================= 1. COMPANY HEADER (PURE WHITE BG) =================
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(companyName.toUpperCase(), 14, 18);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105); // slate-600

    if (companyAddress && companyAddress !== "-") {
      doc.text(companyAddress, 14, 23);
    }
    const compTaxLine = `GSTIN: ${compGst}  |  PAN: ${compPan}  |  Phone: ${compPhone}  |  Email: ${compEmail}`;
    doc.text(compTaxLine, 14, 28);

    // Horizontal Divider
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.line(10, 32, pageWidth - 10, 32);

    // ================= 2. TITLE BAR =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("STORE CREDIT NOTE (SCN) / STORE CLEARANCE NOTE", pageWidth / 2, 38.5, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("[ Inward Goods Quality Inspection & Store Receipt Voucher ]", pageWidth / 2, 42.5, { align: "center" });

    doc.line(10, 45, pageWidth - 10, 45);

    // ================= 3. METADATA TWO-COLUMN GRID =================
    const metaTopY = 47;
    const colWidth = (pageWidth - 28) / 2;

    // Left Column: SCN & Inward Details
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("DOCUMENT & INWARD DETAILS", 14, metaTopY + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("SCN No:", 14, metaTopY + 8);
    doc.text("SCN Date:", 14, metaTopY + 13);
    doc.text("GRN Inward No:", 14, metaTopY + 18);
    doc.text("Inward Date:", 14, metaTopY + 23);
    doc.text("PO Reference:", 14, metaTopY + 28);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(scnNumber, 44, metaTopY + 8);
    doc.text(inspectionDateStr, 44, metaTopY + 13);
    doc.text(rawGrn, 44, metaTopY + 18);
    doc.text(grnDateStr, 44, metaTopY + 23);
    doc.text(poRef, 44, metaTopY + 28);

    // Vertical Divider
    doc.line(14 + colWidth, 45, 14 + colWidth, metaTopY + 31);

    // Right Column: Vendor / Supplier Details
    const rightColX = 14 + colWidth + 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("VENDOR / SUPPLIER DETAILS", rightColX, metaTopY + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Vendor Name:", rightColX, metaTopY + 8);
    doc.text("Vendor Code:", rightColX, metaTopY + 13);
    doc.text("Address:", rightColX, metaTopY + 18);
    doc.text("GSTIN / Tax ID:", rightColX, metaTopY + 23);
    doc.text("Contact:", rightColX, metaTopY + 28);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(vendorName.slice(0, 36), rightColX + 28, metaTopY + 8);
    doc.text(vendorCode, rightColX + 28, metaTopY + 13);
    doc.text(vendorAddress !== "-" ? vendorAddress.slice(0, 38) : "-", rightColX + 28, metaTopY + 18);
    doc.text(vendorGst, rightColX + 28, metaTopY + 23);
    doc.text(vendorPhone !== "-" ? vendorPhone : (vendorEmail !== "-" ? vendorEmail : "-"), rightColX + 28, metaTopY + 28);

    doc.line(10, metaTopY + 32, pageWidth - 10, metaTopY + 32);

    // ================= 4. QUALITY VERDICT STRIP (NO SOLID FILL) =================
    const verdictY = metaTopY + 34;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");

    if (isFullPass) {
      doc.setTextColor(22, 101, 52); // green
      doc.text(`INSPECTION VERDICT: ALL ITEMS CLEARED & ACCEPTED FOR STORE (100% PASS)`, 14, verdictY + 3.5);
    } else if (isFullFail) {
      doc.setTextColor(185, 28, 28); // red
      doc.text(`INSPECTION VERDICT: ALL ITEMS REJECTED (QUARANTINED - STORE CREDIT NOTE RAISED)`, 14, verdictY + 3.5);
    } else {
      doc.setTextColor(180, 83, 9); // amber
      doc.text(`INSPECTION VERDICT: PARTIALLY ACCEPTED (ACCEPTED: ${totalAccepted} | REJECTED: ${totalRejected})`, 14, verdictY + 3.5);
    }

    doc.line(10, verdictY + 6, pageWidth - 10, verdictY + 6);

    // ================= 5. ITEMIZED TABLE =================
    const tableBody = data.items.map((item, idx) => {
      const rec = Number(item.receivedQuantity || 0);
      const acc = Number(item.acceptedQuantity || 0);
      const rej = Number(item.rejectedQuantity || 0);
      const reason = item.rejectionReason || item.remarks || (rej > 0 ? "Quality Variance" : "Meets Standard");
      const disp = rej > 0 ? (acc > 0 ? "Debit / Return Rejections" : "Full Return to Supplier") : "Accepted into Store";

      return [
        idx + 1,
        item.materialName || "-",
        item.unit || "PCS",
        rec,
        acc,
        rej > 0 ? rej : "0",
        reason,
        disp
      ];
    });

    autoTable(doc, {
      startY: verdictY + 8,
      margin: { left: 10, right: 10 },
      head: [
        ["#", "Material / Item Description", "Unit", "Received", "Accepted", "Rejected", "Reason / Defect Observation", "Disposition Action"]
      ],
      body: tableBody,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249], // slate-100
        textColor: [15, 23, 42], // slate-900
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 50, fontStyle: "bold" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        6: { cellWidth: 36, fontSize: 7.5 },
        7: { cellWidth: 28, fontSize: 7.5 }
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        textColor: [30, 41, 59]
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 4;

    // ================= 6. TOTALS SUMMARY ROW =================
    const summaryBoxY = Math.min(finalY, pageHeight - 56);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(10, summaryBoxY, pageWidth - 10, summaryBoxY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL RECEIVED: ${totalReceived}`, 14, summaryBoxY + 5);
    doc.text(`TOTAL ACCEPTED: ${totalAccepted} (${totalReceived > 0 ? ((totalAccepted / totalReceived) * 100).toFixed(1) : 0}%)`, 72, summaryBoxY + 5);
    doc.text(`TOTAL REJECTED: ${totalRejected} (${totalReceived > 0 ? ((totalRejected / totalReceived) * 100).toFixed(1) : 0}%)`, 135, summaryBoxY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const remarkNote = data.overallRemarks || (totalRejected > 0 ? "Rejected quantities are deducted from inward credit and debited against the vendor invoice/challan." : "All received goods verified and posted to store inventory.");
    doc.text(`Note: ${remarkNote.slice(0, 115)}`, 14, summaryBoxY + 10);

    doc.line(10, summaryBoxY + 13, pageWidth - 10, summaryBoxY + 13);

    // ================= 7. SIGN-OFF & AUTHORIZATION BLOCKS =================
    const signY = summaryBoxY + 16;
    const signColWidth = (pageWidth - 28) / 3;

    // Block 1: Inspected By
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("INSPECTED & CHECKED BY", 14, signY + 3);
    doc.setFont("helvetica", "normal");
    doc.text(`Inspector: ${inspectorName}`, 14, signY + 12);
    doc.text(`Date: ${inspectionDateStr}`, 14, signY + 16);

    // Block 2: Store Incharge
    const centerSignX = 14 + signColWidth + 2;
    doc.setFont("helvetica", "bold");
    doc.text("STORE RECEIPT VERIFICATION", centerSignX, signY + 3);
    doc.setFont("helvetica", "normal");
    doc.text("Store Department", centerSignX, signY + 12);
    doc.text("Stock Updated in ERP", centerSignX, signY + 16);

    // Block 3: Authorized Signatory
    const rightSignX = centerSignX + signColWidth + 2;
    doc.setFont("helvetica", "bold");
    doc.text(`FOR ${companyName.toUpperCase().slice(0, 24)}`, rightSignX, signY + 3);
    doc.setFont("helvetica", "normal");
    doc.text("Authorized QA Signatory", rightSignX, signY + 16);

    // Save PDF
    const sanitizedGrn = rawGrn.replace(/[^a-zA-Z0-9-_]/g, '_');
    doc.save(`SCN_${sanitizedGrn}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("Failed to generate SCN PDF:", error);
    alert("Error generating SCN PDF. Please verify document details.");
  }
};
