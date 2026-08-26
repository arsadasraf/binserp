/**
 * Client-Side Frontend PDF & Document Generator
 * Renders Returnable Delivery Challan in 3 Copies (Consignee, Transporter, Consignor)
 * Fully populating Vendor address, GST, PAN, and Company details directly in the browser.
 */

export interface PrintDocumentData {
    doc: any;
    companyInfo?: any;
    vendors?: any[];
}

export const generateFrontendReturnableDCPDF = (data: PrintDocumentData) => {
    const { doc, companyInfo, vendors = [] } = data;

    if (!doc) {
        alert("No document data provided for PDF generation");
        return;
    }

    // 1. Resolve Vendor Details
    let vendorObj: any = doc.vendor;
    if (typeof doc.vendor === 'string') {
        vendorObj = vendors.find((v: any) => v._id === doc.vendor) || { name: doc.vendor };
    }

    const vendorName = vendorObj?.name || vendorObj?.vendorName || doc.vendorName || 'SUPPLIER / CONSIGNEE';
    const vendorAddress = vendorObj?.address || vendorObj?.billingAddress || vendorObj?.street || '';
    const vendorCityState = `${vendorObj?.city || ''} ${vendorObj?.state || ''} ${vendorObj?.pincode ? '-' + vendorObj?.pincode : ''}`.trim();
    const vendorGst = vendorObj?.gst || vendorObj?.gstNumber || vendorObj?.gstin || 'N/A';
    const vendorPan = vendorObj?.pan || vendorObj?.panNumber || 'N/A';
    const vendorPhone = vendorObj?.phone || vendorObj?.contactNumber || vendorObj?.mobile || '';
    const vendorEmail = vendorObj?.email || '';

    // 2. Resolve Company Details
    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';
    const compPan = companyInfo?.panNumber || companyInfo?.pan || 'N/A';

    const copyTypes = [
        'ORIGINAL FOR CONSIGNEE',
        'DUPLICATE FOR TRANSPORTER',
        'TRIPLICATE FOR CONSIGNOR / FILE COPY'
    ];

    // Build Items Rows HTML
    let totalSentQty = 0;
    let totalExpectedQty = 0;
    let totalProcessValue = 0;
    let itemsTableRowsHtml = '';

    const items = doc.items || [];
    let rowIdx = 0;

    if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
            const sentQty = Number(item.quantitySent || 0);
            totalSentQty += sentQty;
            const rate = Number(item.processRate != null ? item.processRate : item.unitPrice) || 0;
            const lineVal = sentQty * rate;
            totalProcessValue += lineVal;

            const retList = (item.returningItems && item.returningItems.length > 0)
                ? item.returningItems
                : [{
                    receivedItemName: item.receivedItemName || item.itemToBeReceived || item.itemName,
                    quantityToBeReceived: item.quantityToBeReceived || item.quantitySent,
                    receivingUnit: item.receivingUnit || item.unit || 'PCS'
                }];

            retList.forEach((ret: any, rIdx: number) => {
                rowIdx++;
                const expQty = Number(ret.quantityToBeReceived || 0);
                totalExpectedQty += expQty;

                itemsTableRowsHtml += `
                    <tr>
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: center; padding: 5px 3px;">${idx + 1}</td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: left; font-weight: bold; padding: 5px 6px;">${item.itemName || ''} ${item.description ? `<div style="font-size: 8px; color: #475569; font-weight: normal;">${item.description}</div>` : ''}</td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: center; font-weight: bold; padding: 5px 4px;">${item.quantitySent || ''} ${item.unit || 'PCS'}</td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: left; padding: 5px 6px;"><b>${item.processType || 'Job Work'}</b></td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: center; font-family: monospace; font-weight: bold; padding: 5px 4px;">${rate > 0 ? '₹' + rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>` : ''}
                        <td style="text-align: left; font-weight: bold; color: #1e3a8a; padding: 5px 6px;">${ret.receivedItemName || ''}</td>
                        <td style="text-align: center; padding: 5px 4px;">${expQty} ${ret.receivingUnit || 'PCS'}</td>
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: right; font-family: monospace; font-weight: bold; padding: 5px 6px;">${lineVal > 0 ? '₹' + lineVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>` : ''}
                    </tr>
                `;
            });
        });

        // Fill blank rows for full page rendering
        for (let i = rowIdx; i < 5; i++) {
            itemsTableRowsHtml += `
                <tr>
                    <td style="height: 24px;"></td>
                    <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
            `;
        }
    } else {
        itemsTableRowsHtml = `<tr><td colspan="8" style="text-align: center; padding: 40px;">No items listed</td></tr>`;
    }

    // Build 3-Copy HTML Pages (HTML only, no raw JSX comments)
    const pagesHtml = copyTypes.map(copyType => `
        <div class="page" style="page-break-after: always; padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Copy Header Badge -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">${compName}</h1>
                    <div style="font-size: 10px; color: #444; margin-top: 3px;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #1e3a8a; color: #fff; font-size: 9px; font-weight: bold; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${copyType}
                    </span>
                    <div style="font-size: 9px; color: #666; margin-top: 4px;">GSTIN: <b>${compGst}</b> | PAN: <b>${compPan}</b></div>
                </div>
            </div>

            <!-- Document Title Bar -->
            <div style="text-align: center; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: bold; font-size: 13px; padding: 6px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 12px;">
                RETURNABLE - DELIVERY CHALLAN
            </div>

            <!-- Address & Logistics Panel -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px;">
                <tr>
                    <!-- Consignee / Vendor Details -->
                    <td style="width: 50%; vertical-align: top; border: 1px solid #94a3b8; padding: 10px; background: #fafafa;">
                        <div style="font-weight: bold; color: #64748b; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">TO (CONSIGNEE / SUBCONTRACTOR)</div>
                        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${vendorName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${vendorAddress ? vendorAddress + '<br>' : ''}
                            ${vendorCityState ? vendorCityState + '<br>' : ''}
                            ${vendorPhone ? '<b>Ph:</b> ' + vendorPhone + '<br>' : ''}
                            ${vendorEmail ? '<b>Email:</b> ' + vendorEmail + '<br>' : ''}
                        </div>
                        <div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                            <b>Party GSTIN:</b> ${vendorGst}<br>
                            <b>Party PAN:</b> ${vendorPan}
                        </div>
                    </td>

                    <!-- Challan Logistics Details -->
                    <td style="width: 50%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>DC NO:</b></td>
                                <td style="padding: 3px 0; font-weight: 900; font-size: 13px; color: #1e3a8a;">${doc.challanNumber || '-'}</td>
                                <td style="padding: 3px 0; color: #64748b; text-align: right;"><b>Date:</b></td>
                                <td style="padding: 3px 0; text-align: right; font-weight: bold;">${new Date(doc.date || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>E-Way Bill:</b></td>
                                <td colspan="3" style="padding: 3px 0; font-weight: bold; font-size: 12px; color: #0f172a;">${doc.ewayBillNo || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Our PO No:</b></td>
                                <td style="padding: 3px 0;">${doc.poNumber || '-'}</td>
                                <td style="padding: 3px 0; color: #64748b; text-align: right;"><b>Vehicle:</b></td>
                                <td style="padding: 3px 0; text-align: right;">${doc.vehicleNo || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Freight:</b></td>
                                <td style="padding: 3px 0;">${doc.freightType || 'To Pay'}</td>
                                <td style="padding: 3px 0; color: #64748b; text-align: right;"><b>Due Date:</b></td>
                                <td style="padding: 3px 0; text-align: right; font-weight: bold; color: #b91c1c;">${doc.expectedReturnDate ? new Date(doc.expectedReturnDate).toLocaleDateString('en-GB') : '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Est. Weight:</b></td>
                                <td style="padding: 3px 0;">${doc.estimatedWeight ? doc.estimatedWeight + ' Kgs' : '-'}</td>
                                <td style="padding: 3px 0; color: #64748b; text-align: right;"><b>Est. Value:</b></td>
                                <td style="padding: 3px 0; text-align: right; font-weight: bold;">${doc.estimatedPrice ? '₹' + Number(doc.estimatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (totalProcessValue > 0 ? '₹' + totalProcessValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #f1f5f9; text-transform: uppercase; font-weight: bold;">
                    <tr>
                        <th style="width: 4%; padding: 6px 3px; text-align: center;">Sl</th>
                        <th style="width: 22%; padding: 6px 6px; text-align: left;">Items Sent</th>
                        <th style="width: 9%; padding: 6px 4px; text-align: center;">Sent Qty</th>
                        <th style="width: 15%; padding: 6px 6px; text-align: left;">Process</th>
                        <th style="width: 11%; padding: 6px 4px; text-align: center;">Rate (₹)</th>
                        <th style="width: 20%; padding: 6px 6px; text-align: left;">Return Item</th>
                        <th style="width: 8%; padding: 6px 4px; text-align: center;">Exp Qty</th>
                        <th style="width: 11%; padding: 6px 6px; text-align: right;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #64748b;">
                    <tr>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Sent Qty =</td>
                        <td style="padding: 6px 4px; text-align: center;">${totalSentQty}</td>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Exp Qty =</td>
                        <td style="padding: 6px 4px; text-align: left;" colspan="2">${totalExpectedQty}</td>
                        <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-size: 11px;">₹${totalProcessValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Footer Terms & Signatures -->
            <div style="border: 1px solid #94a3b8; padding: 8px; background: #fafafa; margin-bottom: 10px; font-size: 9px; line-height: 1.4;">
                <b>Important Note:</b> Please arrange to return the material back to us on or before 
                <u style="font-weight: bold;">${doc.expectedReturnDate ? new Date(doc.expectedReturnDate).toLocaleDateString('en-GB') : '___________'}</u>. 
                While returning the material, please quote this Delivery Challan reference invariably on your return challan / document.
            </div>

            <table style="width: 100%; border: none; font-size: 10px; margin-top: 15px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px; text-align: center;">
                            Receiver's Signature & Stamp
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 30px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center;">
                            Authorised Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `).join('');

    // Open Print Window in Browser directly on Frontend!
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to download/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Returnable_DC_${doc.challanNumber || 'Document'}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; page-break-after: always; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Returnable DC PDF Ready (3 Copies)</span>
                <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${pagesHtml}
            </div>
            <script>
                // Auto trigger print prompt
                setTimeout(() => {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

export const generateFrontendRfqPDF = (data: { rfq: any; vendor?: any; companyInfo?: any }) => {
    const { rfq, vendor, companyInfo } = data;

    if (!rfq) {
        alert("No RFQ data provided for PDF generation");
        return;
    }

    // Resolve Vendor Details
    const vendorName = vendor?.name || rfq.vendorName || 'SUPPLIER / VENDOR';
    const vendorAddress = vendor?.address || vendor?.billingAddress || vendor?.street || '';
    const vendorCityState = `${vendor?.city || ''} ${vendor?.state || ''} ${vendor?.pincode ? '-' + vendor?.pincode : ''}`.trim();
    const vendorGst = vendor?.gst || vendor?.gstNumber || vendor?.gstin || 'N/A';
    const vendorPan = vendor?.pan || vendor?.panNumber || 'N/A';
    const vendorPhone = vendor?.phone || vendor?.contactNumber || vendor?.mobile || rfq.vendorPhone || '';
    const vendorEmail = vendor?.email || rfq.vendorEmail || '';

    // Resolve Company Details
    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';
    const compPan = companyInfo?.panNumber || companyInfo?.pan || 'N/A';

    const items = rfq.items || [];
    let totalQty = 0;
    let itemsTableRowsHtml = '';

    if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
            const qty = Number(item.quantity || 0);
            totalQty += qty;

            itemsTableRowsHtml += `
                <tr>
                    <td style="text-align: center; padding: 6px;">${idx + 1}</td>
                    <td style="text-align: left; font-weight: bold; padding: 6px;">
                        ${item.materialName || item.itemName || ''}
                        ${item.description ? `<div style="font-size: 9px; color: #475569; font-weight: normal;">${item.description}</div>` : ''}
                    </td>
                    <td style="text-align: center; font-weight: bold; padding: 6px;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                    <td style="text-align: center; padding: 6px; color: #64748b;">${item.targetPrice ? '₹' + item.targetPrice : '-'}</td>
                    <td style="text-align: left; padding: 6px;">${item.remarks || ''}</td>
                    <td style="text-align: center; padding: 6px; border-left: 2px solid #0284c7; background: #fafafa;">&nbsp;</td>
                </tr>
            `;
        });

        // Fill empty rows for neat spacing
        for (let i = items.length; i < 6; i++) {
            itemsTableRowsHtml += `
                <tr>
                    <td style="height: 28px;"></td>
                    <td></td><td></td><td></td><td></td>
                    <td style="border-left: 2px solid #0284c7; background: #fafafa;"></td>
                </tr>
            `;
        }
    } else {
        itemsTableRowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 30px;">No materials specified</td></tr>`;
    }

    const htmlContent = `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 12px;">
                <div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0369a1; text-transform: uppercase;">${compName}</h1>
                    <div style="font-size: 10px; color: #444; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #0284c7; color: #fff; font-size: 10px; font-weight: bold; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                        REQUEST FOR QUOTATION
                    </span>
                    ${compGst && compGst !== 'N/A' ? `<div style="font-size: 9px; color: #666; margin-top: 4px;">GSTIN: <b>${compGst}</b></div>` : ''}
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #f0f9ff; border: 1px solid #bae6fd; font-weight: bold; font-size: 14px; padding: 8px; text-transform: uppercase; letter-spacing: 1px; color: #0369a1; margin-bottom: 14px;">
                REQUEST FOR QUOTATION (RFQ)
            </div>

            <!-- Address & RFQ Logistics -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 12px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #0284c7; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">TO (TARGET VENDOR / SUPPLIER)</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${vendorName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${vendorAddress ? vendorAddress + '<br>' : ''}
                            ${vendorCityState ? vendorCityState + '<br>' : ''}
                            ${vendorPhone ? '<b>Ph:</b> ' + vendorPhone + '<br>' : ''}
                            ${vendorEmail ? '<b>Email:</b> ' + vendorEmail + '<br>' : ''}
                        </div>
                        ${(vendorGst && vendorGst !== 'N/A') ? `<div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px;"><b>GSTIN:</b> ${vendorGst}</div>` : ''}
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 12px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>RFQ No:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; font-size: 13px; color: #0369a1;">${rfq.rfqNumber || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>RFQ Date:</b></td>
                                <td style="padding: 4px 0; font-weight: bold;">${new Date(rfq.date || rfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Response Due Date:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; color: #b91c1c;">${rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString('en-GB') : 'Immediate'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>RFQ Status:</b></td>
                                <td style="padding: 4px 0; font-weight: bold; color: #0369a1;">${rfq.status || 'Sent'}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Requested Materials Table -->
            <div style="font-weight: bold; color: #334155; font-size: 11px; margin-bottom: 6px;">REQUESTED MATERIAL SPECIFICATIONS & VENDOR QUOTE SHEET</div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #f0f9ff; text-transform: uppercase; font-weight: bold; color: #0369a1;">
                    <tr>
                        <th style="width: 5%; padding: 7px 4px; text-align: center;">S.No</th>
                        <th style="width: 32%; padding: 7px 8px; text-align: left;">Item Description & Specifications</th>
                        <th style="width: 13%; padding: 7px 4px; text-align: center;">Req. Qty</th>
                        <th style="width: 12%; padding: 7px 4px; text-align: center;">Target Rate</th>
                        <th style="width: 18%; padding: 7px 8px; text-align: left;">Remarks / Specs</th>
                        <th style="width: 20%; padding: 7px 8px; text-align: center; background: #e0f2fe;">Vendor Quoted Rate (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #0284c7;">
                    <tr>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Required Quantity =</td>
                        <td style="padding: 6px; text-align: center;">${totalQty}</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Special Instructions & Terms -->
            <div style="border: 1px solid #94a3b8; padding: 10px; background: #fafafa; margin-bottom: 14px; font-size: 9.5px; line-height: 1.4;">
                <b style="color: #0369a1; font-size: 10px;">Vendor Response Instructions:</b><br>
                1. Please mention your best unit rate (excluding / including GST), HSN code, and lead time.<br>
                2. Indicate validity of quotation, payment terms, and freight charges.<br>
                ${rfq.remarks ? `3. <b>Special Note:</b> ${rfq.remarks}<br>` : ''}
            </div>

            <!-- Signatures -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 20px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Prepared By: <b>Purchase Department</b>
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 30px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center;">
                            Authorized Purchase Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Outward_RFQ_${rfq.rfqNumber || 'Document'}_${vendorName.replace(/[^a-zA-Z0-9]/g, '_')}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Vendor RFQ PDF: ${vendorName}</span>
                <button onclick="window.print()" style="background: #0284c7; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${htmlContent}
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

export const generateFrontendInwardRfqPDF = (data: { rfq: any; customer?: any; companyInfo?: any }) => {
    const { rfq, customer, companyInfo } = data;

    if (!rfq) {
        alert("No Inward RFQ data provided for PDF generation");
        return;
    }

    // Resolve Customer Details
    const custObj = customer || rfq.customer;
    const custName = custObj?.name || custObj?.companyName || rfq.customerName || 'CUSTOMER / CLIENT';
    const custAddress = custObj?.address || custObj?.billingAddress || custObj?.street || '';
    const custCityState = `${custObj?.city || ''} ${custObj?.state || ''} ${custObj?.pincode ? '-' + custObj?.pincode : ''}`.trim();
    const custGst = custObj?.gst || custObj?.gstNumber || custObj?.gstin || rfq.customerGst || 'N/A';
    const custPhone = custObj?.phone || custObj?.contactNumber || custObj?.mobile || rfq.customerPhone || '';
    const custEmail = custObj?.email || rfq.customerEmail || '';

    // Resolve Company Details
    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';

    const items = rfq.items || [];
    let totalQty = 0;
    let itemsTableRowsHtml = '';

    if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
            const qty = Number(item.quantity || 0);
            totalQty += qty;
            const itemName = item.fgItem?.name || item.itemName || 'FG Item';

            itemsTableRowsHtml += `
                <tr>
                    <td style="text-align: center; padding: 6px;">${idx + 1}</td>
                    <td style="text-align: left; font-weight: bold; padding: 6px;">
                        ${itemName}
                        ${item.description ? `<div style="font-size: 9px; color: #475569; font-weight: normal;">${item.description}</div>` : ''}
                    </td>
                    <td style="text-align: center; font-weight: bold; padding: 6px;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                    <td style="text-align: center; padding: 6px; color: #64748b;">${item.targetPrice ? '₹' + item.targetPrice : '-'}</td>
                    <td style="text-align: left; padding: 6px;">${item.remarks || item.specifications || ''}</td>
                </tr>
            `;
        });

        // Fill empty rows for neat spacing
        for (let i = items.length; i < 5; i++) {
            itemsTableRowsHtml += `
                <tr>
                    <td style="height: 28px;"></td>
                    <td></td><td></td><td></td><td></td>
                </tr>
            `;
        }
    } else {
        itemsTableRowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 30px;">No items specified</td></tr>`;
    }

    const htmlContent = `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 12px;">
                <div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #3730a3; text-transform: uppercase;">${compName}</h1>
                    <div style="font-size: 10px; color: #444; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #4f46e5; color: #fff; font-size: 10px; font-weight: bold; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                        INWARD CUSTOMER RFQ
                    </span>
                    ${compGst && compGst !== 'N/A' ? `<div style="font-size: 9px; color: #666; margin-top: 4px;">GSTIN: <b>${compGst}</b></div>` : ''}
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #eef2ff; border: 1px solid #c7d2fe; font-weight: bold; font-size: 14px; padding: 8px; text-transform: uppercase; letter-spacing: 1px; color: #3730a3; margin-bottom: 14px;">
                INWARD REQUEST FOR QUOTATION (INWARD RFQ)
            </div>

            <!-- Customer & RFQ Logistics -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 12px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #4f46e5; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">FROM (CUSTOMER / CLIENT)</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${custName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${custAddress ? custAddress + '<br>' : ''}
                            ${custCityState ? custCityState + '<br>' : ''}
                            ${custPhone ? '<b>Ph:</b> ' + custPhone + '<br>' : ''}
                            ${custEmail ? '<b>Email:</b> ' + custEmail + '<br>' : ''}
                        </div>
                        ${(custGst && custGst !== 'N/A') ? `<div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px;"><b>GSTIN:</b> ${custGst}</div>` : ''}
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 12px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>RFQ No:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; font-size: 13px; color: #3730a3;">${rfq.rfqNumber || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>RFQ Date:</b></td>
                                <td style="padding: 4px 0; font-weight: bold;">${new Date(rfq.date || rfq.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Expected Delivery:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; color: #b91c1c;">${rfq.dueDate || rfq.expectedDeliveryDate ? new Date(rfq.dueDate || rfq.expectedDeliveryDate).toLocaleDateString('en-GB') : 'Immediate'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Status:</b></td>
                                <td style="padding: 4px 0; font-weight: bold; color: #4f46e5;">${rfq.status || 'Open'}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Requested Materials Table -->
            <div style="font-weight: bold; color: #334155; font-size: 11px; margin-bottom: 6px;">CUSTOMER REQUESTED ITEMS & SPECIFICATIONS</div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #eef2ff; text-transform: uppercase; font-weight: bold; color: #3730a3;">
                    <tr>
                        <th style="width: 5%; padding: 7px 4px; text-align: center;">S.No</th>
                        <th style="width: 40%; padding: 7px 8px; text-align: left;">Item Description & Specifications</th>
                        <th style="width: 15%; padding: 7px 4px; text-align: center;">Req. Qty</th>
                        <th style="width: 15%; padding: 7px 4px; text-align: center;">Target Rate</th>
                        <th style="width: 25%; padding: 7px 8px; text-align: left;">Remarks / Specs</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #4f46e5;">
                    <tr>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Required Quantity =</td>
                        <td style="padding: 6px; text-align: center;">${totalQty}</td>
                        <td colspan="2"></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Special Instructions & Terms -->
            <div style="border: 1px solid #94a3b8; padding: 10px; background: #fafafa; margin-bottom: 14px; font-size: 9.5px; line-height: 1.4;">
                <b style="color: #3730a3; font-size: 10px;">Customer Notes / Instructions:</b><br>
                ${rfq.remarks ? `${rfq.remarks}<br>` : 'Standard Customer Inquiry'}
            </div>

            <!-- Signatures -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 20px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Received By: <b>Sales Department</b>
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 30px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center;">
                            Authorized Sales Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Inward_RFQ_${rfq.rfqNumber || 'Document'}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Inward Customer RFQ PDF: ${custName}</span>
                <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${htmlContent}
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

export const generateFrontendOutwardQuotationPDF = (data: { quotation: any; customer?: any; companyInfo?: any }) => {
    const { quotation, customer, companyInfo } = data;

    if (!quotation) {
        alert("No Outward Quotation data provided for PDF generation");
        return;
    }

    // Resolve Customer Details
    const custObj = customer || quotation.customer;
    const custName = custObj?.name || custObj?.companyName || quotation.customerName || 'CUSTOMER / CLIENT';
    const custAddress = custObj?.address || custObj?.billingAddress || quotation.customerAddress || '';
    const custCityState = `${custObj?.city || ''} ${custObj?.state || ''} ${custObj?.pincode ? '-' + custObj?.pincode : ''}`.trim();
    const custGst = custObj?.gst || custObj?.gstNumber || custObj?.gstin || quotation.customerGst || 'N/A';
    const custPhone = custObj?.phone || custObj?.contactNumber || custObj?.mobile || quotation.customerPhone || '';
    const custEmail = custObj?.email || quotation.customerEmail || '';

    // Resolve Company Details
    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';

    const items = quotation.items || [];
    let totalQty = 0;
    let itemsTableRowsHtml = '';

    if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.rate || item.unitPrice || 0);
            const tax = Number(item.taxRate != null ? item.taxRate : (item.tax != null ? item.tax : 18));
            const lineTotal = item.amount ? Number(item.amount) : (item.total ? Number(item.total) : (qty * rate * (1 + tax / 100)));
            const itemName = item.fgItem?.name || item.productName || 'FG Item';

            totalQty += qty;

            itemsTableRowsHtml += `
                <tr>
                    <td style="text-align: center; padding: 6px;">${idx + 1}</td>
                    <td style="text-align: left; font-weight: bold; padding: 6px;">
                        ${itemName}
                        ${item.description ? `<div style="font-size: 9px; color: #475569; font-weight: normal;">${item.description}</div>` : ''}
                    </td>
                    <td style="text-align: center; font-weight: bold; padding: 6px;">${qty} ${item.unit || 'PCS'}</td>
                    <td style="text-align: right; padding: 6px; font-weight: bold;">₹${rate.toLocaleString()}</td>
                    <td style="text-align: center; padding: 6px;">${tax > 0 ? tax + '%' : '-'}</td>
                    <td style="text-align: right; padding: 6px; font-weight: 800; color: #0f172a;">₹${lineTotal.toLocaleString()}</td>
                </tr>
            `;
        });
    } else {
        itemsTableRowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 30px;">No quoted items specified</td></tr>`;
    }

    const subtotal = quotation.subtotal ? Number(quotation.subtotal) : 0;
    const taxAmount = quotation.taxAmount ? Number(quotation.taxAmount) : (quotation.totalTax ? Number(quotation.totalTax) : 0);
    const transCharges = quotation.transportationCharges ? Number(quotation.transportationCharges) : 0;
    const packCharges = quotation.packagingCharges ? Number(quotation.packagingCharges) : 0;
    const grandTotal = quotation.totalAmount ? Number(quotation.totalAmount) : (quotation.grandTotal ? Number(quotation.grandTotal) : subtotal + taxAmount + transCharges + packCharges);

    const transMode = quotation.transportationType || 'Standard Freight';
    const packType = quotation.packagingType || 'Standard Packing';

    const htmlContent = `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 12px;">
                <div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #3730a3; text-transform: uppercase;">${compName}</h1>
                    <div style="font-size: 10px; color: #444; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: #475569; font-weight: bold;">GSTIN: <b>${compGst}</b></div>
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #eef2ff; border: 1px solid #c7d2fe; font-weight: bold; font-size: 15px; padding: 8px; text-transform: uppercase; letter-spacing: 1px; color: #3730a3; margin-bottom: 14px;">
                QUOTATION
            </div>

            <!-- Address & Quotation Details -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 12px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #4f46e5; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">QUOTATION PREPARED FOR (CUSTOMER / CLIENT)</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${custName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${custAddress ? custAddress + '<br>' : ''}
                            ${custCityState ? custCityState + '<br>' : ''}
                            ${custPhone ? '<b>Ph:</b> ' + custPhone + '<br>' : ''}
                            ${custEmail ? '<b>Email:</b> ' + custEmail + '<br>' : ''}
                        </div>
                        ${custGst && custGst !== 'N/A' ? `<div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px;"><b>GSTIN:</b> ${custGst}</div>` : ''}
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 12px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Quote No:</b></td>
                                <td style="padding: 3px 0; font-weight: 900; font-size: 13px; color: #3730a3;">${quotation.quotationNumber || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Linked RFQ No:</b></td>
                                <td style="padding: 3px 0; font-weight: bold; color: #4f46e5;">${quotation.rfqNumber || quotation.rfq?.rfqNumber || 'Direct'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Quote Date:</b></td>
                                <td style="padding: 3px 0; font-weight: bold;">${new Date(quotation.date || quotation.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Valid Until:</b></td>
                                <td style="padding: 3px 0; font-weight: bold; color: #b91c1c;">${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-GB') : 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Transportation:</b></td>
                                <td style="padding: 3px 0; font-weight: bold;">${transMode}</td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0; color: #64748b;"><b>Packaging:</b></td>
                                <td style="padding: 3px 0; font-weight: bold;">${packType}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Quoted Material Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #eef2ff; text-transform: uppercase; font-weight: bold; color: #3730a3;">
                    <tr>
                        <th style="width: 5%; padding: 7px 4px; text-align: center;">S.No</th>
                        <th style="width: 35%; padding: 7px 8px; text-align: left;">Product / Item Description</th>
                        <th style="width: 12%; padding: 7px 4px; text-align: center;">Quantity</th>
                        <th style="width: 15%; padding: 7px 8px; text-align: right;">Unit Rate</th>
                        <th style="width: 11%; padding: 7px 4px; text-align: center;">GST %</th>
                        <th style="width: 22%; padding: 7px 8px; text-align: right;">Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #4f46e5;">
                    ${subtotal ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Subtotal =</td>
                            <td style="padding: 5px 8px; text-align: right;">₹${subtotal.toLocaleString()}</td>
                        </tr>
                    ` : ''}
                    ${taxAmount ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">GST Tax =</td>
                            <td style="padding: 5px 8px; text-align: right;">₹${taxAmount.toLocaleString()}</td>
                        </tr>
                    ` : ''}
                    ${transCharges > 0 ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Freight / Transport Charges (${transMode}) =</td>
                            <td style="padding: 5px 8px; text-align: right;">₹${transCharges.toLocaleString()}</td>
                        </tr>
                    ` : ''}
                    ${packCharges > 0 ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Packaging Charges (${packType}) =</td>
                            <td style="padding: 5px 8px; text-align: right;">₹${packCharges.toLocaleString()}</td>
                        </tr>
                    ` : ''}
                    <tr style="font-size: 11px; background: #eef2ff; color: #3730a3;">
                        <td colspan="5" style="padding: 7px 8px; text-align: right;">Grand Total Amount =</td>
                        <td style="padding: 7px 8px; text-align: right; font-weight: 900;">₹${grandTotal.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Special Instructions & Commercial Terms -->
            <div style="border: 1px solid #94a3b8; padding: 10px; background: #fafafa; margin-bottom: 14px; font-size: 9.5px; line-height: 1.4;">
                <b style="color: #3730a3; font-size: 10px;">Terms & Conditions:</b><br>
                ${quotation.otherDetails || quotation.remarks || quotation.termsAndConditions || 'Standard Sales Commercial Terms Apply'}
            </div>

            <!-- Signatures -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 25px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Prepared By: <b>Sales Department</b>
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 30px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center;">
                            Authorized Sales Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Outward_Quotation_${quotation.quotationNumber || 'Document'}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Outward Sales Quotation PDF: ${custName}</span>
                <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${htmlContent}
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

export const generateFrontendVendorQuotationPDF = (data: { quotation: any; vendor?: any; companyInfo?: any }) => {
    const { quotation, vendor, companyInfo } = data;

    if (!quotation) {
        alert("No Quotation data provided for PDF generation");
        return;
    }

    // Resolve Vendor Details
    const vendorObj = vendor || quotation.vendor;
    const vendorName = vendorObj?.name || quotation.vendorName || 'SUPPLIER / VENDOR';
    const vendorAddress = vendorObj?.address || vendorObj?.billingAddress || quotation.vendorAddress || '';
    const vendorCityState = `${vendorObj?.city || ''} ${vendorObj?.state || ''} ${vendorObj?.pincode ? '-' + vendorObj?.pincode : ''}`.trim();
    const vendorGst = vendorObj?.gst || vendorObj?.gstNumber || quotation.vendorGst || 'N/A';
    const vendorPan = vendorObj?.pan || vendorObj?.panNumber || 'N/A';
    const vendorPhone = vendorObj?.phone || vendorObj?.contactNumber || quotation.vendorPhone || '';
    const vendorEmail = vendorObj?.email || quotation.vendorEmail || '';

    // Resolve Company Details
    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';

    const items = quotation.items || [];
    let totalQty = 0;
    let itemsTableRowsHtml = '';

    if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.unitPrice || 0);
            const tax = Number(item.tax || 0);
            const lineTotal = item.total ? Number(item.total) : (qty * rate * (1 + tax / 100));

            totalQty += qty;

            itemsTableRowsHtml += `
                <tr>
                    <td style="text-align: center; padding: 6px;">${idx + 1}</td>
                    <td style="text-align: left; font-weight: bold; padding: 6px;">${item.materialName || item.itemName || ''}</td>
                    <td style="text-align: center; font-weight: bold; padding: 6px;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                    <td style="text-align: right; padding: 6px; font-weight: bold;">₹${rate.toLocaleString()}</td>
                    <td style="text-align: center; padding: 6px;">${tax > 0 ? tax + '%' : '-'}</td>
                    <td style="text-align: right; padding: 6px; font-weight: 800; color: #0f172a;">₹${lineTotal.toLocaleString()}</td>
                </tr>
            `;
        });
    } else {
        itemsTableRowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 30px;">No quoted materials specified</td></tr>`;
    }

    const htmlContent = `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0891b2; padding-bottom: 12px; margin-bottom: 12px;">
                <div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0e7490; text-transform: uppercase;">${compName}</h1>
                    <div style="font-size: 10px; color: #444; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #0891b2; color: #fff; font-size: 10px; font-weight: bold; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                        INCOMING VENDOR QUOTATION
                    </span>
                    <div style="font-size: 9px; color: #666; margin-top: 4px;">GSTIN: <b>${compGst}</b></div>
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #ecfeff; border: 1px solid #a5f3fc; font-weight: bold; font-size: 14px; padding: 8px; text-transform: uppercase; letter-spacing: 1px; color: #0e7490; margin-bottom: 14px;">
                VENDOR QUOTATION RATE SHEET
            </div>

            <!-- Address & Quotation Details -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 12px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #0891b2; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">QUOTATION FROM VENDOR</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${vendorName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${vendorAddress ? vendorAddress + '<br>' : ''}
                            ${vendorCityState ? vendorCityState + '<br>' : ''}
                            ${vendorPhone ? '<b>Ph:</b> ' + vendorPhone + '<br>' : ''}
                            ${vendorEmail ? '<b>Email:</b> ' + vendorEmail + '<br>' : ''}
                        </div>
                        <div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                            <b>GSTIN:</b> ${vendorGst} | <b>PAN:</b> ${vendorPan}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 12px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Quote No:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; font-size: 13px; color: #0e7490;">${quotation.quotationNumber || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Linked RFQ No:</b></td>
                                <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">${quotation.rfqNumber || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Quote Date:</b></td>
                                <td style="padding: 4px 0; font-weight: bold;">${new Date(quotation.date || quotation.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Valid Until:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; color: #b91c1c;">${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-GB') : 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>Approval Status:</b></td>
                                <td style="padding: 4px 0; font-weight: bold; color: #16a34a;">${quotation.status || 'Pending Approval'}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Quoted Material Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #ecfeff; text-transform: uppercase; font-weight: bold; color: #0e7490;">
                    <tr>
                        <th style="width: 5%; padding: 7px 4px; text-align: center;">S.No</th>
                        <th style="width: 35%; padding: 7px 8px; text-align: left;">Item Description</th>
                        <th style="width: 12%; padding: 7px 4px; text-align: center;">Quantity</th>
                        <th style="width: 15%; padding: 7px 8px; text-align: right;">Unit Rate</th>
                        <th style="width: 11%; padding: 7px 4px; text-align: center;">GST %</th>
                        <th style="width: 22%; padding: 7px 8px; text-align: right;">Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #0891b2;">
                    ${quotation.subtotal ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Subtotal =</td>
                            <td style="padding: 5px 8px; text-align: right;">₹${Number(quotation.subtotal).toLocaleString()}</td>
                        </tr>
                    ` : ''}
                    ${quotation.totalTax ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">GST Tax =</td>
                            <td style="padding: 5px 8px; text-align: right;">₹${Number(quotation.totalTax).toLocaleString()}</td>
                        </tr>
                    ` : ''}
                    <tr style="font-size: 11px; background: #e0f2fe; color: #0369a1;">
                        <td colspan="5" style="padding: 7px 8px; text-align: right;">Grand Total Amount =</td>
                        <td style="padding: 7px 8px; text-align: right; font-weight: 900;">₹${Number(quotation.grandTotal || quotation.subtotal || 0).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Signatures -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 25px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Prepared By: <b>Purchase Department</b>
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 30px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center;">
                            Authorized Purchase Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vendor_Quotation_${quotation.quotationNumber || 'Document'}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Vendor Quotation PDF: ${vendorName}</span>
                <button onclick="window.print()" style="background: #0891b2; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${htmlContent}
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

export const generateFrontendPoPDF = (data: { po: any; vendor?: any; companyInfo?: any }) => {
    const { po, vendor, companyInfo } = data;

    if (!po) {
        alert("No Purchase Order data provided for PDF generation");
        return;
    }

    // Resolve Vendor Details
    const vendorObj = vendor || po.vendor;
    const vendorName = vendorObj?.name || po.vendorName || 'SUPPLIER / VENDOR';
    const vendorAddress = vendorObj?.address || vendorObj?.billingAddress || po.vendorAddress || '';
    const vendorCityState = `${vendorObj?.city || ''} ${vendorObj?.state || ''} ${vendorObj?.pincode ? '-' + vendorObj?.pincode : ''}`.trim();
    const vendorGst = vendorObj?.gst || vendorObj?.gstNumber || po.vendorGst || 'N/A';
    const vendorPan = vendorObj?.pan || vendorObj?.panNumber || 'N/A';
    const vendorPhone = vendorObj?.phone || vendorObj?.contactNumber || po.vendorPhone || '';
    const vendorEmail = vendorObj?.email || po.vendorEmail || '';

    // Resolve Company Details
    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';

    const items = (po.items && po.items.length > 0) 
        ? po.items 
        : [{
            materialName: po.materialName || po.material?.name || 'Material Item',
            description: po.description || po.remarks || po.itemDescription || po.specifications || '',
            quantity: po.quantity || 1,
            unit: po.unit || 'PCS',
            rate: po.rate || po.amount || 0,
            taxRate: po.taxRate != null ? po.taxRate : 18,
            amount: po.amount || (po.quantity * po.rate) || 0
        }];

    let itemsSubtotal = 0;
    let totalTaxAmount = 0;
    let itemsTableRowsHtml = '';

    items.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity || 1);
        const rate = Number(item.rate || item.unitPrice || 0);
        const taxRate = item.taxRate != null ? Number(item.taxRate) : 18;
        const lineNet = qty * rate;
        const lineTax = item.taxAmount != null ? Number(item.taxAmount) : (lineNet * (taxRate / 100));
        const lineTotal = item.amount ? Number(item.amount) : (lineNet + lineTax);
        const itemDesc = item.description || item.itemDescription || item.remarks || item.specifications || item.material?.description || (idx === 0 ? (po.description || po.remarks) : '') || '';

        itemsSubtotal += lineNet;
        totalTaxAmount += lineTax;

        itemsTableRowsHtml += `
            <tr>
                <td style="text-align: center; padding: 7px 4px; vertical-align: top;">${idx + 1}</td>
                <td style="text-align: left; padding: 7px 8px; vertical-align: top;">
                    <div style="font-weight: bold; color: #0f172a; font-size: 11px;">${item.materialName || item.material?.name || item.itemName || 'Material Item'}</div>
                    ${itemDesc ? `<div style="font-size: 9.5px; color: #475569; margin-top: 3px; font-style: italic;">${itemDesc}</div>` : ''}
                </td>
                <td style="text-align: center; font-weight: bold; padding: 7px 4px; vertical-align: top;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                <td style="text-align: right; padding: 7px 8px; font-weight: bold; vertical-align: top;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: center; padding: 7px 6px; font-size: 10px; vertical-align: top;">
                    <b>${taxRate}%</b><br>
                    <span style="color: #64748b; font-size: 9px;">₹${lineTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </td>
                <td style="text-align: right; padding: 7px 8px; font-weight: 800; color: #0f172a; vertical-align: top;">₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    const transportCharge = Number(po.transportCharge || 0);
    const transportType = po.transportType || 'Road Freight';
    const packingCharge = Number(po.packingCharge || 0);
    const packingType = po.packingType || 'Standard Packaging';

    const grandTotal = itemsSubtotal + totalTaxAmount + transportCharge + packingCharge;

    const htmlContent = `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Header (Clean Top Right) -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #581c87; padding-bottom: 12px; margin-bottom: 14px;">
                <div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #581c87; text-transform: uppercase;">${compName}</h1>
                    <div style="font-size: 10px; color: #444; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #f3e8ff; border: 1px solid #d8b4fe; font-weight: 900; font-size: 14px; padding: 8px; text-transform: uppercase; letter-spacing: 1px; color: #581c87; margin-bottom: 14px; border-radius: 4px;">
                PURCHASE ORDER
            </div>

            <!-- Address & PO Details -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 12px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #6b21a8; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">VENDOR / SUPPLIER</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${vendorName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${vendorAddress ? vendorAddress + '<br>' : ''}
                            ${vendorCityState ? vendorCityState + '<br>' : ''}
                            ${vendorPhone ? '<b>Ph:</b> ' + vendorPhone + '<br>' : ''}
                            ${vendorEmail ? '<b>Email:</b> ' + vendorEmail + '<br>' : ''}
                        </div>
                        <div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                            <b>Vendor GSTIN:</b> ${vendorGst} | <b>PAN:</b> ${vendorPan}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 12px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>PO Number:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; font-size: 13px; color: #6b21a8;">${po.poNumber || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>PO Date:</b></td>
                                <td style="padding: 4px 0; font-weight: bold;">${new Date(po.date || po.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            ${po.quotationNumber ? `
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;"><b>Ref Quotation:</b></td>
                                    <td style="padding: 4px 0; font-weight: bold; color: #0e7490;">${po.quotationNumber}</td>
                                </tr>
                            ` : ''}
                            ${po.rfqNumber ? `
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;"><b>Ref RFQ:</b></td>
                                    <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">${po.rfqNumber}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td style="padding: 4px 0; color: #64748b;"><b>PO Status:</b></td>
                                <td style="padding: 4px 0; font-weight: bold; color: #16a34a;">${po.status || 'Released'}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Materials Table with Description & GST -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #faf5ff; text-transform: uppercase; font-weight: bold; color: #6b21a8;">
                    <tr>
                        <th style="width: 5%; padding: 7px 4px; text-align: center;">S.No</th>
                        <th style="width: 40%; padding: 7px 8px; text-align: left;">Item Name & Specifications</th>
                        <th style="width: 12%; padding: 7px 4px; text-align: center;">Qty</th>
                        <th style="width: 15%; padding: 7px 8px; text-align: right;">Unit Rate</th>
                        <th style="width: 13%; padding: 7px 6px; text-align: center;">GST % (Tax)</th>
                        <th style="width: 15%; padding: 7px 8px; text-align: right;">Line Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
            </table>

            <!-- Logistics Charges & Financial Breakdown -->
            <div style="display: flex; justify-content: space-between; gap: 14px; margin-bottom: 14px;">
                <div style="flex: 1; border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; border-radius: 4px;">
                    <div style="font-weight: bold; color: #6b21a8; font-size: 10px; uppercase; margin-bottom: 6px;">LOGISTICS & FREIGHT DETAILS</div>
                    <table style="width: 100%; font-size: 10px; line-height: 1.6;">
                        <tr>
                            <td style="color: #64748b;"><b>Transport Type:</b></td>
                            <td style="font-weight: bold; text-align: right;">${transportType}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b;"><b>Freight Charge:</b></td>
                            <td style="font-weight: bold; text-align: right;">₹${transportCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b;"><b>Packing Type:</b></td>
                            <td style="font-weight: bold; text-align: right;">${packingType}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b;"><b>Packing Charge:</b></td>
                            <td style="font-weight: bold; text-align: right;">₹${packingCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </table>
                </div>

                <div style="width: 320px; border: 1px solid #6b21a8; padding: 10px; background: #faf5ff; border-radius: 4px;">
                    <div style="font-weight: bold; color: #6b21a8; font-size: 10px; uppercase; margin-bottom: 6px; border-bottom: 1px border #e9d5ff; padding-bottom: 4px;">SUMMARY BREAKDOWN</div>
                    <table style="width: 100%; font-size: 10.5px; line-height: 1.7;">
                        <tr>
                            <td style="color: #475569;">Items Subtotal:</td>
                            <td style="font-weight: bold; text-align: right;">₹${itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td style="color: #475569;">Total GST Tax:</td>
                            <td style="font-weight: bold; text-align: right;">₹${totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ${transportCharge > 0 ? `
                        <tr>
                            <td style="color: #0891b2;">Freight Charge:</td>
                            <td style="font-weight: bold; text-align: right; color: #0891b2;">+ ₹${transportCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ` : ''}
                        ${packingCharge > 0 ? `
                        <tr>
                            <td style="color: #4f46e5;">Packing Charge:</td>
                            <td style="font-weight: bold; text-align: right; color: #4f46e5;">+ ₹${packingCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ` : ''}
                        <tr style="border-top: 2px solid #6b21a8; font-size: 12px;">
                            <td style="font-weight: 900; color: #581c87; padding-top: 6px;">Grand Total PO Value:</td>
                            <td style="font-weight: 900; text-align: right; color: #581c87; padding-top: 6px;">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Special Instructions & Terms -->
            ${po.remarks ? `
                <div style="border: 1px solid #cbd5e1; padding: 10px; background: #fafafa; margin-bottom: 14px; font-size: 9.5px; line-height: 1.4; border-radius: 4px;">
                    <b style="color: #6b21a8;">Terms & Special Instructions:</b><br>
                    ${po.remarks}
                </div>
            ` : ''}

            <!-- Signatures -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 25px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Prepared By: <b>Purchase Department</b>
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 30px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center;">
                            Authorized Purchase Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PO_${po.poNumber || 'Document'}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>PO PDF: ${po.poNumber || ''}</span>
                <button onclick="window.print()" style="background: #6b21a8; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${htmlContent}
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

/**
 * Generate Delivery Challan PDF matching Outward Sales Quotation PDF color theme (#3730a3, #4f46e5, #eef2ff)
 * and native Indian Rupee symbol ₹ rendering.
 */
export const generateFrontendDcPDF = (data: { doc: any; companyInfo?: any; copyType?: "all" | "original" | "duplicate" | "triplicate" }) => {
    const { doc, companyInfo, copyType = "all" } = data;

    if (!doc) {
        alert("No Delivery Challan data provided for PDF generation");
        return;
    }

    // Number to Words Converter (Indian Currency Format)
    function numberToWords(num: number): string {
        if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
        const a = [
            "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
            "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
        ];
        const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

        function inWords(n: number): string {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : " ");
            if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 ? inWords(n % 100) : "");
            if (n < 100000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 ? inWords(n % 1000) : "");
            if (n < 10000000) return inWords(Math.floor(n / 100000)) + "Lakh " + (n % 100000 ? inWords(n % 100000) : "");
            return inWords(Math.floor(n / 10000000)) + "Crore " + (n % 10000000 ? inWords(n % 10000000) : "");
        }

        const integerPart = Math.floor(num);
        const decimalPart = Math.round((num - integerPart) * 100);

        let str = "Rupees " + inWords(integerPart).trim();
        if (decimalPart > 0) {
            str += " and " + inWords(decimalPart).trim() + " Paise";
        }
        return str + " Only";
    }

    // 1. Resolve Company Master Details
    let masterCompany = companyInfo;
    if (!masterCompany || !masterCompany.companyName) {
        try {
            const storedCompany = localStorage.getItem("companyInfo");
            const storedUser = localStorage.getItem("userInfo");
            if (storedCompany) masterCompany = { ...JSON.parse(storedCompany), ...companyInfo };
            else if (storedUser) masterCompany = { ...JSON.parse(storedUser), ...companyInfo };
        } catch (e) {
            console.warn("Could not parse cached company info:", e);
        }
    }

    const compName = masterCompany?.companyName || masterCompany?.name || 'COMPANY MASTER';
    const compAddressRaw = masterCompany?.billingAddress || masterCompany?.address || masterCompany?.location || '';
    const compCityState = [masterCompany?.city, masterCompany?.state, masterCompany?.pincode ? `- ${masterCompany.pincode}` : ''].filter(Boolean).join(' ');
    const compAddress = [compAddressRaw, compCityState].filter(Boolean).join(', ');
    const compPhone = masterCompany?.contactNumber || masterCompany?.phone || masterCompany?.mobile || '';
    const compEmail = masterCompany?.email || '';
    const compGst = masterCompany?.gstin || masterCompany?.gstNumber || masterCompany?.gst || 'N/A';
    const compPan = masterCompany?.panNumber || masterCompany?.pan || 'N/A';

    const bankName = masterCompany?.bankDetails?.bankName || masterCompany?.bankName || '-';
    const accountNumber = masterCompany?.bankDetails?.accountNumber || masterCompany?.accountNumber || '-';
    const ifscCode = masterCompany?.bankDetails?.ifscCode || masterCompany?.ifscCode || '-';
    const branchName = masterCompany?.bankDetails?.branchName || masterCompany?.branchName || '';

    // 2. Resolve Customer Details
    const custObj = typeof doc.customer === 'object' ? doc.customer : {};
    const custName = doc.customerName || custObj?.name || custObj?.companyName || 'Internal Customer / Cash Sales';
    const custAddressRaw = doc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || '';
    const custCityState = [custObj?.city, custObj?.state, custObj?.pincode].filter(Boolean).join(' ');
    const custAddress = custAddressRaw && custCityState ? `${custAddressRaw}, ${custCityState}` : (custAddressRaw || '-');
    const custGst = doc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || 'N/A';
    const custPhone = doc.customerPhone || custObj?.phone || custObj?.contactNumber || '';
    const custEmail = doc.customerEmail || custObj?.email || '';
    const custPoRef = doc.customerPoReference || doc.poNumber || '-';
    const custPoDate = doc.poDate ? new Date(doc.poDate).toLocaleDateString("en-IN") : '-';

    // 3. Document Logistics Metadata
    const docNum = doc.dcNumber || 'DC-001';
    const creationDateTimeStr = doc.createdAt || doc.date ? new Date(doc.createdAt || doc.date).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    }) : '-';
    const transportMode = doc.transportationType || doc.transportType || doc.transportMode || 'Road Transport';
    const vehicleNo = doc.vehicleNumber || doc.vehicleNo || '-';
    const packagingType = doc.packagingType || 'Standard Packaging';
    const eWayNo = doc.eWayBillNo || doc.eWayNo || '-';

    // 4. Resolve Copy Types
    let copyTypes = [
        'ORIGINAL FOR RECIPIENT',
        'DUPLICATE FOR TRANSPORTER',
        'TRIPLICATE FOR SUPPLIER'
    ];

    if (copyType === "original") copyTypes = ['ORIGINAL FOR RECIPIENT'];
    else if (copyType === "duplicate") copyTypes = ['DUPLICATE FOR TRANSPORTER'];
    else if (copyType === "triplicate") copyTypes = ['TRIPLICATE FOR SUPPLIER'];

    // 5. Line Items HTML
    const items = doc.items || [];
    let itemsTableRowsHtml = '';

    items.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity || item.qty || 0);
        const rate = Number(item.rate || item.unitPrice || item.price || 0);
        const amount = Number(item.amount || item.lineTotal || (qty * rate));
        const itemName = item.materialName || item.productName || item.itemName || item.name || 'Item';
        const hsn = item.hsnCode || item.hsn || '-';
        const remarks = item.remarks || item.description || item.specifications || '-';

        itemsTableRowsHtml += `
            <tr>
                <td style="text-align: center; padding: 6px;">${idx + 1}</td>
                <td style="text-align: left; font-weight: bold; padding: 6px; color: #0f172a;">
                    ${itemName}
                </td>
                <td style="text-align: center; padding: 6px; font-family: monospace;">${hsn}</td>
                <td style="text-align: center; font-weight: bold; padding: 6px; color: #3730a3;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                <td style="text-align: right; padding: 6px; font-family: monospace;">₹${rate ? rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td style="text-align: right; padding: 6px; font-weight: 800; font-family: monospace; color: #0f172a;">₹${amount ? amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td style="text-align: left; padding: 6px; color: #475569; font-size: 9.5px;">${remarks}</td>
            </tr>
        `;
    });

    // Pad blank rows if items < 5
    for (let i = items.length; i < 5; i++) {
        itemsTableRowsHtml += `
            <tr>
                <td style="height: 24px; padding: 6px;"></td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
        `;
    }

    const subtotal = doc.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(doc.transportationCharges || doc.freightCharges || 0);
    const packagingCharges = Number(doc.packagingCharges || 0);
    const discount = Number(doc.discount || 0);
    const taxAmount = doc.taxAmount || items.reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
    const grandTotal = doc.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

    const pagesHtml = copyTypes.map((copyBadge) => `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; font-family: Arial, sans-serif; font-size: 11px; color: #111; margin-bottom: 20px; page-break-after: always; position: relative; box-sizing: border-box;">
            
            <!-- Company Header & Copy Badge -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #3730a3; text-transform: uppercase; letter-spacing: -0.5px;">${compName}</h1>
                    <div style="font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                    <div style="font-size: 9.5px; color: #1e293b; font-weight: bold; margin-top: 4px;">
                        GSTIN: <b>${compGst}</b> | PAN: <b>${compPan}</b>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #3730a3; color: #ffffff; font-size: 9px; font-weight: 900; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${copyBadge}
                    </span>
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #eef2ff; border: 1px solid #c7d2fe; font-weight: bold; font-size: 14px; padding: 7px; text-transform: uppercase; letter-spacing: 1px; color: #3730a3; margin-bottom: 12px;">
                DELIVERY CHALLAN
            </div>

            <!-- Buyer & Logistics Details Grid -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px;">
                <tr>
                    <td style="width: 52%; vertical-align: top; border: 1px solid #94a3b8; padding: 10px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #4f46e5; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">BUYER / CONSIGNEE DETAILS</div>
                        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${custName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${custAddress ? '<b>Address:</b> ' + custAddress + '<br>' : ''}
                            ${custPhone ? '<b>Contact:</b> ' + custPhone + '<br>' : ''}
                            ${custEmail ? '<b>Email:</b> ' + custEmail + '<br>' : ''}
                        </div>
                        ${custGst && custGst !== 'N/A' ? `<div style="margin-top: 6px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 4px;"><b>GSTIN:</b> ${custGst}</div>` : ''}
                        ${custPoRef && custPoRef !== '-' ? `<div style="margin-top: 4px; font-size: 10px; color: #3730a3;"><b>PO Ref:</b> ${custPoRef} ${custPoDate !== '-' ? `(Date: ${custPoDate})` : ''}</div>` : ''}
                    </td>

                    <td style="width: 48%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>DC Number:</b></td>
                                <td style="padding: 2.5px 0; font-weight: 900; font-size: 12.5px; color: #3730a3; font-family: monospace;">${docNum}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Creation Date & Time:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold;">${creationDateTimeStr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Transport Mode:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold;">${transportMode}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Vehicle Number:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold; font-family: monospace;">${vehicleNo}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Packaging Type:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold;">${packagingType}</td>
                            </tr>
                            ${eWayNo && eWayNo !== '-' ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>E-Way Bill No:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold; font-family: monospace; color: #3730a3;">${eWayNo}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Itemized Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #eef2ff; text-transform: uppercase; font-weight: bold; color: #3730a3;">
                    <tr>
                        <th style="width: 5%; padding: 6px 4px; text-align: center;">S.No</th>
                        <th style="width: 32%; padding: 6px 8px; text-align: left;">Product / Item Description</th>
                        <th style="width: 11%; padding: 6px 4px; text-align: center;">HSN</th>
                        <th style="width: 10%; padding: 6px 4px; text-align: center;">Qty</th>
                        <th style="width: 13%; padding: 6px 8px; text-align: right;">Unit Rate</th>
                        <th style="width: 14%; padding: 6px 8px; text-align: right;">Total Amount</th>
                        <th style="width: 15%; padding: 6px 6px; text-align: left;">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
            </table>

            <!-- Bottom Docked Summary & Financial Calculations -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 10px; background: #fafafa;">
                        <div style="font-weight: bold; color: #3730a3; font-size: 9.5px; text-transform: uppercase; margin-bottom: 4px;">BANK DETAILS & REMARKS</div>
                        <div style="font-size: 9.5px; color: #334155; line-height: 1.4;">
                            Bank: <b>${bankName}</b> | A/c: <b>${accountNumber}</b> | IFSC: <b>${ifscCode}</b> ${branchName ? `| Branch: ${branchName}` : ''}<br>
                            ${doc.remarks || doc.otherDetails ? `Remarks: ${doc.remarks || doc.otherDetails}<br>` : ''}
                            Terms: Subject to local jurisdiction. Goods dispatched in good condition.
                        </div>
                        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; font-size: 10px; font-style: italic;">
                            Amount in Words: ${numberToWords(grandTotal)}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Subtotal:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ${transportCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Freight / Transport:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ₹${transportCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${packagingCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Packaging Charges:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ₹${packagingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${discount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Discount:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">- ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${taxAmount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Tax Amount (GST):</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: #eef2ff; color: #3730a3; font-weight: 900; font-size: 11.5px;">
                                <td style="padding: 6px 6px; border: 1px solid #c7d2fe;">GRAND TOTAL:</td>
                                <td style="padding: 6px 6px; text-align: right; border: 1px solid #c7d2fe; font-family: monospace;">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Signatures Pinned at Bottom -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 20px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Receiver's Signature / Seal
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 25px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center; font-size: 9.5px;">
                            Authorized Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Delivery_Challan_${docNum}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; margin-bottom: 0 !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Delivery Challan PDF: ${custName}</span>
                <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${pagesHtml}
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

/**
 * Generate Tax Invoice PDF matching Outward Sales Quotation PDF color theme (#3730a3, #4f46e5, #eef2ff)
 * and native Indian Rupee symbol ₹ rendering.
 */
export const generateFrontendInvoicePDF = (data: { doc: any; companyInfo?: any; copyType?: "all" | "original" | "duplicate" | "triplicate" }) => {
    const { doc, companyInfo, copyType = "all" } = data;

    if (!doc) {
        alert("No Tax Invoice data provided for PDF generation");
        return;
    }

    // Number to Words Converter (Indian Currency Format)
    function numberToWords(num: number): string {
        if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
        const a = [
            "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
            "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
        ];
        const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

        function inWords(n: number): string {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : " ");
            if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 ? inWords(n % 100) : "");
            if (n < 100000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 ? inWords(n % 1000) : "");
            if (n < 10000000) return inWords(Math.floor(n / 100000)) + "Lakh " + (n % 100000 ? inWords(n % 100000) : "");
            return inWords(Math.floor(n / 10000000)) + "Crore " + (n % 10000000 ? inWords(n % 10000000) : "");
        }

        const integerPart = Math.floor(num);
        const decimalPart = Math.round((num - integerPart) * 100);

        let str = "Rupees " + inWords(integerPart).trim();
        if (decimalPart > 0) {
            str += " and " + inWords(decimalPart).trim() + " Paise";
        }
        return str + " Only";
    }

    // 1. Resolve Company Master Details
    let masterCompany = companyInfo;
    if (!masterCompany || !masterCompany.companyName) {
        try {
            const storedCompany = localStorage.getItem("companyInfo");
            const storedUser = localStorage.getItem("userInfo");
            if (storedCompany) masterCompany = { ...JSON.parse(storedCompany), ...companyInfo };
            else if (storedUser) masterCompany = { ...JSON.parse(storedUser), ...companyInfo };
        } catch (e) {
            console.warn("Could not parse cached company info:", e);
        }
    }

    const compName = masterCompany?.companyName || masterCompany?.name || 'COMPANY MASTER';
    const compAddressRaw = masterCompany?.billingAddress || masterCompany?.address || masterCompany?.location || '';
    const compCityState = [masterCompany?.city, masterCompany?.state, masterCompany?.pincode ? `- ${masterCompany.pincode}` : ''].filter(Boolean).join(' ');
    const compAddress = [compAddressRaw, compCityState].filter(Boolean).join(', ');
    const compPhone = masterCompany?.contactNumber || masterCompany?.phone || masterCompany?.mobile || '';
    const compEmail = masterCompany?.email || '';
    const compGst = masterCompany?.gstin || masterCompany?.gstNumber || masterCompany?.gst || 'N/A';
    const compPan = masterCompany?.panNumber || masterCompany?.pan || 'N/A';

    const bankName = masterCompany?.bankDetails?.bankName || masterCompany?.bankName || '-';
    const accountNumber = masterCompany?.bankDetails?.accountNumber || masterCompany?.accountNumber || '-';
    const ifscCode = masterCompany?.bankDetails?.ifscCode || masterCompany?.ifscCode || '-';
    const branchName = masterCompany?.bankDetails?.branchName || masterCompany?.branchName || '';

    // 2. Resolve Customer Details
    const custObj = typeof doc.customer === 'object' ? doc.customer : {};
    const custName = doc.customerName || custObj?.name || custObj?.companyName || 'Internal Customer / Cash Sales';
    const custAddressRaw = doc.customerAddress || custObj?.address || custObj?.billingAddress || custObj?.shippingAddress || '';
    const custCityState = [custObj?.city, custObj?.state, custObj?.pincode].filter(Boolean).join(' ');
    const custAddress = custAddressRaw && custCityState ? `${custAddressRaw}, ${custCityState}` : (custAddressRaw || '-');
    const custGst = doc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || 'N/A';
    const custPhone = doc.customerPhone || custObj?.phone || custObj?.contactNumber || '';
    const custEmail = doc.customerEmail || custObj?.email || '';
    const custPoRef = doc.customerPoReference || doc.poNumber || '-';
    const custPoDate = doc.poDate ? new Date(doc.poDate).toLocaleDateString("en-IN") : '-';

    // 3. Document Logistics Metadata
    const docNum = doc.invoiceNumber || 'INV-001';
    const creationDateTimeStr = doc.createdAt || doc.date ? new Date(doc.createdAt || doc.date).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    }) : '-';
    const transportMode = doc.transportationType || doc.transportType || doc.transportMode || 'Road Transport';
    const vehicleNo = doc.vehicleNumber || doc.vehicleNo || '-';
    const packagingType = doc.packagingType || 'Standard Packaging';
    const eWayNo = doc.eWayBillNo || doc.eWayNo || '-';

    // 4. Resolve Copy Types
    let copyTypes = [
        'ORIGINAL FOR RECIPIENT',
        'DUPLICATE FOR TRANSPORTER',
        'TRIPLICATE FOR SUPPLIER'
    ];

    if (copyType === "original") copyTypes = ['ORIGINAL FOR RECIPIENT'];
    else if (copyType === "duplicate") copyTypes = ['DUPLICATE FOR TRANSPORTER'];
    else if (copyType === "triplicate") copyTypes = ['TRIPLICATE FOR SUPPLIER'];

    // 5. Line Items HTML
    const items = doc.items || [];
    let itemsTableRowsHtml = '';

    items.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity || item.qty || 0);
        const rate = Number(item.rate || item.unitPrice || item.price || 0);
        const amount = Number(item.amount || (qty * rate));
        const taxRate = Number(item.taxRate || 0);
        const totalAmt = amount + (amount * (taxRate / 100));
        const itemName = item.materialName || item.productName || item.itemName || item.name || 'Item';
        const hsn = item.hsnCode || item.hsn || '-';

        itemsTableRowsHtml += `
            <tr>
                <td style="text-align: center; padding: 6px;">${idx + 1}</td>
                <td style="text-align: left; font-weight: bold; padding: 6px; color: #0f172a;">${itemName}</td>
                <td style="text-align: center; padding: 6px; font-family: monospace;">${hsn}</td>
                <td style="text-align: center; font-weight: bold; padding: 6px; color: #3730a3;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                <td style="text-align: right; padding: 6px; font-family: monospace;">₹${rate ? rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                <td style="text-align: center; padding: 6px;">${taxRate > 0 ? taxRate + '%' : '-'}</td>
                <td style="text-align: right; padding: 6px; font-weight: 800; font-family: monospace; color: #0f172a;">₹${totalAmt ? totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
            </tr>
        `;
    });

    // Pad blank rows if items < 5
    for (let i = items.length; i < 5; i++) {
        itemsTableRowsHtml += `
            <tr>
                <td style="height: 24px; padding: 6px;"></td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
        `;
    }

    const subtotal = doc.subtotal || items.reduce((acc: number, i: any) => acc + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
    const transportCharges = Number(doc.transportationCharges || doc.freightCharges || 0);
    const packagingCharges = Number(doc.packagingCharges || 0);
    const discount = Number(doc.discount || 0);
    const taxAmount = doc.taxAmount || items.reduce((acc: number, i: any) => acc + ((Number(i.quantity || 0) * Number(i.rate || 0)) * (Number(i.taxRate || 0) / 100)), 0);
    const grandTotal = doc.totalAmount || (subtotal + taxAmount + transportCharges + packagingCharges - discount);

    const pagesHtml = copyTypes.map((copyBadge) => `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; font-family: Arial, sans-serif; font-size: 11px; color: #111; margin-bottom: 20px; page-break-after: always; position: relative; box-sizing: border-box;">
            
            <!-- Company Header & Copy Badge -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #3730a3; text-transform: uppercase; letter-spacing: -0.5px;">${compName}</h1>
                    <div style="font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.4;">
                        ${compAddress}<br>
                        ${compPhone ? `Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}
                    </div>
                    <div style="font-size: 9.5px; color: #1e293b; font-weight: bold; margin-top: 4px;">
                        GSTIN: <b>${compGst}</b> | PAN: <b>${compPan}</b>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #3730a3; color: #ffffff; font-size: 9px; font-weight: 900; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${copyBadge}
                    </span>
                </div>
            </div>

            <!-- Title Bar -->
            <div style="text-align: center; background: #eef2ff; border: 1px solid #c7d2fe; font-weight: bold; font-size: 14px; padding: 7px; text-transform: uppercase; letter-spacing: 1px; color: #3730a3; margin-bottom: 12px;">
                TAX INVOICE
            </div>

            <!-- Buyer & Logistics Details Grid -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px;">
                <tr>
                    <td style="width: 52%; vertical-align: top; border: 1px solid #94a3b8; padding: 10px; background: #f8fafc;">
                        <div style="font-weight: bold; color: #4f46e5; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">BUYER / CONSIGNEE DETAILS</div>
                        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${custName}</div>
                        <div style="line-height: 1.4; color: #334155;">
                            ${custAddress ? '<b>Address:</b> ' + custAddress + '<br>' : ''}
                            ${custPhone ? '<b>Contact:</b> ' + custPhone + '<br>' : ''}
                            ${custEmail ? '<b>Email:</b> ' + custEmail + '<br>' : ''}
                        </div>
                        ${custGst && custGst !== 'N/A' ? `<div style="margin-top: 6px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 4px;"><b>GSTIN:</b> ${custGst}</div>` : ''}
                        ${custPoRef && custPoRef !== '-' ? `<div style="margin-top: 4px; font-size: 10px; color: #3730a3;"><b>PO Ref:</b> ${custPoRef} ${custPoDate !== '-' ? `(Date: ${custPoDate})` : ''}</div>` : ''}
                    </td>

                    <td style="width: 48%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Invoice Number:</b></td>
                                <td style="padding: 2.5px 0; font-weight: 900; font-size: 12.5px; color: #3730a3; font-family: monospace;">${docNum}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Creation Date & Time:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold;">${creationDateTimeStr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Transport Mode:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold;">${transportMode}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Vehicle Number:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold; font-family: monospace;">${vehicleNo}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Packaging Type:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold;">${packagingType}</td>
                            </tr>
                            ${eWayNo && eWayNo !== '-' ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #64748b;"><b>E-Way Bill No:</b></td>
                                <td style="padding: 2.5px 0; font-weight: bold; font-family: monospace; color: #3730a3;">${eWayNo}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Itemized Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #eef2ff; text-transform: uppercase; font-weight: bold; color: #3730a3;">
                    <tr>
                        <th style="width: 5%; padding: 6px 4px; text-align: center;">S.No</th>
                        <th style="width: 36%; padding: 6px 8px; text-align: left;">Product / Item Description</th>
                        <th style="width: 12%; padding: 6px 4px; text-align: center;">HSN</th>
                        <th style="width: 10%; padding: 6px 4px; text-align: center;">Qty</th>
                        <th style="width: 14%; padding: 6px 8px; text-align: right;">Unit Rate</th>
                        <th style="width: 9%; padding: 6px 4px; text-align: center;">GST %</th>
                        <th style="width: 14%; padding: 6px 8px; text-align: right;">Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
            </table>

            <!-- Bottom Docked Summary & Financial Calculations -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 10px; background: #fafafa;">
                        <div style="font-weight: bold; color: #3730a3; font-size: 9.5px; text-transform: uppercase; margin-bottom: 4px;">BANK DETAILS & REMARKS</div>
                        <div style="font-size: 9.5px; color: #334155; line-height: 1.4;">
                            Bank: <b>${bankName}</b> | A/c: <b>${accountNumber}</b> | IFSC: <b>${ifscCode}</b> ${branchName ? `| Branch: ${branchName}` : ''}<br>
                            ${doc.remarks || doc.otherDetails ? `Remarks: ${doc.remarks || doc.otherDetails}<br>` : ''}
                            Terms: Subject to local jurisdiction. Payment due as per agreed billing terms.
                        </div>
                        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; font-size: 10px; font-style: italic;">
                            Amount in Words: ${numberToWords(grandTotal)}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Subtotal:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ${transportCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Freight / Transport:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ₹${transportCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${packagingCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Packaging Charges:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ₹${packagingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${discount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Discount:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">- ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${taxAmount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Tax Amount (GST):</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: #eef2ff; color: #3730a3; font-weight: 900; font-size: 11.5px;">
                                <td style="padding: 6px 6px; border: 1px solid #c7d2fe;">GRAND TOTAL:</td>
                                <td style="padding: 6px 6px; text-align: right; border: 1px solid #c7d2fe; font-family: monospace;">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Signatures Pinned at Bottom -->
            <table style="width: 100%; border: none; font-size: 10px; margin-top: 20px;">
                <tr>
                    <td style="width: 50%; vertical-align: bottom;">
                        <div style="font-size: 9px; color: #64748b;">
                            Receiver's Signature / Seal
                        </div>
                    </td>
                    <td style="width: 50%; text-align: right; vertical-align: bottom;">
                        <div style="font-weight: bold; margin-bottom: 25px;">For ${compName}</div>
                        <div style="border-top: 1px solid #333; width: 180px; display: inline-block; padding-top: 4px; text-align: center; font-size: 9.5px;">
                            Authorized Signatory
                        </div>
                    </td>
                </tr>
            </table>

        </div>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Tax_Invoice_${docNum}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; margin-bottom: 0 !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
                th, td { border-color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>Tax Invoice PDF: ${custName}</span>
                <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${pagesHtml}
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

export interface PrintGrnData {
    grn: any;
    companyInfo?: any;
    vendors?: any[];
}

export const generateFrontendGrnPDF = (data: PrintGrnData) => {
    const { grn, companyInfo, vendors = [] } = data;
    if (!grn) {
        alert("No GRN data provided for PDF generation");
        return;
    }

    let vendorObj: any = grn.supplier || grn.vendor;
    if (typeof vendorObj === 'string') {
        vendorObj = vendors.find((v: any) => v._id === vendorObj) || { name: vendorObj };
    }
    const partyName = grn.supplierName || grn.customerName || vendorObj?.name || (typeof grn.supplier === 'object' ? grn.supplier?.name : '') || "In-House / Direct";
    const partyAddress = vendorObj?.address || vendorObj?.billingAddress || '';
    const partyGst = vendorObj?.gst || vendorObj?.gstNumber || 'N/A';
    const partyPhone = vendorObj?.phone || vendorObj?.contactNumber || '';

    const compName = companyInfo?.companyName || 'COMPANY NAME';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';
    const compPan = companyInfo?.panNumber || companyInfo?.pan || 'N/A';

    const grnNo = grn.grnNumber || 'GRN-0001';
    const grnDate = grn.date ? new Date(grn.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

    const copyTypes = [
        'ORIGINAL FOR STORE COPY',
        'DUPLICATE FOR ACCOUNTS COPY'
    ];

    let totalRcvQty = 0;
    let totalAccQty = 0;
    let totalRejQty = 0;
    let totalVal = 0;

    let itemsTableRowsHtml = '';
    const items = grn.items || [];

    items.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity || item.receivedQuantity || 0);
        const accQty = Number(item.acceptedQuantity !== undefined ? item.acceptedQuantity : qty);
        const rejQty = Number(item.rejectedQuantity || 0);
        const rate = Number(item.rate || item.unitPrice || 0);
        const lineTotal = rate > 0 ? (qty * rate) : 0;

        totalRcvQty += qty;
        totalAccQty += accQty;
        totalRejQty += rejQty;
        totalVal += lineTotal;

        const name = item.materialName || item.itemName || (typeof item.fgItem === 'object' ? item.fgItem?.name : item.fgItem) || 'Item';
        const desc = item.description || item.descriptions || item.material?.description || item.material?.descriptions || '';

        itemsTableRowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                <td style="padding: 6px 8px;">
                    <div style="font-weight: bold; color: #0f172a;">${name}</div>
                    ${desc ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">📝 ${desc}</div>` : ''}
                </td>
                <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${qty}</td>
                <td style="padding: 6px 8px; text-align: center; color: #16a34a; font-weight: bold;">${accQty}</td>
                <td style="padding: 6px 8px; text-align: center; color: ${rejQty > 0 ? '#dc2626' : '#94a3b8'}; font-weight: bold;">${rejQty}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: 600;">${item.unit || 'PCS'}</td>
                <td style="padding: 6px 8px; text-align: right;">₹${rate.toFixed(2)}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #0f172a;">₹${lineTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    const pagesHtml = copyTypes.map((copyTitle) => `
        <div class="page" style="page-break-after: always; width: 100%; max-width: 800px; margin: 0 auto 30px auto; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <!-- Top Copy Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 15px;">
                <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e1b4b; letter-spacing: -0.5px;">${compName}</h2>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${compAddress}</div>
                    <div style="font-size: 10px; color: #64748b;">GSTIN: <strong style="color: #0f172a;">${compGst}</strong> | PAN: <strong>${compPan}</strong> ${compPhone ? `| Ph: ${compPhone}` : ''}</div>
                </div>
                <div style="text-align: right;">
                    <div style="display: inline-block; background: #4f46e5; color: #fff; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                        GOODS RECEIPT NOTE (GRN)
                    </div>
                    <div style="font-size: 10px; font-weight: bold; color: #6366f1; margin-top: 4px;">${copyTitle}</div>
                </div>
            </div>

            <!-- Details Box -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 15px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px; font-size: 11px;">
                <div>
                    <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Received From (Party / Supplier)</div>
                    <div style="font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 2px;">${partyName}</div>
                    ${partyAddress ? `<div style="color: #475569; font-size: 10px; margin-top: 2px;">${partyAddress}</div>` : ''}
                    ${partyGst !== 'N/A' ? `<div style="color: #475569; font-size: 10px;">GSTIN: <strong>${partyGst}</strong></div>` : ''}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">GRN Number</div>
                        <div style="font-size: 12px; font-weight: 900; color: #4f46e5;">${grnNo}</div>
                    </div>
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Date</div>
                        <div style="font-size: 11px; font-weight: bold; color: #0f172a;">${grnDate}</div>
                    </div>
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">${grn.mrpNumber ? 'MRP Plan' : 'PO Reference'}</div>
                        <div style="font-size: 11px; font-weight: bold; color: #0f172a;">${grn.mrpNumber ? `MRP #${grn.mrpNumber}` : (grn.poReference || grn.purchaseOrder?.poNumber || 'Direct / Offline')}</div>
                    </div>
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">QC Status</div>
                        <div style="font-size: 11px; font-weight: bold; color: ${grn.qcStatus === 'Passed' ? '#16a34a' : '#4f46e5'};">${grn.qcStatus || (grn.qcRequired ? 'Pending QC' : 'Direct Accepted')}</div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background: #1e1b4b; color: #fff; font-size: 10px; text-transform: uppercase; font-weight: 800;">
                        <th style="padding: 7px 8px; width: 30px; text-align: center;">#</th>
                        <th style="padding: 7px 8px; text-align: left;">Item Description</th>
                        <th style="padding: 7px 8px; width: 60px; text-align: center;">Rcv Qty</th>
                        <th style="padding: 7px 8px; width: 60px; text-align: center;">Acc Qty</th>
                        <th style="padding: 7px 8px; width: 60px; text-align: center;">Rej Qty</th>
                        <th style="padding: 7px 8px; width: 50px; text-align: center;">Unit</th>
                        <th style="padding: 7px 8px; width: 70px; text-align: right;">Rate (₹)</th>
                        <th style="padding: 7px 8px; width: 85px; text-align: right;">Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: bold; font-size: 11px; border-top: 2px solid #cbd5e1;">
                        <td colspan="2" style="padding: 8px; text-align: right; text-transform: uppercase;">Total:</td>
                        <td style="padding: 8px; text-align: center;">${totalRcvQty}</td>
                        <td style="padding: 8px; text-align: center; color: #16a34a;">${totalAccQty}</td>
                        <td style="padding: 8px; text-align: center; color: ${totalRejQty > 0 ? '#dc2626' : '#64748b'};">${totalRejQty}</td>
                        <td></td>
                        <td></td>
                        <td style="padding: 8px; text-align: right; font-size: 12px; color: #4f46e5; font-weight: 900;">₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Signatures Section -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 35px; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 11px; text-align: center;">
                <div>
                    <div style="height: 35px;"></div>
                    <div style="border-top: 1px solid #64748b; padding-top: 4px; font-weight: bold; color: #334155;">Received By (Store)</div>
                </div>
                <div>
                    <div style="height: 35px;"></div>
                    <div style="border-top: 1px solid #64748b; padding-top: 4px; font-weight: bold; color: #334155;">QC Inspector</div>
                </div>
                <div>
                    <div style="height: 35px;"></div>
                    <div style="border-top: 1px solid #64748b; padding-top: 4px; font-weight: bold; color: #334155;">Authorized Signatory</div>
                </div>
            </div>
        </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked! Please allow pop-ups to print/download the GRN PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GRN_${grnNo}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, sans-serif; }
                @media print {
                    body { background: #fff; }
                    .page { border: none !important; margin: 0 !important; box-shadow: none !important; margin-bottom: 0 !important; }
                    .no-print { display: none !important; }
                }
                table { border-collapse: collapse; }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
                <span>GRN: ${grnNo}</span>
                <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            <div style="padding-top: 45px;">
                ${pagesHtml}
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                }, 400);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

