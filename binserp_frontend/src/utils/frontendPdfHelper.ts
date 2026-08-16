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
    let itemsTableRowsHtml = '';

    const items = doc.items || [];
    let rowIdx = 0;

    if (items.length > 0) {
        items.forEach((item: any, idx: number) => {
            totalSentQty += Number(item.quantitySent || 0);

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
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: center;">${idx + 1}</td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: left; font-weight: bold;">${item.itemName || ''}</td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: center;">${item.quantitySent || ''} ${item.unit || 'PCS'}</td>` : ''}
                        <td style="text-align: left; font-weight: bold; color: #1e3a8a;">${ret.receivedItemName || ''}</td>
                        <td style="text-align: center;">${expQty} ${ret.receivingUnit || 'PCS'}</td>
                        ${rIdx === 0 ? `<td style="text-align: center;">${item.unitPrice ? '₹' + item.unitPrice : '-'}</td>` : ''}
                        ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: left;">${item.processType || ''} ${item.description ? '(' + item.description + ')' : ''}</td>` : ''}
                    </tr>
                `;
            });
        });

        // Fill blank rows for full page rendering
        for (let i = rowIdx; i < 5; i++) {
            itemsTableRowsHtml += `
                <tr>
                    <td style="height: 26px;"></td>
                    <td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
            `;
        }
    } else {
        itemsTableRowsHtml = `<tr><td colspan="7" style="text-align: center; padding: 40px;">No items listed</td></tr>`;
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
                                <td style="padding: 3px 0; text-align: right; font-weight: bold;">${doc.estimatedPrice ? '₹' + Number(doc.estimatedPrice).toLocaleString() : '-'}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #f1f5f9; text-transform: uppercase; font-weight: bold;">
                    <tr>
                        <th style="width: 5%; padding: 6px 4px; text-align: center;">Sl</th>
                        <th style="width: 25%; padding: 6px 8px; text-align: left;">Items Sent</th>
                        <th style="width: 10%; padding: 6px 4px; text-align: center;">Sent Qty</th>
                        <th style="width: 25%; padding: 6px 8px; text-align: left;">Material to be Received</th>
                        <th style="width: 10%; padding: 6px 4px; text-align: center;">Expected Qty</th>
                        <th style="width: 10%; padding: 6px 4px; text-align: center;">Rate</th>
                        <th style="width: 15%; padding: 6px 8px; text-align: left;">Process / Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #64748b;">
                    <tr>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Sent Qty =</td>
                        <td style="padding: 6px; text-align: center;">${totalSentQty}</td>
                        <td style="padding: 6px 8px; text-align: right;">Total Expected Qty =</td>
                        <td style="padding: 6px; text-align: center;">${totalExpectedQty}</td>
                        <td colspan="2"></td>
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
