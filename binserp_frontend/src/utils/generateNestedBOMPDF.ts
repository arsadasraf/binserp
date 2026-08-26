import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface NestedBOMPDFData {
  mrpNumber: string;
  customerName?: string;
  customerPoNumber?: string;
  targetDate?: string | Date;
  status?: string;
  fgItems: Array<{
    fgItemName: string;
    fgItemCode?: string;
    bomNumber?: string;
    quantity: number;
    receivedQuantity?: number;
    unit?: string;
    nestedMaterials?: Array<{
      materialName: string;
      materialCode?: string;
      itemType?: string;
      category?: string;
      level?: number;
      quantityPerFG?: number;
      totalRequired?: number;
      requiredQuantity?: number;
      currentPhysicalStock?: number;
      totalInTransitPO?: number;
      netShortage?: number;
      unit?: string;
      bestVendor?: {
        vendorName?: string;
        rate?: number;
      };
      estimatedRate?: number;
      estimatedValue?: number;
    }>;
  }>;
  companyInfo?: any;
}

export const generateNestedBOMPDF = (data: NestedBOMPDFData) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ================= 1. COMPANY LETTERHEAD =================
    const c = data.companyInfo || {};
    const companyName = (c.companyName || c.name || "BINS ERP MANUFACTURING").toUpperCase();
    const companyAddress = c.address || c.registeredAddress || "Industrial Manufacturing Complex";
    const companyPhone = c.phone || c.mobile || "";
    const companyEmail = c.email || "";
    const companyGst = c.gstin || c.gstNumber || "";

    // Header Background Accent Bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName, 14, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(companyAddress, 14, 18);

    const contactStr = [
      companyPhone ? `Tel: ${companyPhone}` : "",
      companyEmail ? `Email: ${companyEmail}` : "",
      companyGst ? `GSTIN: ${companyGst}` : ""
    ].filter(Boolean).join(" | ");
    if (contactStr) {
      doc.text(contactStr, 14, 23);
    }

    // Header Right: Document Title Badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129); // emerald-400
    doc.text("MULTI-LEVEL NESTED BOM REPORT", pageWidth - 14, 12, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`MRP Ref: ${data.mrpNumber}`, pageWidth - 14, 18, { align: "right" });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 23, { align: "right" });

    // ================= 2. MRP DEMAND METADATA CARD =================
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 33, pageWidth - 28, 22, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("MRP PLAN NUMBER:", 18, 39);
    doc.text("CUSTOMER NAME:", 18, 45);
    doc.text("CUSTOMER PO REF:", 18, 51);

    doc.setTextColor(15, 23, 42);
    doc.text(data.mrpNumber || "-", 60, 39);
    doc.text(data.customerName || "Internal Demand", 60, 45);
    doc.text(data.customerPoNumber || "-", 60, 51);

    doc.setTextColor(100, 116, 139);
    doc.text("TARGET DELIVERY DATE:", 115, 39);
    doc.text("PLAN STATUS:", 115, 45);
    doc.text("TOTAL FG ITEMS:", 115, 51);

    doc.setTextColor(15, 23, 42);
    const targetDateStr = data.targetDate ? new Date(data.targetDate).toLocaleDateString('en-GB') : "-";
    doc.text(targetDateStr, 165, 39);
    doc.text(data.status || "Planned", 165, 45);
    doc.text(`${(data.fgItems || []).length} Finished Goods`, 165, 51);

    let startY = 60;

    // ================= 3. MULTI-LEVEL BOM TABLES PER FG =================
    (data.fgItems || []).forEach((fg, fgIdx) => {
      // FG Item Header Strip
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, startY, pageWidth - 28, 8, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Assembly [Level 1]: ${fg.fgItemName} ${fg.fgItemCode ? `(${fg.fgItemCode})` : ""} - Target: ${fg.quantity} ${fg.unit || "PCS"} (BOM: ${fg.bomNumber || "Active"})`,
        18,
        startY + 5.5
      );

      startY += 10;

      // Table Rows
      const tableRows = (fg.nestedMaterials || []).map((m) => {
        const level = m.level || 2;
        const indentStr = "  ".repeat(Math.max(0, level - 2));
        const prefix = level > 1 ? `${indentStr}↳ ` : "";
        const nameWithIndent = `${prefix}${m.materialName}`;

        const reqQty = Number(m.totalRequired ?? m.requiredQuantity ?? 0);
        const liveStock = Number(m.currentPhysicalStock ?? 0);
        const inTransit = Number(m.totalInTransitPO ?? 0);
        const shortage = Number(m.netShortage ?? Math.max(0, reqQty - liveStock - inTransit));
        const rate = Number(m.bestVendor?.rate ?? m.estimatedRate ?? 0);
        const val = shortage * rate;

        return [
          `L${level}`,
          nameWithIndent,
          m.materialCode || "-",
          m.itemType || "RM",
          `${m.quantityPerFG || 1}`,
          `${reqQty} ${m.unit || "PCS"}`,
          `${liveStock} ${m.unit || "PCS"}`,
          inTransit > 0 ? `${inTransit}` : "-",
          shortage > 0 ? `${shortage}` : "Covered",
          rate > 0 ? `₹${rate.toFixed(2)}` : "-",
          val > 0 ? `₹${val.toFixed(2)}` : "-"
        ];
      });

      autoTable(doc, {
        startY: startY,
        head: [[
          "Lvl",
          "Component / Material Name",
          "Code",
          "Type",
          "Per FG",
          "Total Req",
          "Live Stock",
          "In-Transit",
          "Shortage",
          "Rate",
          "Est Value"
        ]],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "left"
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [15, 23, 42]
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 42 },
          2: { cellWidth: 20 },
          3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 12, halign: "center" },
          5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          6: { cellWidth: 16, halign: "center" },
          7: { cellWidth: 14, halign: "center" },
          8: { cellWidth: 16, halign: "center", fontStyle: "bold", textColor: [220, 38, 38] },
          9: { cellWidth: 12, halign: "right" },
          10: { cellWidth: 14, halign: "right", fontStyle: "bold" }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section === "body") {
            // Highlight shortage cells
            if (data.column.index === 8) {
              const val = String(data.cell.raw);
              if (val !== "Covered" && val !== "-") {
                data.cell.styles.textColor = [220, 38, 38]; // red
              } else {
                data.cell.styles.textColor = [16, 185, 129]; // green
              }
            }
            // Color code Item Type column
            if (data.column.index === 3) {
              const t = String(data.cell.raw);
              if (t === "SubAssembly") data.cell.styles.textColor = [79, 70, 229]; // indigo
              else if (t === "Component") data.cell.styles.textColor = [147, 51, 234]; // purple
              else if (t === "BO") data.cell.styles.textColor = [37, 99, 235]; // blue
              else if (t === "RM") data.cell.styles.textColor = [8, 145, 178]; // cyan
            }
          }
        }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
    });

    // ================= 4. FOOTER SUMMARY & PAGE NUMBERS =================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400

      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.text("Bins ERP • Multi-Level Engineering BOM & Procurement Intelligence Report", 14, pageHeight - 7);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
    }

    doc.save(`Nested_BOM_${data.mrpNumber}.pdf`);
  } catch (err) {
    console.error("Failed to generate Nested BOM PDF:", err);
  }
};
