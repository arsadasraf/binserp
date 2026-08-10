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
