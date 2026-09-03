import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ProcessRoutePDFData {
  item: {
    _id?: string;
    name: string;
    code?: string;
    type?: string;
    unit?: string;
    revisionNumber?: string;
    description?: string;
    bom?: Array<{
      item?: any;
      itemName?: string;
      itemType?: string;
      quantity?: number;
      unit?: string;
    }>;
    ppcProduct?: {
      routing?: Array<{
        sequence?: number;
        stepName?: string;
        processName?: string;
        process?: any;
        processType?: string;
        isOutsourced?: boolean;
        machine?: any;
        workstation?: any;
        setupTime?: number;
        cycleTime?: number;
        supplier?: any;
        supplierName?: string;
        leadTimeDays?: number;
        jobWorkRate?: number;
        outsideInstructions?: string;
        description?: string;
        qcRequired?: boolean;
        qcStage?: string;
        isMandatoryPass?: boolean;
        inspectionParameters?: Array<{
          parameterName: string;
          specification?: string;
          tolerance?: string;
          method?: string;
          sampleSize?: string;
          mandatory?: boolean;
        }>;
        bomRequirements?: Array<{
          itemName?: string;
          quantity?: number;
          unit?: string;
          scrapPercentage?: number;
        }>;
        photos?: any[];
        documents?: any[];
      }>;
    };
  };
  companyInfo?: any;
}

