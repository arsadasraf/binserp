import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCurrencySymbol, convertAmountToWords } from "./currencyHelper";

export interface OrderAcknowledgementData {
    po: any;
    companyInfo?: any;
}

const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Generate Professional Order Acknowledgement / Acceptance (OA) Browser Printable PDF View
 */
export const generateFrontendOrderAcknowledgementPDF = ({ po, companyInfo }: OrderAcknowledgementData) => {
    if (!po) {
        alert("No Customer PO data provided for Order Acknowledgement generation");
        return;
    }

    // 1. Company Information
    const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY NAME";
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || "";
    const compCityState = `${companyInfo?.city || ""} ${companyInfo?.state || ""} ${companyInfo?.pincode ? "-" + companyInfo?.pincode : ""}`.trim();
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || "";
    const compEmail = companyInfo?.email || "";
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || "N/A";
    const compPan = companyInfo?.panNumber || companyInfo?.pan || "N/A";
    const compCin = companyInfo?.cinNumber || companyInfo?.cin || "";

    // 2. Customer Information
    const cust = po.customer || {};
    const custName = po.customerName || cust.name || cust.companyName || "CUSTOMER";
    const custAddress = cust.address || cust.billingAddress || "";
    const custCityState = `${cust.city || ""} ${cust.state || ""} ${cust.pincode ? "-" + cust.pincode : ""}`.trim();
    const custGst = cust.gstin || cust.gst || cust.gstNumber || "N/A";
    const custPan = cust.pan || cust.panNumber || "N/A";
    const custPhone = cust.phone || cust.mobile || cust.contactNumber || "";
    const custEmail = cust.email || "";

    // 3. Document Identification
    const oaNum = po.acknowledgementNumber || `OA-${po.poNumber || 'CPO'}`;
    const oaDate = formatDate(po.acknowledgementDate || new Date());
    const poNum = po.poNumber || "N/A";
    const poDate = formatDate(po.date || po.createdAt);
    const quoteRef = po.quotationReference?.quotationNumber || po.quotationReference || "Direct PO";
    const globalCommitment = formatDate(po.committedDispatchDate || po.date);
    const transportMethod = po.transportationMethod || "Road Freight";
    const totalAmount = Number(po.totalAmount || po.subtotal || 0);
    const subtotal = Number(po.subtotal || 0);
    const taxAmount = Number(po.taxAmount || 0);
    const freightAmount = Number(po.transportationCharges || 0);

    // 4. Line Items Construction
    const currSym = getCurrencySymbol(po.currency);
    const items = po.items || [];
    let itemsRowsHtml = '';

    items.forEach((item: any, idx: number) => {
        const pName = item.productName || item.fgItem?.name || "Product Item";
        const pCode = item.fgItem?.code ? `(${item.fgItem.code})` : "";
        const desc = item.description ? `<br/><span style="font-size: 9px; color: #64748b;">${item.description}</span>` : "";
        const qty = Number(item.quantity || 1);
        const unit = item.unit || "PCS";
        const rate = Number(item.rate || 0);
        const taxRate = Number(item.taxRate != null ? item.taxRate : 18);
        const lineTotal = item.amount ? Number(item.amount) : (qty * rate * (1 + taxRate / 100));
        
        // Individual item commitment date (falls back to global PO commitment date if not set)
        const itemCommitDate = item.committedDeliveryDate 
            ? formatDate(item.committedDeliveryDate) 
            : (po.committedDispatchDate ? formatDate(po.committedDispatchDate) : (item.expectedDeliveryDate ? formatDate(item.expectedDeliveryDate) : globalCommitment));

        const isSpecific = !!item.committedDeliveryDate;

        const hsn = item.hsnCode || item.hsn || '-';

        itemsRowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 8px; text-align: center; font-size: 11px; font-weight: bold; color: #475569;">${idx + 1}</td>
                <td style="padding: 7px 8px; text-align: left; font-size: 11px;">
                    <strong style="color: #0f172a;">${pName} ${pCode}</strong>
                    ${desc}
                </td>
                <td style="padding: 7px 8px; text-align: center; font-size: 11px; font-family: monospace; font-weight: bold; color: #475569;">
                    ${hsn}
                </td>
                <td style="padding: 7px 8px; text-align: center; font-size: 11px; font-weight: bold; color: #1e293b;">
                    ${qty} <span style="font-size: 9px; color: #64748b; font-weight: normal;">${unit}</span>
                </td>
                <td style="padding: 7px 8px; text-align: right; font-size: 11px; font-family: monospace; font-weight: bold; color: #1e293b;">
                    ${currSym}${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style="padding: 7px 8px; text-align: center; font-size: 11px; font-weight: bold; color: #475569;">
                    ${taxRate}%
                </td>
                <td style="padding: 7px 8px; text-align: center; font-size: 11px;">
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: ${isSpecific ? '#eef2ff' : '#f8fafc'}; color: ${isSpecific ? '#4338ca' : '#334155'}; font-weight: bold; border: 1px solid ${isSpecific ? '#c7d2fe' : '#e2e8f0'};">
                        ${itemCommitDate}
                    </span>
                </td>
                <td style="padding: 7px 8px; text-align: right; font-size: 11px; font-family: monospace; font-weight: bold; color: #1e3a8a;">
                    ${currSym}${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to preview and print Order Acknowledgement");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order_Acknowledgement_${oaNum}</title>
            <style>
                @page { size: A4 portrait; margin: 8mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
                @media print {
                    body { background: #fff; }
                    .no-print { display: none !important; }
                    .page-container { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
                }
                table { border-collapse: collapse; width: 100%; }
                .border-box { border: 1px solid #cbd5e1; border-radius: 6px; }
            </style>
        </head>
        <body>
            <!-- Action Toolbar (Hidden on Print) -->
            <div class="no-print" style="position: fixed; top: 12px; right: 16px; z-index: 9999; background: #0f172a; color: #fff; padding: 8px 16px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Order Acknowledgement: ${oaNum}</span>
                <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">Close</button>
            </div>

            <!-- A4 Document Container -->
            <div class="page-container" style="max-width: 800px; margin: 40px auto 20px auto; background: #fff; padding: 24px 28px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.06); box-sizing: border-box;">
                
                <!-- 1. Header Banner -->
                <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 12px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 65%; vertical-align: top;">
                                <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.2px; text-transform: uppercase;">
                                    ${compName}
                                </h1>
                                <div style="font-size: 10px; color: #475569; line-height: 1.4;">
                                    ${compAddress ? `${compAddress}<br/>` : ''}
                                    ${compCityState ? `${compCityState}<br/>` : ''}
                                    ${compPhone ? `Phone: <strong>${compPhone}</strong> &nbsp;|&nbsp; ` : ''}
                                    ${compEmail ? `Email: <strong>${compEmail}</strong>` : ''}
                                </div>
                                <div style="font-size: 10px; color: #0f172a; margin-top: 3px; font-weight: 600;">
                                    GSTIN: <span style="font-family: monospace; color: #1e3a8a;">${compGst}</span> &nbsp;|&nbsp; PAN: <span style="font-family: monospace;">${compPan}</span>
                                    ${compCin ? `&nbsp;|&nbsp; CIN: <span style="font-family: monospace;">${compCin}</span>` : ''}
                                </div>
                            </td>
                            <td style="width: 35%; text-align: right; vertical-align: top;">
                                <div style="display: inline-block; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 6px; padding: 6px 12px; text-align: right;">
                                    <span style="font-size: 8px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Commercial Acceptance</span>
                                    <h2 style="margin: 2px 0 0 0; font-size: 13px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">ORDER ACKNOWLEDGEMENT</h2>
                                    <span style="display: inline-block; margin-top: 3px; font-size: 9px; font-weight: bold; background: #16a34a; color: #fff; padding: 1px 6px; border-radius: 3px;">ORDER ACCEPTED</span>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- 2. Two-Column Metadata Box: Customer Info (Left) & PO References (Right) -->
                <div style="margin-bottom: 14px;">
                    <table style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                        <tr style="background: #f1f5f9;">
                            <th style="width: 50%; padding: 5px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #334155; text-transform: uppercase; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                                Customer / Buyer Details
                            </th>
                            <th style="width: 50%; padding: 5px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #334155; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">
                                Order Acceptance & Reference
                            </th>
                        </tr>
                        <tr>
                            <!-- Customer Left Column -->
                            <td style="padding: 8px 10px; vertical-align: top; border-right: 1px solid #cbd5e1; font-size: 10px; line-height: 1.45;">
                                <strong style="font-size: 12px; color: #0f172a;">${custName}</strong><br/>
                                ${custAddress ? `${custAddress}<br/>` : ''}
                                ${custCityState ? `${custCityState}<br/>` : ''}
                                ${custPhone ? `Contact: <strong>${custPhone}</strong><br/>` : ''}
                                ${custEmail ? `Email: <strong>${custEmail}</strong><br/>` : ''}
                                <div style="margin-top: 4px; font-weight: 600; color: #1e293b;">
                                    GSTIN: <span style="font-family: monospace; color: #1e3a8a;">${custGst}</span>
                                    ${custPan !== 'N/A' ? `&nbsp;|&nbsp; PAN: <span style="font-family: monospace;">${custPan}</span>` : ''}
                                </div>
                            </td>

                            <!-- Order Reference Right Column -->
                            <td style="padding: 8px 10px; vertical-align: top; font-size: 10px; line-height: 1.45;">
                                <table style="width: 100%; font-size: 10px;">
                                    <tr>
                                        <td style="color: #64748b; width: 45%; padding: 1px 0;">OA Reference #:</td>
                                        <td style="font-weight: 800; color: #1e3a8a; font-family: monospace;">${oaNum}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 1px 0;">OA Date:</td>
                                        <td style="font-weight: 700; color: #0f172a;">${oaDate}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 1px 0;">Customer PO #:</td>
                                        <td style="font-weight: 800; color: #0f172a; font-family: monospace;">${poNum}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 1px 0;">Customer PO Date:</td>
                                        <td style="font-weight: 700; color: #0f172a;">${poDate}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 1px 0;">Quotation Ref:</td>
                                        <td style="font-weight: 600; color: #475569;">${quoteRef}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 1px 0;">Committed Dispatch:</td>
                                        <td style="font-weight: 800; color: #16a34a;">${globalCommitment}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 1px 0;">Transport Mode:</td>
                                        <td style="font-weight: 600; color: #334155;">${transportMethod}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- 3. Commitment Statement Banner -->
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 10px; color: #166534; line-height: 1.4;">
                    <strong>Order Acceptance Commitment:</strong> We gratefully acknowledge receipt of your Purchase Order #<strong>${poNum}</strong>. We confirm acceptance of the terms and commit to manufacturing and dispatching the line items as per the promised delivery dates specified below.
                </div>

                <!-- 4. Line Items Table with Individual Commitment Dates -->
                <div style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                    <table style="width: 100%;">
                        <thead style="background: #1e3a8a; color: #fff;">
                            <tr>
                                <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 5%;">#</th>
                                <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: left; width: 30%;">Item Description / Spec</th>
                                <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 10%;">HSN</th>
                                <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 9%;">Qty</th>
                                <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: right; width: 13%;">Rate (${currSym})</th>
                                <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 7%;">GST</th>
                                <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: center; width: 14%;">Committed Date</th>
                                <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: right; width: 12%;">Total (${currSym})</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRowsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- 5. Total Calculations & Amount in Words -->
                <div style="margin-bottom: 14px;">
                    <table style="width: 100%;">
                        <tr>
                            <!-- Left: Amount in Words -->
                            <td style="width: 55%; vertical-align: top; padding-right: 14px;">
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
                                    <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Amount in Words:</span>
                                    <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                                        ${convertAmountToWords(totalAmount, po.currency)}
                                    </div>
                                </div>

                                ${po.acknowledgementRemarks ? `
                                    <div style="margin-top: 8px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 6px 10px; font-size: 10px; color: #92400e;">
                                        <strong>Special Remarks / Dispatch Notes:</strong><br/>
                                        ${po.acknowledgementRemarks}
                                    </div>
                                ` : ''}
                            </td>

                            <!-- Right: Price Breakdown -->
                            <td style="width: 45%; vertical-align: top;">
                                <table style="width: 100%; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 5px 8px; color: #64748b;">Subtotal:</td>
                                        <td style="padding: 5px 8px; text-align: right; font-weight: bold; font-family: monospace;">${currSym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 5px 8px; color: #64748b;">Total GST Tax:</td>
                                        <td style="padding: 5px 8px; text-align: right; font-weight: bold; font-family: monospace;">${currSym}${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                    ${freightAmount > 0 ? `
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 5px 8px; color: #64748b;">Freight Charges:</td>
                                            <td style="padding: 5px 8px; text-align: right; font-weight: bold; font-family: monospace;">${currSym}${freightAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    ` : ''}
                                    <tr style="background: #1e3a8a; color: #fff;">
                                        <td style="padding: 7px 8px; font-weight: 800; font-size: 12px;">Grand Total (${po.currency || 'INR'}):</td>
                                        <td style="padding: 7px 8px; text-align: right; font-weight: 900; font-size: 13px; font-family: monospace;">
                                            ${currSym}${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- 6. Standard Terms & Conditions & Signatures -->
                <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 10px;">
                    <table style="width: 100%;">
                        <tr>
                            <!-- Terms Column -->
                            <td style="width: 60%; vertical-align: top; font-size: 8.5px; color: #64748b; line-height: 1.4; padding-right: 12px;">
                                <strong style="color: #334155; text-transform: uppercase;">Standard Commercial & Delivery Terms:</strong>
                                <ol style="margin: 2px 0 0 0; padding-left: 14px;">
                                    <li>Delivery will be dispatched as per committed dates specified against each item above.</li>
                                    <li>Dispatches are subject to standard force majeure conditions and timely material availability.</li>
                                    <li>Goods once dispatched cannot be returned without prior written authorization.</li>
                                    <li>Jurisdiction: Subject to local city jurisdiction for all legal proceedings.</li>
                                </ol>
                            </td>

                            <!-- Authorized Signatory Column -->
                            <td style="width: 40%; vertical-align: bottom; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; color: #1e3a8a; margin-bottom: 35px;">
                                    For ${compName}
                                </div>
                                <div style="border-top: 1px dashed #94a3b8; width: 85%; margin: 0 auto 3px auto;"></div>
                                <span style="font-size: 9px; font-weight: 700; color: #334155; text-transform: uppercase; display: block;">Authorized Signatory / Seal</span>
                            </td>
                        </tr>
                    </table>
                </div>

            </div>

            <script>
                setTimeout(function() {
                    window.print();
                }, 450);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

/**
 * Direct Download of Order Acknowledgement PDF via jsPDF & autoTable
 */
export const downloadOrderAcknowledgementJsPDF = ({ po, companyInfo }: OrderAcknowledgementData) => {
    if (!po) return;

    const doc = new jsPDF("p", "mm", "a4");
    const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY NAME";
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || "N/A";
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || "";
    const cust = po.customer || {};
    const custName = po.customerName || cust.name || "Customer";
    const custAddress = cust.address || cust.billingAddress || "";
    const oaNum = po.acknowledgementNumber || `OA-${po.poNumber || 'PO'}`;
    const oaDate = formatDate(po.acknowledgementDate || new Date());
    const poNum = po.poNumber || "N/A";
    const poDate = formatDate(po.date || po.createdAt);
    const globalCommitment = formatDate(po.committedDispatchDate || po.date);
    const totalAmount = Number(po.totalAmount || po.subtotal || 0);
    const currSym = getCurrencySymbol(po.currency);

    // Header
    doc.setFillColor(30, 58, 138); // Dark blue #1e3a8a
    doc.rect(10, 10, 190, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(compName.toUpperCase(), 14, 18);
    doc.setFontSize(9);
    doc.text("ORDER ACKNOWLEDGEMENT & ACCEPTANCE", 14, 24);

    doc.setFontSize(8);
    doc.text(`OA Ref: ${oaNum}`, 196, 18, { align: "right" });
    doc.text(`Date: ${oaDate}`, 196, 24, { align: "right" });

    // Company & Customer Details
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    let yPos = 34;

    doc.setFont("helvetica", "bold");
    doc.text("BUYER / CUSTOMER:", 14, yPos);
    doc.text("ORDER REFERENCE & COMMITMENT:", 110, yPos);

    yPos += 4;
    doc.setFont("helvetica", "normal");
    doc.text(custName, 14, yPos);
    doc.text(`Customer PO #: ${poNum}`, 110, yPos);

    yPos += 4;
    doc.text(custAddress.substring(0, 45) || "-", 14, yPos);
    doc.text(`PO Date: ${poDate}`, 110, yPos);

    yPos += 4;
    doc.text(`GSTIN: ${cust.gstin || cust.gst || "N/A"}`, 14, yPos);
    doc.text(`Overall Committed Dispatch: ${globalCommitment}`, 110, yPos);

    yPos += 7;

    // Items Table
    const tableBody = (po.items || []).map((item: any, idx: number) => {
        const pName = item.productName || item.fgItem?.name || "Product Item";
        const qty = Number(item.quantity || 1);
        const unit = item.unit || "PCS";
        const rate = Number(item.rate || 0);
        const taxRate = Number(item.taxRate != null ? item.taxRate : 18);
        const lineTotal = item.amount ? Number(item.amount) : (qty * rate * (1 + taxRate / 100));
        const itemCommitDate = item.committedDeliveryDate 
            ? formatDate(item.committedDeliveryDate) 
            : (po.committedDispatchDate ? formatDate(po.committedDispatchDate) : globalCommitment);

        const rateStr = `${currSym} ${rate.toFixed(2)}`;
        const lineTotalStr = `${currSym} ${lineTotal.toFixed(2)}`;

        return [
            idx + 1,
            pName,
            `${qty} ${unit}`,
            rateStr,
            `${taxRate}%`,
            itemCommitDate,
            lineTotalStr
        ];
    });

    autoTable(doc, {
        startY: yPos,
        head: [["#", "Item Description", "Qty", `Rate (${currSym})`, "GST", "Committed Date", `Total Amount (${currSym})`]],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { cellWidth: 65 },
            2: { halign: "center", cellWidth: 18 },
            3: { halign: "right", cellWidth: 24 },
            4: { halign: "center", cellWidth: 14 },
            5: { halign: "center", cellWidth: 28, fontStyle: "bold" },
            6: { halign: "right", cellWidth: 28 }
        },
        margin: { left: 10, right: 10 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    
    // Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Grand Total (${po.currency || 'INR'}): ${currSym} ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, finalY + 8, { align: "right" });
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Amount in words: ${convertAmountToWords(totalAmount, po.currency)}`, 14, finalY + 8);

    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Order Acceptance Statement: We confirm acceptance of this order and commit to the delivery schedule above.", 14, finalY + 16);

    doc.save(`Order_Acknowledgement_${oaNum}.pdf`);
};
