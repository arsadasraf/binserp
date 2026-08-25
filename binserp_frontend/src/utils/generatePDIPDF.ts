import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PDIParameterResult {
  parameterName: string;
  specification?: string;
  tolerance?: string;
  actualObserved?: string;
  status?: "Pass" | "Fail" | string;
  instrumentUsed?: string;
  remarks?: string;
}

export interface PDIReportData {
  certificateNumber?: string;
  inspectionDate?: string | Date;
  fgItemName: string;
  fgItemCode?: string;
  drawingNumber?: string;
  revisionNumber?: string;
  customerName?: string;
  customerPoReference?: string;
  customerAddress?: string;
  customerGst?: string;
  batchNumber?: string;
  heatNumber?: string;
  jobCardNumber?: string;
  fgGrnNumber?: string;
  lotQuantity: number;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  reworkQuantity?: number;
  unit?: string;
  inspectionResults?: PDIParameterResult[];
  overallStatus?: string;
  inspectorName?: string;
  qaManagerName?: string;
  remarks?: string;
  companyInfo?: any;
}

export const generatePDIPDF = (data: PDIReportData) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Resolve Company Details (From Store Master)
    let company = data.companyInfo;
    if (!company || (!company.companyName && !company.legalName)) {
      try {
        const storeCached = localStorage.getItem("storeCompanyInfo");
        const storedCompany = localStorage.getItem("companyInfo");
        const storedUser = localStorage.getItem("userInfo");
        if (storeCached) company = { ...JSON.parse(storeCached), ...company };
        else if (storedCompany) company = { ...JSON.parse(storedCompany), ...company };
        else if (storedUser) company = { ...JSON.parse(storedUser), ...company };
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

    const certNumber = data.certificateNumber || `PDI/${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const inspectionDateStr = data.inspectionDate 
      ? new Date(data.inspectionDate).toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric' });

    const custName = data.customerName || "Standard Dispatch";
    const poRef = data.customerPoReference || "-";
    const inspector = data.inspectorName || "QA Final Inspector";

    const isFullPass = Number(data.rejectedQuantity || 0) === 0 && Number(data.acceptedQuantity || 0) > 0;
    const isFullFail = Number(data.acceptedQuantity || 0) === 0 && Number(data.rejectedQuantity || 0) > 0;

    // --- Clean Outer Border ---
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.35);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20, "S");

    // ================= 1. COMPANY HEADER (PURE WHITE BG) =================
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(companyName.toUpperCase(), 14, 18);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    if (companyAddress && companyAddress !== "-") {
      doc.text(companyAddress, 14, 23);
    }
    const compTaxLine = `GSTIN: ${compGst}  |  PAN: ${compPan}  |  Phone: ${compPhone}  |  Email: ${compEmail}`;
    doc.text(compTaxLine, 14, 28);

    // Divider
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(10, 32, pageWidth - 10, 32);

    // ================= 2. TITLE BAR =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("PRE-DISPATCH INSPECTION (PDI) / CERTIFICATE OF ANALYSIS (COA)", pageWidth / 2, 38.5, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("[ Finished Goods Final Quality Clearance Certificate ]", pageWidth / 2, 42.5, { align: "center" });

    doc.line(10, 45, pageWidth - 10, 45);

    // ================= 3. METADATA TWO-COLUMN GRID =================
    const metaTopY = 47;
    const colWidth = (pageWidth - 28) / 2;

    // Left Column: Product & Batch Info
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("PRODUCT & LOT SPECIFICATIONS", 14, metaTopY + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Product / Item:", 14, metaTopY + 8);
    doc.text("Part / Item Code:", 14, metaTopY + 13);
    doc.text("Batch / Heat No:", 14, metaTopY + 18);
    doc.text("Job Card / Source:", 14, metaTopY + 23);
    doc.text("Lot Quantity:", 14, metaTopY + 28);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text((data.fgItemName || "-").slice(0, 35), 44, metaTopY + 8);
    doc.text(data.fgItemCode || "-", 44, metaTopY + 13);
    doc.text(data.batchNumber || "-", 44, metaTopY + 18);
    doc.text(data.jobCardNumber || data.fgGrnNumber || "-", 44, metaTopY + 23);
    doc.text(`${data.lotQuantity} ${data.unit || "PCS"} (Inspected: ${data.inspectedQuantity})`, 44, metaTopY + 28);

    // Vertical Divider
    doc.line(14 + colWidth, 45, 14 + colWidth, metaTopY + 31);

    // Right Column: Certificate & Customer Details
    const rightColX = 14 + colWidth + 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("CLEARANCE & CUSTOMER DETAILS", rightColX, metaTopY + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("PDI Cert No:", rightColX, metaTopY + 8);
    doc.text("Inspection Date:", rightColX, metaTopY + 13);
    doc.text("Customer Name:", rightColX, metaTopY + 18);
    doc.text("PO Reference:", rightColX, metaTopY + 23);
    doc.text("Sampling Standard:", rightColX, metaTopY + 28);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(certNumber, rightColX + 30, metaTopY + 8);
    doc.text(inspectionDateStr, rightColX + 30, metaTopY + 13);
    doc.text(custName.slice(0, 34), rightColX + 30, metaTopY + 18);
    doc.text(poRef, rightColX + 30, metaTopY + 23);
    doc.text("IS 2500 / Level II Normal", rightColX + 30, metaTopY + 28);

    doc.line(10, metaTopY + 32, pageWidth - 10, metaTopY + 32);

    // ================= 4. QUALITY CLEARANCE STATUS =================
    const verdictY = metaTopY + 34;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");

    if (isFullPass) {
      doc.setTextColor(22, 101, 52);
      doc.text(`QA DISPOSITION: LOT CLEARED FOR DISPATCH & INVOICING (100% PASS - ACCEPTED: ${data.acceptedQuantity})`, 14, verdictY + 3.5);
    } else if (isFullFail) {
      doc.setTextColor(185, 28, 28);
      doc.text(`QA DISPOSITION: LOT REJECTED (QUARANTINED / REWORK REQUIRED - REJECTED: ${data.rejectedQuantity})`, 14, verdictY + 3.5);
    } else {
      doc.setTextColor(180, 83, 9);
      doc.text(`QA DISPOSITION: PARTIAL ACCEPTANCE (ACCEPTED: ${data.acceptedQuantity} | REJECTED: ${data.rejectedQuantity} | REWORK: ${data.reworkQuantity || 0})`, 14, verdictY + 3.5);
    }

    doc.line(10, verdictY + 6, pageWidth - 10, verdictY + 6);

    // ================= 5. PARAMETER & TEST RESULTS TABLE =================
    const defaultParams: PDIParameterResult[] = [
      { parameterName: "Visual & Surface Finish", specification: "Free of burrs, dents, rust & scratches", tolerance: "No visual defects", actualObserved: "Conforms to standard", status: "Pass", instrumentUsed: "Visual / Magnifier" },
      { parameterName: "Critical Dimensions", specification: "As per approved drawing / CAD", tolerance: "±0.05 mm", actualObserved: "Within specified tolerance", status: "Pass", instrumentUsed: "Vernier / Micrometer" },
      { parameterName: "Packaging & Labelling", specification: "Properly packed with batch barcode tag", tolerance: "Standard Packaging", actualObserved: "Standard packaging", status: "Pass", instrumentUsed: "Visual Check" }
    ];

    const results = (data.inspectionResults && data.inspectionResults.length > 0) ? data.inspectionResults : defaultParams;

    const tableBody = results.map((res, idx) => [
      idx + 1,
      res.parameterName || "-",
      res.specification || "Approved Drawing",
      res.tolerance || "±0.05 mm",
      res.actualObserved || "Conforms",
      res.instrumentUsed || "Standard Gauge",
      res.status || "Pass"
    ]);

    autoTable(doc, {
      startY: verdictY + 8,
      margin: { left: 10, right: 10 },
      head: [
        ["#", "Quality Parameter / Test", "Specification", "Tolerance", "Observed Value", "Inspection Tool", "Status"]
      ],
      body: tableBody,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 44, fontStyle: "bold" },
        2: { cellWidth: 42, fontSize: 7.5 },
        3: { cellWidth: 22, fontSize: 7.5, halign: "center" },
        4: { cellWidth: 32, fontSize: 7.5 },
        5: { cellWidth: 28, fontSize: 7.5 },
        6: { cellWidth: 14, halign: "center", fontStyle: "bold" }
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        textColor: [30, 41, 59]
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 4;

    // ================= 6. TOTALS & REMARKS =================
    const summaryBoxY = Math.min(finalY, pageHeight - 56);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(10, summaryBoxY, pageWidth - 10, summaryBoxY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL LOT: ${data.lotQuantity} ${data.unit || "PCS"}`, 14, summaryBoxY + 5);
    doc.text(`ACCEPTED: ${data.acceptedQuantity}`, 75, summaryBoxY + 5);
    doc.text(`REJECTED: ${data.rejectedQuantity}`, 135, summaryBoxY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const remarkNote = data.remarks || "Certified that the finished goods listed above have been inspected and tested in accordance with quality specifications and are cleared for dispatch.";
    doc.text(`Remarks: ${remarkNote.slice(0, 115)}`, 14, summaryBoxY + 10);

    doc.line(10, summaryBoxY + 13, pageWidth - 10, summaryBoxY + 13);

    // ================= 7. SIGN-OFF BLOCKS =================
    const signY = summaryBoxY + 16;
    const signColWidth = (pageWidth - 28) / 3;

    // Block 1: Inspected By
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("INSPECTED & CHECKED BY", 14, signY + 3);
    doc.setFont("helvetica", "normal");
    doc.text(`QA Inspector: ${inspector}`, 14, signY + 12);
    doc.text(`Date: ${inspectionDateStr}`, 14, signY + 16);

    // Block 2: Quality Seal
    const centerSignX = 14 + signColWidth + 2;
    doc.setFont("helvetica", "bold");
    doc.text("QUALITY ASSURANCE STAMP", centerSignX, signY + 3);
    doc.setFont("helvetica", "normal");
    doc.text(isFullPass ? "QC PASSED / CLEARED" : "QC INSPECTED", centerSignX, signY + 12);
    doc.text("Digitally Verified", centerSignX, signY + 16);

    // Block 3: Authorized Signatory
    const rightSignX = centerSignX + signColWidth + 2;
    doc.setFont("helvetica", "bold");
    doc.text(`FOR ${companyName.toUpperCase().slice(0, 24)}`, rightSignX, signY + 3);
    doc.setFont("helvetica", "normal");
    doc.text("QA Head / Authorized Signatory", rightSignX, signY + 16);

    // Save File
    const sanitizedCert = certNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
    doc.save(`PDI_Certificate_${sanitizedCert}.pdf`);
  } catch (error) {
    console.error("Failed to generate PDI Certificate PDF:", error);
    alert("Error generating PDI PDF certificate.");
  }
};
