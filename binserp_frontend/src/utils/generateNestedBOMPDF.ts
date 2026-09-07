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
    type?: string;
    fgType?: string;
    itemClassification?: string;
    nestedMaterials?: Array<{
      materialName: string;
      materialCode?: string;
      description?: string;
      itemType?: string;
      category?: string;
      fgType?: string;
      itemClassification?: string;
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
    // 1. Landscape A4 (297mm x 210mm) for generous table width & zero truncation
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth(); // 297
    const pageHeight = doc.internal.pageSize.getHeight(); // 210

    // ================= 1. MASTER COMPANY LETTERHEAD =================
    let c = data.companyInfo;
    if (!c || !c.companyName) {
      try {
        const stored = localStorage.getItem("companyInfo") || localStorage.getItem("company");
        if (stored) c = JSON.parse(stored);
      } catch (e) {
        console.warn("Could not read company info from storage:", e);
      }
    }
    c = c || {};

    const companyName = (c.companyName || c.name || "BINS ERP MANUFACTURING").toUpperCase();
    const addressLine1 = c.billingAddress || c.address || c.shippingAddress || "";
    const cityStatePin = [
      c.city,
      c.state,
      c.pincode ? `PIN: ${c.pincode}` : ""
    ].filter(Boolean).join(", ");

    const contactLine = [
      c.contactNumber || c.phone ? `Tel: ${c.contactNumber || c.phone}` : "",
      c.email ? `Email: ${c.email}` : "",
      c.gstNumber || c.gstin ? `GSTIN: ${c.gstNumber || c.gstin}` : "",
      c.panNumber || c.pan ? `PAN: ${c.panNumber || c.pan}` : ""
    ].filter(Boolean).join("  |  ");

    // Modern Top Accent Stripe
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, pageWidth, 2.5, "F");

    // Company Header Left
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(companyName, 14, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600

    let curY = 15.5;
    if (addressLine1) {
      doc.text(addressLine1, 14, curY);
      curY += 4;
    }
    if (cityStatePin) {
      doc.text(cityStatePin, 14, curY);
      curY += 4;
    }
    if (contactLine) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(contactLine, 14, curY);
    }

    // Document Identity Card Right
    const cardWidth = 100;
    const cardHeight = 19;
    const cardX = pageWidth - 14 - cardWidth;
    const cardY = 5.5;

    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("MULTI-LEVEL NESTED BOM REPORT", cardX + 4, cardY + 5);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Engineering Hierarchy & Procurement Demand", cardX + 4, cardY + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(`MRP Ref: ${data.mrpNumber}`, cardX + 4, cardY + 13.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const genDate = new Date().toLocaleDateString('en-GB');
    doc.text(`Generated: ${genDate}  |  Status: ${data.status || "Planned"}`, cardX + 4, cardY + 17);

    // ================= 2. MRP DEMAND METADATA STRIP =================
    const stripY = 28;
    const stripHeight = 12;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, stripY, pageWidth - 28, stripHeight, 1.5, 1.5, "FD");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139); // slate-500

    // Column 1: Customer
    doc.text("CUSTOMER:", 18, stripY + 4.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(data.customerName || "Internal Production Demand", 18, stripY + 9);

    // Column 2: Customer PO
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("CUSTOMER PO REF:", 95, stripY + 4.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.customerPoNumber || "N/A", 95, stripY + 9);

    // Column 3: Target Date
    doc.setTextColor(100, 116, 139);
    doc.text("TARGET DELIVERY DATE:", 165, stripY + 4.5);
    doc.setTextColor(15, 23, 42);
    const targetDateStr = data.targetDate ? new Date(data.targetDate).toLocaleDateString('en-GB') : "-";
    doc.text(targetDateStr, 165, stripY + 9);

    // Column 4: Total FG Products
    doc.setTextColor(100, 116, 139);
    doc.text("FINISHED PRODUCTS DEMAND:", 230, stripY + 4.5);
    doc.setTextColor(79, 70, 229);
    doc.text(`${(data.fgItems || []).length} Finished Goods Planned`, 230, stripY + 9);

    let startY = 44;

    // ================= 3. MULTI-LEVEL BOM TABLES PER FG =================
    (data.fgItems || []).forEach((fg, fgIdx) => {
      // Check if near bottom of page
      if (startY > pageHeight - 35) {
        doc.addPage();
        startY = 15;
      }

      // FG Item Header Strip
      doc.setFillColor(238, 242, 255); // indigo-50
      doc.setDrawColor(199, 210, 254); // indigo-200
      doc.roundedRect(14, startY, pageWidth - 28, 7.5, 1, 1, "FD");

      const fgTypeStr = (fg.type || fg.fgType || fg.itemClassification || '').toLowerCase();
      let fgTypePrefix = "Assembly";
      if (fgTypeStr.includes("sub")) fgTypePrefix = "Sub-Assembly";
      else if (fgTypeStr.includes("comp")) fgTypePrefix = "Component";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 27, 75); // indigo-950
      doc.text(
        `${fgTypePrefix} [Level 1]: ${fg.fgItemName}   •   Target: ${fg.quantity} ${fg.unit || "PCS"}   •   BOM: ${fg.bomNumber || "Active"}`,
        18,
        startY + 5
      );

      startY += 9;

      // Table Rows
      const tableRows = (fg.nestedMaterials || []).map((m) => {
        const level = m.level || 2;
        const indentStr = "    ".repeat(Math.max(0, level - 2));
        const prefix = level > 1 ? `${indentStr}↳ ` : "";
        const cleanName = m.materialName || "Material";
        const cleanDesc = (m.description || "").trim();

        // Show name with full description underneath (no code)
        const nameAndDesc = cleanDesc 
          ? `${prefix}${cleanName}\n${indentStr}   ${cleanDesc}`
          : `${prefix}${cleanName}`;

        const reqQty = Number(m.totalRequired ?? m.requiredQuantity ?? 0);
        const liveStock = Number(m.currentPhysicalStock ?? 0);
        const inTransit = Number(m.totalInTransitPO ?? 0);
        const shortage = Number(m.netShortage ?? Math.max(0, reqQty - liveStock - inTransit));
        const rate = Number(m.bestVendor?.rate ?? m.estimatedRate ?? 0);
        const val = shortage * rate;

        const rawType = (m.itemType || '').toString();
        const cat = (m.category || '').toString().toLowerCase();
        let displayType = 'Raw Material';
        if (rawType === 'SubAssembly' || cat.includes('sub') || m.fgType === 'Sub Assembly') {
          displayType = 'Sub-Assembly';
        } else if (rawType === 'Component' || cat.includes('comp') || m.fgType === 'Component') {
          displayType = 'Component';
        } else if (rawType === 'Assembly' || cat.includes('assembly') || m.fgType === 'Assembly') {
          displayType = 'Assembly';
        } else if (rawType === 'BO' || cat.includes('bought')) {
          displayType = 'Bought Out';
        } else if (rawType === 'Consumable' || cat.includes('consumable')) {
          displayType = 'Consumable';
        }

        return [
          `L${level}`,
          nameAndDesc,
          displayType,
          `${m.quantityPerFG || 1}`,
          `${reqQty} ${m.unit || "PCS"}`,
          `${liveStock} ${m.unit || "PCS"}`,
          inTransit > 0 ? `${inTransit} ${m.unit || "PCS"}` : "-",
          shortage > 0 ? `${shortage} ${m.unit || "PCS"}` : "Covered",
          rate > 0 ? `₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-",
          val > 0 ? `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"
        ];
      });

      autoTable(doc, {
        startY: startY,
        head: [[
          "Lvl",
          "Component / Material Name & Technical Specification",
          "Item Type",
          "Per FG",
          "Total Req",
          "Live Stock",
          "In-Transit",
          "Net Shortage",
          "Unit Rate",
          "Est. Shortage Value"
        ]],
        body: tableRows,
        theme: "grid",
        styles: {
          overflow: "linebreak",
          cellPadding: 2,
          font: "helvetica",
          fontSize: 7
        },
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center",
          valign: "middle"
        },
        bodyStyles: {
          textColor: [15, 23, 42],
          valign: "middle"
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 82, halign: "left" }, // Generous width for Name + multi-line Description
          2: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 23, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 23, halign: "center" },
          6: { cellWidth: 21, halign: "center" },
          7: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          8: { cellWidth: 22, halign: "right" },
          9: { cellWidth: 22, halign: "right", fontStyle: "bold" }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData) => {
          if (hookData.section === "body") {
            // Net Shortage column highlight (index 7)
            if (hookData.column.index === 7) {
              const val = String(hookData.cell.raw);
              if (val !== "Covered" && val !== "-") {
                hookData.cell.styles.textColor = [220, 38, 38]; // bold red
                hookData.cell.styles.fontStyle = "bold";
              } else {
                hookData.cell.styles.textColor = [16, 185, 129]; // emerald green
                hookData.cell.styles.fontStyle = "bold";
              }
            }
            // Item Type column color-coding (index 2)
            if (hookData.column.index === 2) {
              const t = String(hookData.cell.raw);
              if (t.includes("Sub-Assembly")) hookData.cell.styles.textColor = [67, 56, 202]; // indigo-700
              else if (t.includes("Component")) hookData.cell.styles.textColor = [2, 132, 199]; // sky-600
              else if (t.includes("Bought Out")) hookData.cell.styles.textColor = [180, 83, 9]; // amber-700
              else if (t.includes("Raw Material")) hookData.cell.styles.textColor = [109, 40, 217]; // purple-700
              else if (t.includes("Assembly")) hookData.cell.styles.textColor = [15, 23, 42]; // slate-900
            }
          }
        }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
    });

    // ================= 4. FOOTER & PAGE NUMBERING =================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400

      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);

      doc.text(
        "Bins ERP • Procurement Intelligence & Multi-Level Engineering BOM • Confidential",
        14,
        pageHeight - 5
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - 14,
        pageHeight - 5,
        { align: "right" }
      );
    }

    doc.save(`Nested_BOM_${data.mrpNumber}.pdf`);
  } catch (err) {
    console.error("Failed to generate Nested BOM PDF:", err);
  }
};
