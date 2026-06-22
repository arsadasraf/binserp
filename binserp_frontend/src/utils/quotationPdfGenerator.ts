import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CompanyInfo } from "../../app/dashboard/store/types/store.types";

export const generateQuotationPDF = (quotation: any, companyInfo?: CompanyInfo) => {
    // Create new jsPDF instance (A4 size)
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- Styling Constants ---
    const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
    const textColor: [number, number, number] = [55, 65, 81]; // Gray-700
    const lightGray: [number, number, number] = [243, 244, 246]; // Gray-100

    // --- Header Background ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 40, "F");

    // --- Title & Company Info ---
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("QUOTATION", pageWidth - 14, 25, { align: "right" });

    if (companyInfo) {
        doc.setFontSize(16);
        doc.text(companyInfo.companyName || "Your Company", 14, 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Contact: ${companyInfo.contactNumber || ''}`, 14, 28);
        doc.text(`Email: ${companyInfo.email || ''}`, 14, 34);
    }

    // --- Quotation Details Box ---
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    
    // Left side: Customer details
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(quotation.customerName || "Customer Name", 14, 62);
    if (quotation.customerAddress) {
        doc.text(quotation.customerAddress, 14, 68);
    }

    // Right side: Meta details
    doc.setFont("helvetica", "bold");
    doc.text("Quotation No:", pageWidth - 70, 55);
    doc.text("Date:", pageWidth - 70, 62);
    
    doc.setFont("helvetica", "normal");
    doc.text(quotation.quotationNumber, pageWidth - 14, 55, { align: "right" });
    doc.text(new Date(quotation.date).toLocaleDateString(), pageWidth - 14, 62, { align: "right" });

    // --- Items Table ---
    const tableHeaders = [["Item", "Description", "Qty", "Rate", "Tax%", "Amount"]];
    const tableData = quotation.items.map((item: any) => [
        item.productName,
        item.description || "-",
        item.quantity,
        `Rs. ${item.rate.toFixed(2)}`,
        `${item.taxRate || 0}%`,
        `Rs. ${(item.amount + (item.taxAmount || 0)).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 85,
        head: tableHeaders,
        body: tableData,
        theme: "plain",
        headStyles: {
            fillColor: lightGray,
            textColor: textColor,
            fontStyle: "bold",
        },
        bodyStyles: {
            textColor: textColor,
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        },
        margin: { top: 10, left: 14, right: 14 },
    });

    // --- Totals Section ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(pageWidth - 90, finalY, 76, 35, "F");

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", pageWidth - 85, finalY + 8);
    doc.text("Tax:", pageWidth - 85, finalY + 16);
    doc.text("Discount:", pageWidth - 85, finalY + 24);
    
    doc.text(`Rs. ${(quotation.subtotal || 0).toFixed(2)}`, pageWidth - 18, finalY + 8, { align: "right" });
    doc.text(`Rs. ${(quotation.taxAmount || 0).toFixed(2)}`, pageWidth - 18, finalY + 16, { align: "right" });
    doc.text(`Rs. ${(quotation.discount || 0).toFixed(2)}`, pageWidth - 18, finalY + 24, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Total:", pageWidth - 85, finalY + 32);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Rs. ${(quotation.totalAmount || 0).toFixed(2)}`, pageWidth - 18, finalY + 32, { align: "right" });

    // --- Footer Remarks ---
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    if (quotation.otherDetails) {
        doc.setFont("helvetica", "bold");
        doc.text("Terms & Conditions:", 14, finalY + 8);
        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(quotation.otherDetails, 100);
        doc.text(splitText, 14, finalY + 14);
    }

    // Save PDF
    doc.save(`Quotation_${quotation.quotationNumber}.pdf`);
};
