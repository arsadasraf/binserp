import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyInfo } from '../../app/dashboard/store/types/store.types';

export class PDFGenerator {
    private doc: jsPDF;
    private companyInfo?: CompanyInfo;
    private pageWidth: number;
    private pageHeight: number;
    private finalY: number = 0;

    constructor(companyInfo?: CompanyInfo) {
        this.doc = new jsPDF();
        this.companyInfo = companyInfo;
        this.pageWidth = this.doc.internal.pageSize.width;
        this.pageHeight = this.doc.internal.pageSize.height;
    }

    private addHeader(title: string, color: [number, number, number] = [79, 70, 229]) { // Default Indigo
        // Logo
        if (this.companyInfo?.logo) {
            try {
                this.doc.addImage(this.companyInfo.logo, 'JPEG', 15, 10, 25, 25);
            } catch (e) {
                console.warn("Logo add failed", e);
            }
        }

        // Company Details (Left)
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 41, 59); // Slate 800
        const companyNameY = this.companyInfo?.logo ? 18 : 20; // Align with logo center if exists
        // If logo exists, print name to right of logo, otherwise at start
        const nameX = this.companyInfo?.logo ? 45 : 15;
        this.doc.text(this.companyInfo?.companyName || 'Company Name', nameX, 20);

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100);

        // Address Details
        const addressX = nameX;
        let yPos = 26;
        if (this.companyInfo?.billingAddress) {
            const addressLines = this.doc.splitTextToSize(this.companyInfo.billingAddress, 80);
            this.doc.text(addressLines, addressX, yPos);
            yPos += (addressLines.length * 4);
        }

        if (this.companyInfo?.contactNumber) {
            this.doc.text(`Phone: ${this.companyInfo.contactNumber}`, addressX, yPos);
            yPos += 5;
        }
        if (this.companyInfo?.email) {
            this.doc.text(`Email: ${this.companyInfo.email}`, addressX, yPos);
            yPos += 5;
        }
        if (this.companyInfo?.gstNumber) {
            this.doc.text(`GSTIN: ${this.companyInfo.gstNumber}`, addressX, yPos);
        }

        // Title (Right)
        this.doc.setFontSize(22);
        this.doc.setTextColor(...color);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(title, this.pageWidth - 15, 25, { align: 'right' });

        return 50; // Return Y position for next section
    }

    private addFooter() {
        // Bank Details
        let footerY = this.finalY + 15;

        // Check if we need a new page
        if (footerY > this.pageHeight - 50) {
            this.doc.addPage();
            footerY = 20;
        }

        // Bank Details (Left)
        if (this.companyInfo?.bankDetails) {
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(30, 41, 59);
            this.doc.text("Bank Details:", 15, footerY);

            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(70);
            this.doc.text(`Bank: ${this.companyInfo.bankDetails.bankName || '-'}`, 15, footerY + 6);
            this.doc.text(`A/c No: ${this.companyInfo.bankDetails.accountNumber || '-'}`, 15, footerY + 11);
            this.doc.text(`IFSC: ${this.companyInfo.bankDetails.ifscCode || '-'}`, 15, footerY + 16);
        }

        // Terms (Left, below bank)
        if (this.companyInfo?.commercialTerms) {
            const termsY = this.companyInfo?.bankDetails ? footerY + 30 : footerY;

            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(30, 41, 59);
            this.doc.text("Terms & Conditions:", 15, termsY);

            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(100);
            const terms = this.doc.splitTextToSize(this.companyInfo.commercialTerms, 100);
            this.doc.text(terms, 15, termsY + 6);
        }

        // Signatory (Right)
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 41, 59);
        this.doc.text("Authorized Signatory", this.pageWidth - 15, footerY + 30, { align: 'right' });

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`For ${this.companyInfo?.companyName || 'Company'}`, this.pageWidth - 15, footerY + 36, { align: 'right' });

        // Timestamp
        this.doc.setFontSize(8);
        this.doc.setTextColor(150);
        this.doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, this.pageHeight - 10);
    }

    public generatePO(po: any) {
        const startY = this.addHeader('PURCHASE ORDER', [147, 51, 234]); // Purple

        // PO Info (Right)
        this.doc.setFontSize(10);
        this.doc.setTextColor(71, 85, 105);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`PO Number: ${po.poNumber}`, this.pageWidth - 15, 35, { align: 'right' });
        this.doc.text(`Date: ${new Date(po.date).toLocaleDateString()}`, this.pageWidth - 15, 40, { align: 'right' });
        this.doc.text(`Status: ${po.status}`, this.pageWidth - 15, 45, { align: 'right' });

        // Vendor Details (Left)
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 41, 59);
        this.doc.text("Vendor:", 15, startY + 10);

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`${po.vendorName || po.vendor?.name || 'N/A'}`, 15, startY + 16);
        // Add vendor address if available? (Usually not in listing object but good to have)

        // Items Table
        const items = po.items && po.items.length > 0 ? po.items : [{
            materialName: po.materialName,
            quantity: po.quantity,
            unit: po.unit,
            rate: po.rate,
            amount: po.amount
        }];

        const tableData = items.map((item: any) => [
            item.materialName || 'N/A',
            String(item.quantity || 0),
            item.unit || 'PCS',
            String(item.rate || 0),
            String(item.amount || 0),
        ]);

        autoTable(this.doc, {
            startY: startY + 25,
            head: [['Material', 'Quantity', 'Unit', 'Rate', 'Amount']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [147, 51, 234] }, // Purple
            styles: { fontSize: 9, cellPadding: 3 },
        });

        this.finalY = (this.doc as any).lastAutoTable.finalY + 10;

        // Total
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`Total Amount: ${(po.totalAmount || po.amount || 0).toFixed(2)}`, this.pageWidth - 15, this.finalY, { align: 'right' });

        this.addFooter();
        this.doc.save(`PO_${po.poNumber}.pdf`);
    }

    public generateDC(dc: any) {
        const startY = this.addHeader('DELIVERY CHALLAN', [37, 99, 235]); // Blue

        // DC Info
        this.doc.setFontSize(10);
        this.doc.setTextColor(71, 85, 105);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`DC Number: ${dc.dcNumber}`, this.pageWidth - 15, 35, { align: 'right' });
        this.doc.text(`Date: ${new Date(dc.date).toLocaleDateString()}`, this.pageWidth - 15, 40, { align: 'right' });

        // Customer (Ship To)
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 41, 59);
        this.doc.text("Ship To:", 15, startY + 10);

        const custName = typeof dc.customer === 'object' ? dc.customer.name : dc.customerName;
        const custAddress = typeof dc.customer === 'object' ? dc.customer.address : '';

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(custName || 'N/A', 15, startY + 16);
        if (custAddress) this.doc.text(custAddress, 15, startY + 22, { maxWidth: 80 });

        // Items
        const tableData = dc.items.map((item: any) => [
            item.materialName,
            item.hsnCode || '-',
            String(item.quantity),
            item.unit,
            item.description || '-'
        ]);

        autoTable(this.doc, {
            startY: startY + 35,
            head: [['Material', 'HSN', 'Qty', 'Unit', 'Description']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }, // Blue
        });

        this.finalY = (this.doc as any).lastAutoTable.finalY + 10;

        if (dc.otherDetails) {
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text("Remarks:", 15, this.finalY);

            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(dc.otherDetails, 15, this.finalY + 5);
            this.finalY += 15;
        }

        this.addFooter();
        this.doc.save(`DC_${dc.dcNumber}.pdf`);
    }

    public generateInvoice(invoice: any) {
        const startY = this.addHeader('TAX INVOICE', [79, 70, 229]); // Indigo

        // Invoice Info
        this.doc.setFontSize(10);
        this.doc.setTextColor(71, 85, 105);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`Invoice No: ${invoice.invoiceNumber}`, this.pageWidth - 15, 35, { align: 'right' });
        this.doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, this.pageWidth - 15, 40, { align: 'right' });

        // Bill To
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 41, 59);
        this.doc.text("Bill To:", 15, startY + 10);

        const custName = typeof invoice.customer === 'object' ? invoice.customer.name : invoice.customerName;
        const custAddress = typeof invoice.customer === 'object' ? invoice.customer.address : (invoice.customerAddress || '');
        const custGST = typeof invoice.customer === 'object' ? invoice.customer.gstNumber : (invoice.customerGST || '');

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(custName || 'N/A', 15, startY + 16);
        if (custAddress) this.doc.text(custAddress, 15, startY + 21, { maxWidth: 80 });
        if (custGST) this.doc.text(`GSTIN: ${custGST}`, 15, startY + 36);

        // Items
        const tableData = invoice.items.map((item: any) => [
            item.materialName,
            item.hsnCode || '-',
            String(item.quantity),
            String(item.rate),
            String(item.taxRate || 0) + '%',
            String(((item.amount || 0) + (item.taxAmount || 0)).toFixed(2))
        ]);

        autoTable(this.doc, {
            startY: startY + 45,
            head: [['Item', 'HSN', 'Qty', 'Rate', 'Tax %', 'Amount']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
        });

        this.finalY = (this.doc as any).lastAutoTable.finalY + 10;

        // Totals
        const totalsX = this.pageWidth - 70;
        this.doc.text(`Subtotal:`, totalsX, this.finalY);
        this.doc.text(`${(invoice.subtotal || 0).toFixed(2)}`, this.pageWidth - 15, this.finalY, { align: 'right' });

        this.doc.text(`Tax:`, totalsX, this.finalY + 6);
        this.doc.text(`${(invoice.taxAmount || 0).toFixed(2)}`, this.pageWidth - 15, this.finalY + 6, { align: 'right' });

        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`Total:`, totalsX, this.finalY + 16);
        this.doc.text(`${(invoice.totalAmount || 0).toFixed(2)}`, this.pageWidth - 15, this.finalY + 16, { align: 'right' });

        this.finalY += 30; // Spacing for footer

        this.addFooter();
        this.doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
    }
}
