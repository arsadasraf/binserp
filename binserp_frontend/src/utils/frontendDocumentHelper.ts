import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DocumentOptions {
  doc: any;
  companyInfo?: any;
  title?: string;
}

/**
 * Generate 4-Copy Professional PDF directly in the Browser
 * Copy 1: ORIGINAL FOR RECIPIENT
 * Copy 2: DUPLICATE FOR TRANSPORTER
 * Copy 3: TRIPLICATE FOR SUPPLIER
 * Copy 4: QUADRUPLICATE / EXTRA COPY
 */
export const download4CopyPDF = (type: "dc" | "invoice", { doc, companyInfo }: DocumentOptions) => {
  try {
    const pdf = new jsPDF("p", "mm", "a4");
    const copies = [
      "ORIGINAL FOR RECIPIENT",
      "DUPLICATE FOR TRANSPORTER",
      "TRIPLICATE FOR SUPPLIER",
      "QUADRUPLICATE / EXTRA COPY"
    ];

    const isInvoice = type === "invoice";
    const documentTitle = isInvoice ? "TAX INVOICE" : "DELIVERY CHALLAN";
    const docNum = isInvoice ? (doc.invoiceNumber || "INV-001") : (doc.dcNumber || "DC-001");

    copies.forEach((copyTitle, pageIndex) => {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      // Border frame around page
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(30, 41, 59); // Slate dark
      pdf.rect(8, 8, 194, 281);

      // Header top bar background
      pdf.setFillColor(248, 250, 252);
      pdf.rect(8.5, 8.5, 193, 28, "F");

      // Copy Type Badge in Top Right
      pdf.setFillColor(30, 41, 59);
      pdf.rect(130, 10, 70, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(copyTitle, 165, 15, { align: "center" });

      // Company Info Header
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const companyName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
      pdf.text(companyName.toUpperCase(), 12, 17);

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(71, 85, 105);
      const address = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.location || "";
      const contact = `Phone: ${companyInfo?.contactNumber || companyInfo?.phone || "-"} | Email: ${companyInfo?.email || "-"}`;
      const gstin = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst ? `GSTIN: ${companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst}` : "";
      
      pdf.text(address.substring(0, 70), 12, 22);
      pdf.text(`${contact} ${gstin ? ` | ${gstin}` : ""}`, 12, 26);

      // Title bar
      pdf.setFillColor(224, 231, 255); // Soft blue fill
      pdf.rect(8.5, 36.5, 193, 9, "F");
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 58, 138);
      pdf.text(documentTitle, 105, 42.5, { align: "center" });

      // Customer & Document Details Section Grid
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(8.5, 45.5, 201.5, 45.5);
      pdf.line(105, 45.5, 105, 78);
      pdf.line(8.5, 78, 201.5, 78);

      // Customer Details (Left Panel)
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text("DETAILS OF BUYER / CONSIGNEE:", 12, 50);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      const custName = doc.customerName || doc.customer?.name || "Internal Customer / Cash Sales";
      pdf.text(custName, 12, 55);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      const custAddress = doc.customerAddress || doc.customer?.address || "-";
      pdf.text(`Address: ${custAddress.substring(0, 50)}`, 12, 60);
      if (doc.customerGST || doc.customer?.gstNumber) {
        pdf.text(`GSTIN: ${doc.customerGST || doc.customer?.gstNumber}`, 12, 65);
      }
      if (doc.customerPoReference) {
        pdf.setFont("helvetica", "bold");
        pdf.text(`Customer PO Ref: ${doc.customerPoReference}`, 12, 70);
      }

      // Document Info (Right Panel)
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      
      pdf.text(`${isInvoice ? "Invoice No:" : "DC No:"} `, 108, 50);
      pdf.setFont("helvetica", "bold");
      pdf.text(docNum, 140, 50);

      pdf.setFont("helvetica", "normal");
      pdf.text("Date:", 108, 55);
      pdf.setFont("helvetica", "bold");
      pdf.text(new Date(doc.date || Date.now()).toLocaleDateString("en-IN"), 140, 55);

      if (doc.transportationType || doc.transportType || doc.vehicleNumber) {
        pdf.setFont("helvetica", "normal");
        pdf.text("Transport Method:", 108, 60);
        pdf.text(doc.transportationType || doc.transportType || "Road Freight", 140, 60);

        if (doc.vehicleNumber) {
          pdf.text("Vehicle No:", 108, 65);
          pdf.text(doc.vehicleNumber, 140, 65);
        }
      }

      pdf.setFont("helvetica", "normal");
      pdf.text("Status:", 108, 70);
      pdf.setFont("helvetica", "bold");
      pdf.text(doc.status || "Issued", 140, 70);

      // Line Items AutoTable
      const tableHeaders = isInvoice
        ? [["Sl", "Product / Material Description", "HSN Code", "Qty", "Unit", "Rate (₹)", "Tax %", "Amount (₹)"]]
        : [["Sl", "Product / Material Description", "HSN Code", "Qty", "Unit", "Rate (₹)", "Remarks"]];

      const tableRows = (doc.items || []).map((item: any, idx: number) => {
        const qty = item.quantity || 0;
        const rate = item.rate || item.pricePerQuantity || 0;
        const amount = (qty * rate);
        const taxRate = item.taxRate || 0;
        const taxAmt = amount * (taxRate / 100);
        const total = amount + taxAmt;

        if (isInvoice) {
          return [
            idx + 1,
            item.materialName || item.productName || "Item",
            item.hsnCode || "-",
            qty,
            item.unit || "PCS",
            rate ? rate.toFixed(2) : "0.00",
            `${taxRate}%`,
            total ? total.toFixed(2) : "0.00"
          ];
        } else {
          return [
            idx + 1,
            item.materialName || item.productName || "Item",
            item.hsnCode || "-",
            qty,
            item.unit || "PCS",
            rate ? rate.toFixed(2) : "-",
            item.description || item.remarks || "-"
          ];
        }
      });

      // Pad rows to look complete if items < 6
      while (tableRows.length < 5) {
        tableRows.push(["", "", "", "", "", "", ...(isInvoice ? [""] : [])]);
      }

      autoTable(pdf, {
        startY: 80,
        head: tableHeaders,
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: isInvoice ? 55 : 65 },
          2: { halign: "center", cellWidth: 20 },
          3: { halign: "center", cellWidth: 15 },
          4: { halign: "center", cellWidth: 15 },
          5: { halign: "right", cellWidth: 25 },
          6: { halign: "center", cellWidth: 18 },
          7: { halign: "right", cellWidth: 30 }
        },
        margin: { left: 8.5, right: 8.5 }
      });

      const finalY = (pdf as any).lastAutoTable.finalY || 165;

      // Summary Breakdown Card & Footer Details
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(8.5, finalY + 4, 201.5, finalY + 4);

      // Financial Calculation Block (Right Column)
      const subtotal = doc.subtotal || (doc.items || []).reduce((acc: number, i: any) => acc + ((i.quantity || 0) * (i.rate || 0)), 0);
      const transportCharges = Number(doc.transportationCharges || doc.freightCharges || 0);
      const packagingCharges = Number(doc.packagingCharges || 0);
      const discount = Number(doc.discount || 0);
      const taxAmount = doc.taxAmount || (doc.items || []).reduce((acc: number, i: any) => acc + (((i.quantity || 0) * (i.rate || 0)) * ((i.taxRate || 0) / 100)), 0);
      const grandTotal = doc.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

      // Left Column: Bank & Terms
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("BANK DETAILS & REMARKS:", 12, finalY + 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);

      const bankName = companyInfo?.bankDetails?.bankName || companyInfo?.bankName || "-";
      const accNo = companyInfo?.bankDetails?.accountNumber || companyInfo?.accountNumber || "-";
      const ifsc = companyInfo?.bankDetails?.ifscCode || companyInfo?.ifscCode || "-";
      
      pdf.text(`Bank: ${bankName} | A/c: ${accNo} | IFSC: ${ifsc}`, 12, finalY + 15);
      if (doc.otherDetails || doc.remarks) {
        pdf.text(`Remarks: ${doc.otherDetails || doc.remarks}`, 12, finalY + 20);
      }
      pdf.text(`Terms: Subject to local jurisdiction. Goods once sold will not be taken back.`, 12, finalY + 25);

      // Right Column: Summary Table
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 41, 59);

      let calcY = finalY + 10;
      pdf.text("Items Subtotal:", 135, calcY);
      pdf.text(`₹ ${subtotal.toFixed(2)}`, 198, calcY, { align: "right" });

      if (transportCharges > 0) {
        calcY += 4;
        pdf.text("Freight / Transport:", 135, calcY);
        pdf.text(`+ ₹ ${transportCharges.toFixed(2)}`, 198, calcY, { align: "right" });
      }

      if (packagingCharges > 0) {
        calcY += 4;
        pdf.text("Packaging Charges:", 135, calcY);
        pdf.text(`+ ₹ ${packagingCharges.toFixed(2)}`, 198, calcY, { align: "right" });
      }

      if (discount > 0) {
        calcY += 4;
        pdf.text("Discount:", 135, calcY);
        pdf.text(`- ₹ ${discount.toFixed(2)}`, 198, calcY, { align: "right" });
      }

      if (isInvoice || taxAmount > 0) {
        calcY += 4;
        pdf.text("Calculated Tax (GST):", 135, calcY);
        pdf.text(`₹ ${taxAmount.toFixed(2)}`, 198, calcY, { align: "right" });
      }

      calcY += 6;
      pdf.setFillColor(241, 245, 249);
      pdf.rect(132, calcY - 4, 69.5, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("GRAND TOTAL:", 135, calcY + 1);
      pdf.text(`₹ ${grandTotal.toFixed(2)}`, 198, calcY + 1, { align: "right" });

      // Authorized Signatory Block
      const signY = Math.max(calcY + 16, 260);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(`For ${companyName}`, 198, signY, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.text("Authorized Signatory", 198, signY + 12, { align: "right" });
    });

    pdf.save(`${type.toUpperCase()}_4COPY_${docNum}.pdf`);
  } catch (error) {
    console.error("Failed to generate 4-copy PDF:", error);
    alert("Failed to generate PDF document. Please try again.");
  }
};

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
