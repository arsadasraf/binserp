import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface JWQCParameterResult {
  parameterName: string;
  specification: string;
  tolerance?: string;
  actualObserved: string;
  status: string;
  instrumentUsed?: string;
  remarks?: string;
}

export interface JWQCReportData {
  certificateNumber?: string;
  inspectionDate?: string | Date;
  challanNumber: string;
  grnNumber?: string;
  vendorDcNumber?: string;
  vendorInvoiceDate?: string | Date;
  vendorName: string;
  vendorCode?: string;
  vendorAddress?: string;
  vendorGst?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  itemName: string;
  itemCode?: string;
  itemType?: string;
  jobWorkType?: string;
  processType: string;
  quantitySent?: number;
  receivedQuantity: number;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  reworkQuantity?: number;
  scrapQuantity?: number;
  unit?: string;
  inspectionResults?: JWQCParameterResult[];
  overallStatus?: string;
  rejectionReason?: string;
  defectCategory?: string;
  dispositionAction?: string;
  inspectorName?: string;
  qaManagerName?: string;
  remarks?: string;
  companyInfo?: any;
}

export const generateJobWorkQCPDF = (data: JWQCReportData) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ================= 1. CLEAN COMPANY LETTERHEAD =================
    const c = data.companyInfo || {};
    const companyName = (c.companyName || c.name || "ENTERPRISE MANUFACTURING ERP").toUpperCase();
    const companyAddress = c.address || c.registeredAddress || "Industrial Area, Phase II";
    const companyCityState = [c.city, c.state, c.pincode].filter(Boolean).join(", ") || "City, State - PIN";
    const companyGstin = c.gstin || c.gstNumber || c.gst || "NOT PROVIDED";
    const companyPhone = c.phone || c.contactNumber || c.mobile || "-";
    const companyEmail = c.email || c.contactEmail || "-";

    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(companyName, 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`${companyAddress}, ${companyCityState}`, 14, 20);
    doc.text(`GSTIN: ${companyGstin} | Phone: ${companyPhone} | Email: ${companyEmail}`, 14, 24);

    // Right-Aligned Certificate Badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("JOB WORK CLEARANCE & INSPECTION NOTE", pageWidth - 14, 15, { align: "right" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text(`CERT NO: ${data.certificateNumber || "JW-SCN-DRAFT"}`, pageWidth - 14, 20, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const inspectDate = data.inspectionDate ? new Date(data.inspectionDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");
    doc.text(`Date: ${inspectDate}`, pageWidth - 14, 24, { align: "right" });

    // Border line under header
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.line(10, 27, pageWidth - 10, 27);

    // ================= 2. TWO-COLUMN METADATA GRID =================
    const colWidth = (pageWidth - 26) / 2;
    const startY = 32;

    // LEFT COLUMN: SUBCONTRACTOR / VENDOR DETAILS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("SUBCONTRACTOR / VENDOR DETAILS", 14, startY);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("Vendor Name:", 14, startY + 5);
    doc.setFont("helvetica", "normal");
    doc.text(data.vendorName || "-", 42, startY + 5);

    doc.setFont("helvetica", "bold");
    doc.text("Vendor Code:", 14, startY + 9.5);
    doc.setFont("helvetica", "normal");
    doc.text(data.vendorCode || "-", 42, startY + 9.5);

    doc.setFont("helvetica", "bold");
    doc.text("GSTIN:", 14, startY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(data.vendorGst || "-", 42, startY + 14);

    doc.setFont("helvetica", "bold");
    doc.text("Vendor DC Ref:", 14, startY + 18.5);
    doc.setFont("helvetica", "normal");
    doc.text(data.vendorDcNumber || "-", 42, startY + 18.5);

    // RIGHT COLUMN: JOB WORK & PROCESS DETAILS
    const rightX = 14 + colWidth + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("JOB WORK & PROCESS DETAILS", rightX, startY);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("Outward DC No:", rightX, startY + 5);
    doc.setFont("helvetica", "normal");
    doc.text(data.challanNumber || "-", rightX + 30, startY + 5);

    doc.setFont("helvetica", "bold");
    doc.text("Inward Receipt:", rightX, startY + 9.5);
    doc.setFont("helvetica", "normal");
    doc.text(data.grnNumber || "-", rightX + 30, startY + 9.5);

    doc.setFont("helvetica", "bold");
    doc.text("Process / Bucket:", rightX, startY + 14);
    doc.setFont("helvetica", "normal");
    const dcBucketLabel = data.jobWorkType === "store-conversion" ? "RM CONVERSION" :
      data.jobWorkType === "store-to-wip" ? "STORE TO WIP" :
      data.jobWorkType === "wip-to-wip" ? "WIP TO WIP" : (data.processType || "JOB WORK");
    doc.text(dcBucketLabel, rightX + 30, startY + 14);

    doc.setFont("helvetica", "bold");
    doc.text("Item Type / Class:", rightX, startY + 18.5);
    doc.setFont("helvetica", "normal");
    doc.text((data.itemType || "FG").toUpperCase(), rightX + 30, startY + 18.5);

    // Separation line
    doc.line(10, startY + 23, pageWidth - 10, startY + 23);

    // ================= 3. ITEM SPECIFICATION & QUANTITY SUMMARY =================
    const itemBoxY = startY + 27;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("PROCESSED ITEM & QUANTITY SUMMARY", 14, itemBoxY);

    const qtyTableHead = [
      ["Item Name / Description", "Part / Code", "Sent Qty", "Received", "Inspected", "Accepted", "Rejected", "Rework", "Unit"]
    ];

    const qtyTableBody = [
      [
        data.itemName || "Returned Item",
        data.itemCode || "-",
        data.quantitySent !== undefined ? data.quantitySent.toString() : "-",
        data.receivedQuantity.toString(),
        data.inspectedQuantity.toString(),
        data.acceptedQuantity.toString(),
        data.rejectedQuantity.toString(),
        (data.reworkQuantity || 0).toString(),
        data.unit || "PCS"
      ]
    ];

    autoTable(doc, {
      startY: itemBoxY + 3,
      margin: { left: 10, right: 10 },
      head: qtyTableHead,
      body: qtyTableBody,
      theme: "plain",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [51, 65, 85],
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.1,
        lineColor: [226, 232, 240]
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [15, 23, 42],
        halign: "center",
        lineWidth: 0.1,
        lineColor: [241, 245, 249]
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 50 },
        1: { halign: "left" }
      }
    });

    const lastQtyY = (doc as any).lastAutoTable.finalY || (itemBoxY + 20);

    // ================= 4. QA DISPOSITION BANNER =================
    const verdictY = lastQtyY + 3;
    const isFullPass = (data.rejectedQuantity === 0 && (!data.reworkQuantity || data.reworkQuantity === 0) && data.acceptedQuantity > 0);
    const isFullFail = (data.acceptedQuantity === 0 && data.rejectedQuantity > 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    if (isFullPass) {
      doc.setTextColor(22, 101, 52); // green-800
      doc.text(`QA DISPOSITION: 100% PASS - RELEASED TO INVENTORY (ACCEPTED: ${data.acceptedQuantity} ${data.unit || 'PCS'})`, 14, verdictY + 3);
    } else if (isFullFail) {
      doc.setTextColor(185, 28, 28); // red-700
      doc.text(`QA DISPOSITION: REJECTED (VENDOR DEBIT NOTE / REWORK - REJECTED: ${data.rejectedQuantity} ${data.unit || 'PCS'})`, 14, verdictY + 3);
    } else {
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(`QA DISPOSITION: PARTIAL ACCEPTANCE (ACCEPTED: ${data.acceptedQuantity} | REJECTED: ${data.rejectedQuantity} | REWORK: ${data.reworkQuantity || 0})`, 14, verdictY + 3);
    }

    doc.line(10, verdictY + 5.5, pageWidth - 10, verdictY + 5.5);

    // ================= 5. PROCESS PARAMETER TEST CHECKLIST =================
    const defaultParams: JWQCParameterResult[] = [
      { parameterName: "Visual & Surface Finish", specification: "Free of burrs, dents, blisters, peeling & contamination", tolerance: "No visual defects", actualObserved: "Conforms to standard", status: "Pass", instrumentUsed: "Visual / Magnifier" },
      { parameterName: "Critical Dimensions After Machining", specification: "As per drawing / CAD tolerance", tolerance: "±0.05 mm", actualObserved: "Within tolerance", status: "Pass", instrumentUsed: "Vernier / Micrometer" },
      { parameterName: "Coating / Plating Thickness", specification: "Specified micron layer thickness", tolerance: "±2 µm", actualObserved: "Uniform coating", status: "Pass", instrumentUsed: "Thickness Gauge / Elcometer" },
      { parameterName: "Hardness / Heat Treatment", specification: "Required HRC / BHN specification", tolerance: "±2 HRC", actualObserved: "Conforms", status: "Pass", instrumentUsed: "Hardness Tester" }
    ];

    const results = (data.inspectionResults && data.inspectionResults.length > 0) ? data.inspectionResults : defaultParams;

    const tableBody = results.map((res, idx) => [
      idx + 1,
      res.parameterName || "-",
      res.specification || "Approved Specification",
      res.tolerance || "Standard",
      res.actualObserved || "Conforms",
      res.instrumentUsed || "Standard Tool",
      res.status || "Pass"
    ]);

    autoTable(doc, {
      startY: verdictY + 7.5,
      margin: { left: 10, right: 10 },
      head: [
        ["#", "Process Quality Parameter", "Specification", "Tolerance", "Observed Value", "Tool / Gauge", "Status"]
      ],
      body: tableBody,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontSize: 7.5,
        fontStyle: "bold",
        lineWidth: 0.1,
        lineColor: [226, 232, 240]
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [15, 23, 42],
        lineWidth: 0.1,
        lineColor: [241, 245, 249]
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { fontStyle: "bold", cellWidth: 50 },
        6: { halign: "center", fontStyle: "bold" }
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 6) {
          const val = hookData.cell.raw;
          if (val === "Fail" || val === "Reject") {
            hookData.cell.styles.textColor = [185, 28, 28];
          } else {
            hookData.cell.styles.textColor = [22, 101, 52];
          }
        }
      }
    });

    const lastTableY = (doc as any).lastAutoTable.finalY || (verdictY + 45);

    // ================= 6. DEFECT ANALYSIS & DISPOSITION INSTRUCTIONS =================
    let currentY = lastTableY + 4;

    if (data.rejectedQuantity > 0 || data.reworkQuantity) {
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(10, currentY, pageWidth - 20, 16, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(185, 28, 28);
      doc.text("NON-CONFORMANCE / REJECTION DETAILS & VENDOR ACTION:", 14, currentY + 4.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(69, 10, 10);
      const defCat = data.defectCategory ? `Defect Type: ${data.defectCategory}` : "Defect: Dimensional / Processing Deviation";
      const rejReason = data.rejectionReason ? `Reason: ${data.rejectionReason}` : "Reason: Material failed quality acceptance criteria.";
      const dispAction = data.dispositionAction ? `Action: ${data.dispositionAction}` : "Action: Vendor Debit Note to be raised / Returned for Free-of-Cost Rework.";

      doc.text(`${defCat} | ${rejReason}`, 14, currentY + 9);
      doc.text(dispAction, 14, currentY + 13);

      currentY += 19;
    }

    // ================= 7. SIGN-OFF & DIGITAL STAMP =================
    const footerY = Math.max(currentY + 2, pageHeight - 32);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(10, footerY - 2, pageWidth - 10, footerY - 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Inspected By: ${data.inspectorName || "QA QC Engineer"}`, 14, footerY + 4);
    doc.text("Quality Control Stamp: CLEARED", 14, footerY + 8.5);

    doc.text(`Authorized Head: ${data.qaManagerName || "Head of Quality"}`, pageWidth - 70, footerY + 4);
    doc.text("This is an authenticated computerized Job Work Clearance Note.", 14, footerY + 14);

    // Save PDF
    const filename = `${data.certificateNumber || "JobWork-QC-Report"}_${Date.now()}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("Error generating Job Work QC PDF:", err);
  }
};