export const generateProcessRoutePDF = (data: ProcessRoutePDFData) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const { item, companyInfo } = data;
    const routing = item.ppcProduct?.routing || [];
    const bom = item.bom || [];

    // ================= 1. HEADER & LETTERHEAD =================
    const c = companyInfo || {};
    const companyName = (c.companyName || c.name || "BINS ERP MANUFACTURING").toUpperCase();
    const companyAddress = c.address || c.registeredAddress || "Manufacturing Plant & Production Facility";
    const companyPhone = c.phone || c.mobile || "";
    const companyEmail = c.email || "";
    const companyGst = c.gstin || c.gstNumber || "";

    // Dark Navy Header Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName, 14, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(companyAddress, 14, 17);

    const contactParts = [
      companyPhone ? `Tel: ${companyPhone}` : "",
      companyEmail ? `Email: ${companyEmail}` : "",
      companyGst ? `GSTIN: ${companyGst}` : "",
    ].filter(Boolean).join(" | ");
    if (contactParts) {
      doc.text(contactParts, 14, 22);
    }

    // Document Title Tag
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.roundedRect(pageWidth - 68, 6, 54, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("PROCESS ROUTE SHEET", pageWidth - 41, 13, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("Standard Manufacturing Plan", pageWidth - 41, 18, { align: "center" });

    // ================= 2. ITEM DETAILS CARD =================
    const startY = 34;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, startY, pageWidth - 28, 24, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Item / Component:", 18, startY + 6);
    doc.setFont("helvetica", "normal");
    doc.text(item.name || "N/A", 52, startY + 6);

    doc.setFont("helvetica", "bold");
    doc.text("Item Code:", 18, startY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(item.code || "N/A", 52, startY + 12);

    doc.setFont("helvetica", "bold");
    doc.text("Item Type:", 18, startY + 18);
    doc.setFont("helvetica", "normal");
    doc.text(item.type || "Component", 52, startY + 18);

    // Right Column in Item Card
    const midX = 118;
    doc.setFont("helvetica", "bold");
    doc.text("Base Unit:", midX, startY + 6);
    doc.setFont("helvetica", "normal");
    doc.text(item.unit || "Nos", midX + 30, startY + 6);

    doc.setFont("helvetica", "bold");
    doc.text("Total Steps:", midX, startY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(`${routing.length} Operations`, midX + 30, startY + 12);

    doc.setFont("helvetica", "bold");
    doc.text("Generated On:", midX, startY + 18);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), midX + 30, startY + 18);

    let currentY = startY + 28;

    // ================= 3. MANUFACTURING ROUTE SEQUENCE TABLE =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("1. MANUFACTURING PROCESS ROUTE SEQUENCE", 14, currentY + 3);

    const routeTableHeaders = [
      "Seq",
      "Process Name",
      "Type",
      "Workstation / Machine / Vendor",
      "Setup (m)",
      "Cycle (m)",
      "Rate/Lead",
      "QC Req.",
    ];

    const routeTableRows = routing.map((r, idx) => {
      const isOut = r.processType === "Outside" || r.isOutsourced;
      const processName = r.processName || (r.process && r.process.processName) || r.stepName || "Process";
      const machineName = r.machine?.machineName || r.machine?.name || "";
      const wsName = r.workstation?.workstationName || r.workstation?.name || "";
      const supplierName = r.supplier?.name || r.supplierName || "";

      let location = "";
      if (isOut) {
        location = supplierName ? `Job Work: ${supplierName}` : "Subcontracted";
      } else {
        location = [wsName, machineName].filter(Boolean).join(" / ") || "Shop Floor";
      }

      const timeRate = isOut
        ? `${r.leadTimeDays || 1}d / Rs.${r.jobWorkRate || 0}`
        : `${r.cycleTime || 0}m`;

      return [
        r.sequence || (idx + 1) * 10,
        processName,
        isOut ? "OUTSIDE" : "INSIDE",
        location,
        isOut ? "-" : `${r.setupTime || 0}`,
        isOut ? "-" : `${r.cycleTime || 0}`,
        timeRate,
        r.qcRequired ? `YES (${r.qcStage || "In-Proc"})` : "No",
      ];
    });

    autoTable(doc, {
      startY: currentY + 6,
      head: [routeTableHeaders],
      body: routeTableRows.length > 0 ? routeTableRows : [["-", "No process routing steps configured.", "-", "-", "-", "-", "-", "-"]],
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 38 },
        2: { halign: "center", cellWidth: 18 },
        3: { cellWidth: 50 },
        4: { halign: "center", cellWidth: 16 },
        5: { halign: "center", cellWidth: 16 },
        6: { halign: "center", cellWidth: 20 },
        7: { halign: "center", cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // ================= 4. QUALITY CONTROL (QC) PARAMETERS CHECKLIST =================
    const qcSteps = routing.filter((r) => r.qcRequired && r.inspectionParameters && r.inspectionParameters.length > 0);

    if (qcSteps.length > 0) {
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("2. QUALITY INSPECTION CHECKLIST & PARAMETERS", 14, currentY + 3);

      const qcHeaders = [
        "Seq",
        "Process",
        "Stage",
        "Inspection Parameter",
        "Nominal Spec",
        "Tolerance",
        "Method / Tool",
        "Sample",
        "Hold",
      ];

      const qcRows: any[] = [];
      qcSteps.forEach((step, sIdx) => {
        const pName = step.processName || (step.process && step.process.processName) || `Step ${sIdx + 1}`;
        (step.inspectionParameters || []).forEach((param: any) => {
          qcRows.push([
            step.sequence || (sIdx + 1) * 10,
            pName,
            step.qcStage || "In-Proc",
            param.parameterName,
            param.specification || "-",
            param.tolerance || "-",
            param.method || "-",
            param.sampleSize || "100%",
            param.mandatory !== false ? "YES" : "No",
          ]);
        });
      });

      autoTable(doc, {
        startY: currentY + 6,
        head: [qcHeaders],
        body: qcRows,
        theme: "striped",
        headStyles: {
          fillColor: [5, 150, 105], // emerald-600
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 26 },
          2: { halign: "center", cellWidth: 18 },
          3: { cellWidth: 38 },
          4: { halign: "center", cellWidth: 22 },
          5: { halign: "center", cellWidth: 20 },
          6: { cellWidth: 26 },
          7: { halign: "center", cellWidth: 16 },
          8: { halign: "center", cellWidth: 12 },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // ================= 5. BASE BILL OF MATERIALS (BOM) =================
    if (bom.length > 0) {
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("3. BILL OF MATERIALS (BOM)", 14, currentY + 3);

      const bomHeaders = ["#", "Item Name", "Item Type", "Required Qty / Piece", "Unit"];
      const bomRows = bom.map((b, idx) => [
        idx + 1,
        b.item?.name || b.itemName || "Material",
        b.itemType || "Material",
        b.quantity || 1,
        b.unit || "Nos",
      ]);

      autoTable(doc, {
        startY: currentY + 6,
        head: [bomHeaders],
        body: bomRows,
        theme: "striped",
        headStyles: {
          fillColor: [71, 85, 105], // slate-600
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { cellWidth: 80 },
          2: { halign: "center", cellWidth: 35 },
          3: { halign: "center", cellWidth: 35 },
          4: { halign: "center", cellWidth: 26 },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // ================= 6. SIGN-OFF BLOCK =================
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }

    const signY = Math.max(currentY + 6, pageHeight - 28);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, signY, 60, signY);
    doc.line(78, signY, 128, signY);
    doc.line(146, signY, pageWidth - 14, signY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Prepared By (Production Eng.)", 14, signY + 4);
    doc.text("Verified By (Quality Head)", 78, signY + 4);
    doc.text("Approved By (Plant Head)", 146, signY + 4);

    // Save PDF
    const filename = `Process_Route_${(item.code || item.name || "Item").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Failed to generate Process Route PDF:", error);
    alert("Failed to generate Process Route PDF");
  }
};
