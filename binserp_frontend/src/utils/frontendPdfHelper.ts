/**
 * Client-Side Frontend PDF & Document Generator
 * Renders Returnable Delivery Challan in 3 Copies (Consignee, Transporter, Consignor)
 * Fully populating Vendor address, GST, PAN, and Company details directly in the browser.
 */

import { getCurrencySymbol, convertAmountToWords, formatCurrencyAmount } from "./currencyHelper";
import { API_BASE_URL } from "./config";

let _memoryCompanyInfo: any = null;

export const resolveCompanyInfo = (companyInfo?: any): any => {
    let resolved = companyInfo && (companyInfo.companyName || companyInfo.name || companyInfo.legalName) ? { ...companyInfo } : null;

    if (!resolved && _memoryCompanyInfo) {
        resolved = { ..._memoryCompanyInfo };
    }

    if (!resolved && typeof window !== 'undefined') {
        try {
            const storeCached = localStorage.getItem("storeCompanyInfo");
            const storedCompany = localStorage.getItem("companyInfo");
            const storedUser = localStorage.getItem("userInfo");

            if (storeCached) {
                resolved = JSON.parse(storeCached);
            } else if (storedCompany) {
                resolved = JSON.parse(storedCompany);
            } else if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                resolved = parsedUser.company || parsedUser;
            }
        } catch (e) {
            console.warn("Could not parse company info from localStorage:", e);
        }
    }

    if (companyInfo && typeof companyInfo === 'object') {
        resolved = { ...(resolved || {}), ...companyInfo };
    }

    if (resolved && (resolved.companyName || resolved.name || resolved.legalName)) {
        _memoryCompanyInfo = resolved;
    }

    return resolved || {};
};

export const fetchCompanyInfoFromApi = async (): Promise<any> => {
    try {
        if (typeof window === 'undefined') return null;
        const token = localStorage.getItem('token');
        if (!token) return null;
        const res = await fetch(`${API_BASE_URL}/api/store/company-info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && (data.companyName || data.name || data.legalName)) {
                _memoryCompanyInfo = data;
                try {
                    localStorage.setItem('storeCompanyInfo', JSON.stringify(data));
                } catch (e) {}
                return data;
            }
        }
    } catch (e) {
        console.error("Failed to fetch company info from API:", e);
    }
    return null;
};

export interface PrintDocumentData {
    doc: any;
    companyInfo?: any;
    vendors?: any[];
}

export const generateFrontendReturnableDCPDF = (data: PrintDocumentData) => {
    const { doc, vendors = [] } = data;

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
    const comp = resolveCompanyInfo(data.companyInfo);
    const compName = comp?.companyName || comp?.name || comp?.legalName || comp?.tradeName || 'COMPANY NAME';
    const compAddress = comp?.billingAddress || comp?.address || [comp?.city, comp?.state, comp?.pincode].filter(Boolean).join(', ') || '';
    const compPhone = comp?.contactNumber || comp?.phone || '';
    const compEmail = comp?.email || '';
    const compGst = comp?.gstNumber || comp?.gstin || comp?.gst || 'N/A';
    const compPan = comp?.panNumber || comp?.pan || 'N/A';

    const copyTypes = [
        'ORIGINAL FOR CONSIGNEE',
        'DUPLICATE FOR TRANSPORTER',
        'TRIPLICATE FOR CONSIGNOR / FILE COPY'
    ];

    const isAssemblyMode = doc.operationMode === 'assembly';
    const assemblyOutput = doc.assemblyOutputItem;

    // Build Items Section HTML
    let totalSentQty = 0;
    let totalExpectedQty = 0;
    let totalProcessValue = 0;
    let itemsSectionHtml = '';

    const items = doc.items || [];

    if (isAssemblyMode) {
        let compRows = '';
        if (items.length > 0) {
            items.forEach((item: any, idx: number) => {
                const sentQty = Number(item.quantitySent || 0);
                totalSentQty += sentQty;
                const rate = Number(item.processRate != null ? item.processRate : item.unitPrice) || 0;
                const lineVal = sentQty * rate;
                totalProcessValue += lineVal;

                compRows += `
                    <tr>
                        <td style="text-align: center; padding: 5px 3px;">${idx + 1}</td>
                        <td style="text-align: left; font-weight: bold; padding: 5px 6px;">
                            ${item.itemName || ''}
                            ${item.description ? `<div style="font-size: 8px; color: #475569; font-weight: normal; font-style: italic;">${item.description}</div>` : ''}
                        </td>
                        <td style="text-align: center; font-weight: bold; padding: 5px 4px;">${sentQty} ${item.unit || 'PCS'}</td>
                        <td style="text-align: left; padding: 5px 6px;"><b>${item.processType || (doc.purpose === 'Others' && doc.otherPurpose ? doc.otherPurpose : doc.purpose) || 'Job Work'}</b></td>
                        <td style="text-align: center; font-family: monospace; font-weight: bold; padding: 5px 4px;">${rate > 0 ? '₹' + rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                        <td style="text-align: right; font-family: monospace; font-weight: bold; padding: 5px 6px;">${lineVal > 0 ? '₹' + lineVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                    </tr>
                `;
            });

            for (let i = items.length; i < 4; i++) {
                compRows += `<tr><td style="height: 22px;"></td><td></td><td></td><td></td><td></td><td></td></tr>`;
            }
        } else {
            compRows = `<tr><td colspan="6" style="text-align: center; padding: 30px;">No components listed</td></tr>`;
        }

        totalExpectedQty = Number(assemblyOutput?.quantityToBeReceived || 0);

        itemsSectionHtml = `
            <!-- Components Sent Table -->
            <div style="font-weight: bold; font-size: 10px; color: #334155; margin-bottom: 4px; text-transform: uppercase;">
                1. Dispatched Components / Kit Bill of Materials:
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #f1f5f9; text-transform: uppercase; font-weight: bold;">
                    <tr>
                        <th style="width: 5%; padding: 6px 3px; text-align: center;">Sl</th>
                        <th style="width: 45%; padding: 6px 6px; text-align: left;">Component / Material Dispatched</th>
                        <th style="width: 15%; padding: 6px 4px; text-align: center;">Dispatched Qty</th>
                        <th style="width: 15%; padding: 6px 6px; text-align: left;">Process</th>
                        <th style="width: 10%; padding: 6px 4px; text-align: center;">Rate (₹)</th>
                        <th style="width: 10%; padding: 6px 6px; text-align: right;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${compRows}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #64748b;">
                    <tr>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Components Sent Qty =</td>
                        <td style="padding: 6px 4px; text-align: center;">${totalSentQty}</td>
                        <td colspan="2" style="padding: 6px 8px; text-align: right;">Total Job Value =</td>
                        <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-size: 11px;">₹${totalProcessValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Target Consolidated Return Box -->
            <div style="border: 2px solid #1e3a8a; background: #f8fafc; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px;">
                <div style="font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 5px;">
                    2. Inward Material (Consolidated 1 Item Deliverable - Many ➔ 1)
                </div>
                <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 60%; vertical-align: top;">
                            <div style="font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase;">Finished Product / Sub-Assembly:</div>
                            <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-top: 2px;">${assemblyOutput?.itemName || 'Consolidated Assembly Product'}</div>
                            ${assemblyOutput?.description ? `<div style="font-size: 9px; color: #475569; font-style: italic; margin-top: 2px;">${assemblyOutput.description}</div>` : ''}
                            ${assemblyOutput?.processType ? `<div style="font-size: 9px; color: #1e3a8a; font-weight: bold; margin-top: 3px;">Process: ${assemblyOutput.processType}</div>` : ''}
                        </td>
                        <td style="width: 40%; vertical-align: top; text-align: right;">
                            <div style="font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase;">Expected Return Qty:</div>
                            <div style="font-weight: 900; font-size: 15px; color: #1e3a8a; margin-top: 2px;">
                                ${assemblyOutput?.quantityToBeReceived || 0} ${assemblyOutput?.receivingUnit || 'PCS'}
                            </div>
                            <div style="font-size: 9px; color: #475569; margin-top: 3px;">
                                Stock Receipt: <b style="color: #0f172a;">Shopfloor WIP FG</b>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        `;
    } else {
        let rowIdx = 0;
        let itemsTableRowsHtml = '';

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
                            ${rIdx === 0 ? `<td rowspan="${retList.length}" style="text-align: left; padding: 5px 6px;"><b>${item.processType || (doc.purpose === 'Others' && doc.otherPurpose ? doc.otherPurpose : doc.purpose) || 'Job Work'}</b></td>` : ''}
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

        itemsSectionHtml = `
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
        `;
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
                ${isAssemblyMode ? 'RETURNABLE - DELIVERY CHALLAN [MANY TO ONE CONSOLIDATION]' : 'RETURNABLE - DELIVERY CHALLAN [ONE TO MANY]'}
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
                                <td style="padding: 3px 0; color: #1e3a8a;"><b>Purpose:</b></td>
                                <td colspan="3" style="padding: 3px 0; font-weight: bold; font-size: 11px; color: #1e3a8a;">${doc.purpose === 'Others' && doc.otherPurpose ? doc.otherPurpose : (doc.purpose || doc.items?.[0]?.processType || 'Job Work')}</td>
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

            ${itemsSectionHtml}

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
    const comp = resolveCompanyInfo(companyInfo);
    const compName = comp?.companyName || comp?.name || comp?.legalName || comp?.tradeName || 'COMPANY NAME';
    const compAddress = comp?.billingAddress || comp?.address || [comp?.city, comp?.state, comp?.pincode].filter(Boolean).join(', ') || '';
    const compPhone = comp?.contactNumber || comp?.phone || '';
    const compEmail = comp?.email || '';
    const compGst = comp?.gstNumber || comp?.gstin || comp?.gst || 'N/A';
    const compPan = comp?.panNumber || comp?.pan || 'N/A';

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
                    <td></td><td></td><td></td>
                    <td style="border-left: 2px solid #0284c7; background: #fafafa;"></td>
                </tr>
            `;
        }
    } else {
        itemsTableRowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 30px;">No materials specified</td></tr>`;
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
                        <th style="width: 40%; padding: 7px 8px; text-align: left;">Item Description & Specifications</th>
                        <th style="width: 15%; padding: 7px 4px; text-align: center;">Req. Qty</th>
                        <th style="width: 20%; padding: 7px 8px; text-align: left;">Remarks / Specs</th>
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
                        <td colspan="2"></td>
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
    const comp = resolveCompanyInfo(companyInfo);
    const compName = comp?.companyName || comp?.name || comp?.legalName || comp?.tradeName || 'COMPANY NAME';
    const compAddress = comp?.billingAddress || comp?.address || [comp?.city, comp?.state, comp?.pincode].filter(Boolean).join(', ') || '';
    const compPhone = comp?.contactNumber || comp?.phone || '';
    const compEmail = comp?.email || '';
    const compGst = comp?.gstNumber || comp?.gstin || comp?.gst || 'N/A';

    const rfqCurrSym = getCurrencySymbol(rfq.currency);
    const rfqCurrCode = rfq.currency || 'INR';

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
                    <td style="text-align: center; padding: 6px; color: #0f172a; font-weight: 600;">${item.targetPrice ? `${rfqCurrSym}${Number(item.targetPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
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
                                <td style="padding: 4px 0; color: #64748b;"><b>Currency:</b></td>
                                <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">${rfqCurrCode} (${rfqCurrSym})</td>
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
                        <th style="width: 15%; padding: 7px 4px; text-align: center;">Target Rate (${rfqCurrCode})</th>
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
    const comp = resolveCompanyInfo(companyInfo);
    const compName = comp?.companyName || comp?.name || comp?.legalName || comp?.tradeName || 'COMPANY NAME';
    const compAddress = comp?.billingAddress || comp?.address || [comp?.city, comp?.state, comp?.pincode].filter(Boolean).join(', ') || '';
    const compPhone = comp?.contactNumber || comp?.phone || '';
    const compEmail = comp?.email || '';
    const compGst = comp?.gstNumber || comp?.gstin || comp?.gst || 'N/A';

    const quotCurrSym = getCurrencySymbol(quotation.currency);
    const quotCurrCode = quotation.currency || 'INR';

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
                    <td style="text-align: right; padding: 6px; font-weight: bold; font-family: monospace;">${quotCurrSym}${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align: center; padding: 6px;">${tax > 0 ? tax + '%' : '-'}</td>
                    <td style="text-align: right; padding: 6px; font-weight: 800; font-family: monospace; color: #0f172a;">${quotCurrSym}${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                                <td style="padding: 3px 0; color: #64748b;"><b>Currency:</b></td>
                                <td style="padding: 3px 0; font-weight: bold; color: #0284c7;">${quotCurrCode} (${quotCurrSym})</td>
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
                        <th style="width: 15%; padding: 7px 8px; text-align: right;">Unit Rate (${quotCurrCode})</th>
                        <th style="width: 11%; padding: 7px 4px; text-align: center;">GST %</th>
                        <th style="width: 22%; padding: 7px 8px; text-align: right;">Total Amount (${quotCurrCode})</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #4f46e5;">
                    ${subtotal ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Subtotal =</td>
                            <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${quotCurrSym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ` : ''}
                    ${taxAmount ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">GST Tax =</td>
                            <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${quotCurrSym}${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ` : ''}
                    ${transCharges > 0 ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Freight / Transport Charges (${transMode}) =</td>
                            <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${quotCurrSym}${transCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ` : ''}
                    ${packCharges > 0 ? `
                        <tr>
                            <td colspan="5" style="padding: 5px 8px; text-align: right;">Packaging Charges (${packType}) =</td>
                            <td style="padding: 5px 8px; text-align: right; font-family: monospace;">${quotCurrSym}${packCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ` : ''}
                    <tr style="font-size: 11px; background: #eef2ff; color: #3730a3;">
                        <td colspan="5" style="padding: 7px 8px; text-align: right; font-weight: bold;">Grand Total (${quotCurrCode}) =</td>
                        <td style="padding: 7px 8px; text-align: right; font-weight: 900; font-family: monospace;">${quotCurrSym}${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
    const comp = resolveCompanyInfo(companyInfo);
    const compName = comp?.companyName || comp?.name || comp?.legalName || comp?.tradeName || 'COMPANY NAME';
    const compAddress = comp?.billingAddress || comp?.address || [comp?.city, comp?.state, comp?.pincode].filter(Boolean).join(', ') || '';
    const compPhone = comp?.contactNumber || comp?.phone || '';
    const compEmail = comp?.email || '';
    const compGst = comp?.gstNumber || comp?.gstin || comp?.gst || 'N/A';

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
    let { po, vendor, companyInfo } = data;

    if (!po) {
        alert("No Purchase Order data provided for PDF generation");
        return;
    }

    // Fallback company info from localStorage if missing or incomplete
    if (!companyInfo || !companyInfo.companyName || !companyInfo.gstNumber || !companyInfo.logo) {
        try {
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem("storeCompanyInfo") || localStorage.getItem("companyInfo");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    companyInfo = { ...(parsed || {}), ...(companyInfo || {}) };
                }
                if (!companyInfo || !companyInfo.companyName) {
                    const userRaw = localStorage.getItem("userInfo");
                    if (userRaw) {
                        const parsedUser = JSON.parse(userRaw);
                        const userComp = parsedUser.company || parsedUser;
                        companyInfo = { ...(userComp || {}), ...(companyInfo || {}) };
                    }
                }
            }
        } catch (e) {
            console.error("Failed to parse cached company info for PDF:", e);
        }
    }

    // Resolve Vendor Details
    const vendorObj = vendor || (typeof po.vendor === 'object' ? po.vendor : null);
    const vendorName = vendorObj?.name || vendorObj?.companyName || po.vendorName || 'SUPPLIER / VENDOR';
    const vendorContactPerson = vendorObj?.contactPerson || vendorObj?.contactName || po.vendorContactPerson || po.contactPerson || '';
    const vendorAddress = vendorObj?.billingAddress || vendorObj?.address || po.vendorAddress || '';
    const vendorCityState = `${vendorObj?.city || vendorObj?.billingCity || ''} ${vendorObj?.state || vendorObj?.billingState || ''} ${vendorObj?.pincode || vendorObj?.billingPincode ? '-' + (vendorObj?.pincode || vendorObj?.billingPincode) : ''}`.trim();
    const vendorGst = vendorObj?.gst || vendorObj?.gstNumber || vendorObj?.gstin || po.vendorGst || 'N/A';
    const vendorPan = vendorObj?.pan || vendorObj?.panNumber || po.vendorPan || 'N/A';
    const vendorPhone = vendorObj?.phone || vendorObj?.contactNumber || vendorObj?.mobile || po.vendorPhone || '';
    const vendorEmail = vendorObj?.email || po.vendorEmail || '';

    // Resolve MRP Number (if generated for specific MRP)
    const rawMrpString = `${po.mrpNumber || ''} ${typeof po.mrpPlanId === 'object' ? po.mrpPlanId?.mrpNumber || po.mrpPlanId?.planNumber || '' : ''} ${typeof po.mrpPlan === 'object' ? po.mrpPlan?.mrpNumber || '' : ''} ${po.notes || ''} ${po.remarks || ''} ${po.description || ''} ${po.items?.[0]?.description || ''}`;
    const mrpMatch = rawMrpString.match(/\bMRP[-/A-Za-z0-9_]+\b/i);
    const resolvedMrp = po.mrpNumber || 
                        (typeof po.mrpPlanId === 'object' ? (po.mrpPlanId?.mrpNumber || po.mrpPlanId?.planNumber) : null) || 
                        (typeof po.mrpPlan === 'object' ? po.mrpPlan?.mrpNumber : null) || 
                        (mrpMatch ? mrpMatch[0] : null);

    // Resolve Company Details
    const compName = companyInfo?.companyName || companyInfo?.legalName || companyInfo?.tradeName || companyInfo?.name || 'COMPANY NAME';
    let compLogo = companyInfo?.logo || companyInfo?.logoUrl || companyInfo?.companyLogo || companyInfo?.image || '';
    if (compLogo && !compLogo.startsWith('http') && !compLogo.startsWith('data:')) {
        compLogo = `${API_BASE_URL}${compLogo.startsWith('/') ? '' : '/'}${compLogo}`;
    }
    const compContactPerson = companyInfo?.contactPerson || companyInfo?.authorizedPerson || companyInfo?.contactName || companyInfo?.fullName || '';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.companyAddress || companyInfo?.street || '';
    const compCityState = `${companyInfo?.city || ''} ${companyInfo?.state || ''} ${companyInfo?.pincode ? '-' + companyInfo?.pincode : ''}`.trim();
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || companyInfo?.mobile || companyInfo?.phoneNumber || '';
    const compEmail = companyInfo?.email || companyInfo?.companyEmail || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || companyInfo?.gst || companyInfo?.companyGst || companyInfo?.taxId || '';
    const compPan = companyInfo?.panNumber || companyInfo?.pan || companyInfo?.companyPan || '';
    const compCin = companyInfo?.cinNumber || companyInfo?.cin || '';

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
    let itemsTableRowsHtml = '';

    // PO overall tax rate (default 18%)
    const overallTaxRate = po.taxRate != null ? Number(po.taxRate) : 18;
    const isInterState = po.gstType === 'inter_state';
    const cgstRate = isInterState ? 0 : (po.cgstRate != null ? Number(po.cgstRate) : (overallTaxRate / 2));
    const sgstRate = isInterState ? 0 : (po.sgstRate != null ? Number(po.sgstRate) : (overallTaxRate / 2));
    const igstRate = isInterState ? (po.igstRate != null ? Number(po.igstRate) : overallTaxRate) : 0;

    items.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity || 1);
        const rate = Number(item.rate || item.unitPrice || 0);
        const lineNet = qty * rate; // Actual amount without tax
        const rawItemDesc = item.description || item.itemDescription || item.remarks || item.specifications || item.material?.description || (idx === 0 ? (po.description || po.remarks) : '') || '';
        let itemDesc = rawItemDesc;
        if (itemDesc && resolvedMrp) {
            itemDesc = itemDesc.replace(new RegExp(`(?:Generated from\\s+)?MRP\\s*(?:Requirement for|Consolidated:|Plan:?)?\\s*${resolvedMrp}`, 'gi'), '').trim();
            itemDesc = itemDesc.replace(/(?:Generated from\\s+)?MRP\s*(?:Requirement for|Consolidated:|Plan:?)\s*MRP[-A-Za-z0-9_/]*/gi, '').trim();
            itemDesc = itemDesc.replace(/^[|,\s-]+|[|,\s-]+$/g, '');
        }
        const itemHsn = item.hsnCode || item.hsn || '-';
        const pieceCount = Number(item.pieceCount || item.count || 0);

        itemsSubtotal += lineNet;

        itemsTableRowsHtml += `
            <tr>
                <td style="text-align: center; padding: 7px 4px; vertical-align: top;">${idx + 1}</td>
                <td style="text-align: left; padding: 7px 8px; vertical-align: top;">
                    <div style="font-weight: bold; color: #0f172a; font-size: 11px;">
                        ${item.materialName || item.material?.name || item.itemName || 'Material Item'}
                    </div>
                    ${itemDesc ? `<div style="font-size: 9.5px; color: #475569; margin-top: 3px; font-style: italic;">${itemDesc}</div>` : ''}
                </td>
                <td style="text-align: center; font-family: monospace; padding: 7px 4px; vertical-align: top; color: #475569;">${itemHsn}</td>
                <td style="text-align: center; font-weight: bold; color: #7c2d12; padding: 7px 4px; vertical-align: top;">${pieceCount > 0 ? `${pieceCount} Pcs` : '-'}</td>
                <td style="text-align: center; font-weight: bold; padding: 7px 4px; vertical-align: top;">${qty} ${item.unit || item.uom || 'PCS'}</td>
                <td style="text-align: right; padding: 7px 8px; font-weight: bold; vertical-align: top;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; padding: 7px 8px; font-weight: 800; color: #0f172a; vertical-align: top;">₹${lineNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    const transportCharge = Number(po.transportCharge || 0);
    const transportType = po.transportType || 'Road Freight';
    const packingCharge = Number(po.packingCharge || 0);
    const packingType = po.packingType || 'Standard Packaging';
    const logisticsCharges = transportCharge + packingCharge;
    
    // Taxable base amount (composite supply including logistics)
    const taxableAmount = itemsSubtotal + logisticsCharges;
    const totalTaxAmount = po.totalTax != null ? Number(po.totalTax) : (taxableAmount * (overallTaxRate / 100));
    
    const cgstVal = isInterState ? 0 : (po.cgstAmount != null ? Number(po.cgstAmount) : (totalTaxAmount / 2));
    const sgstVal = isInterState ? 0 : (po.sgstAmount != null ? Number(po.sgstAmount) : (totalTaxAmount / 2));
    const igstVal = isInterState ? (po.igstAmount != null ? Number(po.igstAmount) : totalTaxAmount) : 0;

    const grandTotal = taxableAmount + totalTaxAmount;

    let cleanedRemarks = po.remarks || '';
    if (cleanedRemarks && resolvedMrp) {
        cleanedRemarks = cleanedRemarks.replace(new RegExp(`(?:Generated from\\s+)?MRP\\s*(?:Requirement for|Consolidated:|Plan:?)?\\s*${resolvedMrp}`, 'gi'), '').trim();
        cleanedRemarks = cleanedRemarks.replace(/(?:Generated from\\s+)?MRP\s*(?:Requirement for|Consolidated:|Plan:?)\s*MRP[-A-Za-z0-9_/]*/gi, '').trim();
        cleanedRemarks = cleanedRemarks.replace(/^[|,\s-]+|[|,\s-]+$/g, '');
    }

    const htmlContent = `
        <div class="page" style="padding: 25px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 11px; color: #111;">
            
            <!-- Header (Company Details & Logo) -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #581c87; padding-bottom: 12px; margin-bottom: 14px;">
                <div style="flex: 1; max-width: ${compLogo ? '68%' : '100%'};">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #581c87; text-transform: uppercase; letter-spacing: 0.5px;">${compName}</h1>
                    ${compAddress ? `<div style="font-size: 10px; color: #334155; margin-top: 3px; line-height: 1.4;">${compAddress}${compCityState ? ', ' + compCityState : ''}</div>` : ''}
                    <div style="font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.4;">
                        ${compContactPerson ? `<b>Contact Person:</b> ${compContactPerson} &nbsp;|&nbsp; ` : ''}
                        ${compPhone ? `<b>Ph:</b> ${compPhone} &nbsp;|&nbsp; ` : ''}
                        ${compEmail ? `<b>Email:</b> ${compEmail}` : ''}
                    </div>
                    <div style="font-size: 10px; color: #1e293b; margin-top: 5px; font-weight: bold; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                        <span><b>GSTIN:</b> ${compGst || 'N/A'}</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span><b>PAN:</b> ${compPan || 'N/A'}</span>
                        ${compCin ? ` &nbsp;&nbsp;|&nbsp;&nbsp; <span><b>CIN:</b> ${compCin}</span>` : ''}
                    </div>
                </div>
                ${compLogo ? `
                    <div style="text-align: right; margin-left: 15px; flex-shrink: 0;">
                        <img src="${compLogo}" alt="${compName}" style="max-height: 65px; max-width: 190px; object-fit: contain;" />
                    </div>
                ` : ''}
            </div>

            <!-- Title -->
            <div style="text-align: center; margin-bottom: 14px;">
                <span style="font-size: 14px; font-weight: 900; color: #1e1b4b; letter-spacing: 1px; text-transform: uppercase; border-bottom: 2px solid #6b21a8; padding-bottom: 2px;">
                    PURCHASE ORDER
                </span>
            </div>

            <!-- Vendor and PO Meta Grid -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
                <tr>
                    <td style="width: 55%; vertical-align: top; border: 1px solid #94a3b8; padding: 12px; background: #fafafa;">
                        <div style="font-weight: 900; color: #6b21a8; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">
                            ${vendorName}
                        </div>
                        ${vendorContactPerson ? `<div style="color: #334155; font-size: 10px; margin-bottom: 4px;"><b>Attn:</b> ${vendorContactPerson}</div>` : ''}
                        ${vendorAddress ? `<div style="color: #475569; font-size: 10px; line-height: 1.4; margin-bottom: 4px;">${vendorAddress}</div>` : ''}
                        ${vendorCityState ? `<div style="color: #475569; font-size: 10px; margin-bottom: 6px;">${vendorCityState}</div>` : ''}
                        
                        <div style="font-size: 10px; color: #475569; line-height: 1.5;">
                            ${vendorPhone ? '<b>Ph:</b> ' + vendorPhone + '<br>' : ''}
                            ${vendorEmail ? '<b>Email:</b> ' + vendorEmail + '<br>' : ''}
                        </div>
                        <div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px; color: #475569;">
                            <b>Vendor GSTIN:</b> ${vendorGst} | <b>PAN:</b> ${vendorPan}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 12px; background: #ffffff;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 4px 0; color: #64748b; white-space: nowrap;"><b>PO Number:</b></td>
                                <td style="padding: 4px 0; font-weight: 900; font-size: 13px; color: #6b21a8;">${po.poNumber || '-'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #64748b; white-space: nowrap;"><b>PO Date:</b></td>
                                <td style="padding: 4px 0; font-weight: bold;">${new Date(po.date || po.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
                            </tr>
                            ${resolvedMrp ? `
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b; white-space: nowrap;"><b>MRP No:</b></td>
                                    <td style="padding: 4px 0; font-weight: 800; font-size: 12px; color: #6b21a8; font-family: monospace;">${resolvedMrp}</td>
                                </tr>
                            ` : ''}
                            ${po.quotationNumber ? `
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b; white-space: nowrap;"><b>Ref Quotation:</b></td>
                                    <td style="padding: 4px 0; font-weight: bold; color: #0e7490;">${po.quotationNumber}</td>
                                </tr>
                            ` : ''}
                            ${po.rfqNumber ? `
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b; white-space: nowrap;"><b>Ref RFQ:</b></td>
                                    <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">${po.rfqNumber}</td>
                                </tr>
                            ` : ''}
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Materials Table: Distinct HSN & Count Columns, Amount Excl. Tax -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;" border="1" bordercolor="#94a3b8">
                <thead style="background: #faf5ff; text-transform: uppercase; font-weight: bold; color: #6b21a8;">
                    <tr>
                        <th style="width: 5%; padding: 7px 4px; text-align: center;">S.No</th>
                        <th style="width: 40%; padding: 7px 8px; text-align: left;">Item Name & Specifications</th>
                        <th style="width: 10%; padding: 7px 4px; text-align: center;">HSN / SAC</th>
                        <th style="width: 10%; padding: 7px 4px; text-align: center;">Count</th>
                        <th style="width: 11%; padding: 7px 4px; text-align: center;">Quantity</th>
                        <th style="width: 12%; padding: 7px 8px; text-align: right;">Unit Rate</th>
                        <th style="width: 12%; padding: 7px 8px; text-align: right;">Amount (₹)</th>
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

                <div style="width: 330px; border: 1px solid #6b21a8; padding: 10px; background: #faf5ff; border-radius: 4px;">
                    <div style="font-weight: bold; color: #6b21a8; font-size: 10px; uppercase; margin-bottom: 6px; border-bottom: 1px border #e9d5ff; padding-bottom: 4px;">TAX & FINANCIAL BREAKDOWN</div>
                    <table style="width: 100%; font-size: 10px; line-height: 1.6;">
                        <tr>
                            <td style="color: #475569;">Items Subtotal:</td>
                            <td style="font-weight: bold; text-align: right;">₹${itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ${logisticsCharges > 0 ? `
                        <tr>
                            <td style="color: #475569;">Freight & Packaging:</td>
                            <td style="font-weight: bold; text-align: right;">+ ₹${logisticsCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="border-top: 1px dashed #cbd5e1;">
                            <td style="color: #581c87; font-weight: bold;">Taxable Base Amount:</td>
                            <td style="font-weight: bold; text-align: right; color: #581c87;">₹${taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ` : ''}
                        ${!isInterState ? `
                        <tr>
                            <td style="color: #0891b2;">Central GST (CGST @ ${cgstRate}%):</td>
                            <td style="font-weight: bold; text-align: right; color: #0891b2;">₹${cgstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td style="color: #0891b2;">State GST (SGST @ ${sgstRate}%):</td>
                            <td style="font-weight: bold; text-align: right; color: #0891b2;">₹${sgstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ` : `
                        <tr>
                            <td style="color: #0891b2;">Integrated GST (IGST @ ${igstRate}%):</td>
                            <td style="font-weight: bold; text-align: right; color: #0891b2;">₹${igstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        `}
                        <tr style="border-top: 1px solid #cbd5e1;">
                            <td style="color: #475569; font-weight: bold;">Total GST Tax (${overallTaxRate}%):</td>
                            <td style="font-weight: bold; text-align: right;">₹${totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="border-top: 2px solid #6b21a8; font-size: 12px;">
                            <td style="font-weight: 900; color: #581c87; padding-top: 6px;">Grand Total PO Value:</td>
                            <td style="font-weight: 900; text-align: right; color: #581c87; padding-top: 6px;">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Special Instructions & Terms -->
            ${cleanedRemarks ? `
                <div style="border: 1px solid #cbd5e1; padding: 10px; background: #fafafa; margin-bottom: 14px; font-size: 9.5px; line-height: 1.4; border-radius: 4px;">
                    <b style="color: #6b21a8;">Terms & Special Instructions:</b><br>
                    ${cleanedRemarks}
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

    const dcCurrSym = getCurrencySymbol(doc.currency);
    const dcCurrCode = doc.currency || 'INR';

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
                <td style="text-align: right; padding: 6px; font-family: monospace;">${rate ? `${dcCurrSym}${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                <td style="text-align: right; padding: 6px; font-weight: 800; font-family: monospace; color: #0f172a;">${amount ? `${dcCurrSym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
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
                        <div style="font-weight: bold; color: #4f46e5; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">CONSIGNEE / BUYER DETAILS</div>
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
                                <td style="padding: 2.5px 0; color: #64748b;"><b>Challan Number:</b></td>
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
                        <th style="width: 13%; padding: 6px 8px; text-align: right;">Unit Rate (${dcCurrCode})</th>
                        <th style="width: 14%; padding: 6px 8px; text-align: right;">Total Amount (${dcCurrCode})</th>
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
                            Amount in Words: ${convertAmountToWords(grandTotal, doc.currency)}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Subtotal:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">${dcCurrSym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ${transportCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Freight / Transport:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ${dcCurrSym}${transportCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${packagingCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Packaging Charges:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ${dcCurrSym}${packagingCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${discount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Discount:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">- ${dcCurrSym}${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${taxAmount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Tax Amount (GST):</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">${dcCurrSym}${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: #eef2ff; color: #3730a3; font-weight: 900; font-size: 11.5px;">
                                <td style="padding: 6px 6px; border: 1px solid #c7d2fe;">GRAND TOTAL (${dcCurrCode}):</td>
                                <td style="padding: 6px 6px; text-align: right; border: 1px solid #c7d2fe; font-family: monospace;">${dcCurrSym}${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

    const invCurrSym = getCurrencySymbol(doc.currency);
    const invCurrCode = doc.currency || 'INR';

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

    const docBank = doc.bankDetails || {};
    const bankName = docBank.bankName || masterCompany?.bankDetails?.bankName || masterCompany?.bankName || '-';
    const accountNumber = docBank.accountNumber || masterCompany?.bankDetails?.accountNumber || masterCompany?.accountNumber || '-';
    const ifscCode = docBank.ifscCode || masterCompany?.bankDetails?.ifscCode || masterCompany?.ifscCode || '-';
    const branchName = docBank.branch || docBank.branchName || masterCompany?.bankDetails?.branch || masterCompany?.bankDetails?.branchName || masterCompany?.branchName || '';

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
                <td style="text-align: right; padding: 6px; font-family: monospace;">${rate ? `${invCurrSym}${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00'}</td>
                <td style="text-align: center; padding: 6px;">${taxRate > 0 ? taxRate + '%' : '-'}</td>
                <td style="text-align: right; padding: 6px; font-weight: 800; font-family: monospace; color: #0f172a;">${totalAmt ? `${invCurrSym}${totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00'}</td>
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
                        <th style="width: 14%; padding: 6px 8px; text-align: right;">Unit Rate (${invCurrCode})</th>
                        <th style="width: 9%; padding: 6px 4px; text-align: center;">GST %</th>
                        <th style="width: 14%; padding: 6px 8px; text-align: right;">Total Amount (${invCurrCode})</th>
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
                            <div style="margin-top: 5px; font-size: 9px; color: #475569; white-space: pre-line;"><b>Terms & Conditions:</b><br>${doc.termsAndConditions || doc.terms || masterCompany?.printSettings?.invoice?.termsAndConditions || masterCompany?.commercialTerms || '1. Goods once sold will not be accepted back or exchanged.\n2. Payment due as per agreed billing terms.\n3. Subject to local jurisdiction only.'}</div>
                        </div>
                        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; font-size: 10px; font-style: italic;">
                            Amount in Words: ${convertAmountToWords(grandTotal, doc.currency)}
                        </div>
                    </td>

                    <td style="width: 45%; vertical-align: top; border: 1px solid #94a3b8; border-left: none; padding: 10px; background: #ffffff;">
                        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Subtotal:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">${invCurrSym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ${transportCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Freight / Transport:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ${invCurrSym}${transportCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${packagingCharges > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Packaging Charges:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">+ ${invCurrSym}${packagingCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${discount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Discount:</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">- ${invCurrSym}${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${taxAmount > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 0; color: #475569;">Tax Amount (GST):</td>
                                <td style="padding: 2.5px 0; text-align: right; font-weight: bold; font-family: monospace;">${invCurrSym}${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: #eef2ff; color: #3730a3; font-weight: 900; font-size: 11.5px;">
                                <td style="padding: 6px 6px; border: 1px solid #c7d2fe;">GRAND TOTAL (${invCurrCode}):</td>
                                <td style="padding: 6px 6px; text-align: right; border: 1px solid #c7d2fe; font-family: monospace;">${invCurrSym}${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

export const generateFrontendGrnPDF = async (data: PrintGrnData) => {
    const { grn, vendors = [] } = data;
    if (!grn) {
        alert("No GRN data provided for PDF generation");
        return;
    }

    // Immediately open window on user click so browser pop-up blocker does NOT block it
    const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (printWindow) {
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head><title>Loading GRN Document...</title></head>
            <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc; color: #475569;">
                <div style="text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Preparing GRN Document...</div>
                    <div style="font-size: 13px; color: #94a3b8;">Loading company details and layout...</div>
                </div>
            </body>
            </html>
        `);
    }

    let companyInfo = resolveCompanyInfo(data.companyInfo);
    if (!companyInfo?.companyName && !companyInfo?.name && !companyInfo?.legalName) {
        const fetched = await fetchCompanyInfoFromApi();
        if (fetched) {
            companyInfo = resolveCompanyInfo(fetched);
        }
    }

    let vendorObj: any = grn.supplier || grn.vendor;
    if (typeof vendorObj === 'string') {
        vendorObj = vendors.find((v: any) => v._id === vendorObj) || { name: vendorObj };
    }
    const partyName = grn.supplierName || grn.customerName || vendorObj?.name || (typeof grn.supplier === 'object' ? grn.supplier?.name : '') || "In-House / Direct";
    const partyAddress = vendorObj?.address || vendorObj?.billingAddress || '';
    const partyGst = vendorObj?.gst || vendorObj?.gstNumber || 'N/A';
    const partyPhone = vendorObj?.phone || vendorObj?.contactNumber || '';

    const compName = companyInfo?.companyName || companyInfo?.name || companyInfo?.legalName || companyInfo?.tradeName || 'COMPANY NAME';
    const compAddressRaw = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.companyAddress || '';
    const compCityState = [companyInfo?.city, companyInfo?.state, companyInfo?.pincode ? `- ${companyInfo.pincode}` : ''].filter(Boolean).join(' ');
    const compAddress = [compAddressRaw, compCityState].filter(Boolean).join(', ') || compAddressRaw;
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || companyInfo?.mobile || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || companyInfo?.gst || 'N/A';
    const compPan = companyInfo?.panNumber || companyInfo?.pan || 'N/A';

    let compLogo = companyInfo?.logo || companyInfo?.logoUrl || companyInfo?.companyLogo || '';
    if (compLogo && !compLogo.startsWith('http') && !compLogo.startsWith('data:')) {
        compLogo = `${API_BASE_URL}${compLogo.startsWith('/') ? '' : '/'}${compLogo}`;
    }

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

        const hasSec = Boolean(item.hasSecondaryUnit);
        const secUnit = item.secondaryUnit || '';
        const secQty = Number(item.secondaryQuantity || item.secondaryReceivedQuantity || 0);
        const secAccQty = Number(item.secondaryAcceptedQuantity !== undefined ? item.secondaryAcceptedQuantity : secQty);
        const secRejQty = Number(item.secondaryRejectedQuantity || 0);

        const rcvDisplay = hasSec && secUnit
            ? `<div>${qty}</div><div style="font-size: 9px; color: #4f46e5; font-weight: bold;">(${secQty} ${secUnit})</div>`
            : `${qty}`;

        const accDisplay = hasSec && secUnit
            ? `<div>${accQty}</div><div style="font-size: 9px; color: #16a34a; font-weight: bold;">(${secAccQty} ${secUnit})</div>`
            : `${accQty}`;

        const rejDisplay = hasSec && secUnit && secRejQty > 0
            ? `<div>${rejQty}</div><div style="font-size: 9px; color: #dc2626; font-weight: bold;">(${secRejQty} ${secUnit})</div>`
            : (rejQty > 0 ? `${rejQty}` : '-');

        const hsn = item.hsnCode || item.material?.hsnCode || item.fgItem?.hsnCode || item.component?.hsnCode || '-';

        itemsTableRowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                <td style="padding: 6px 8px;">
                    <div style="font-weight: bold; color: #0f172a;">${name}</div>
                    ${desc ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">📝 ${desc}</div>` : ''}
                </td>
                <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-size: 10px; color: #475569;">${hsn}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${rcvDisplay}</td>
                <td style="padding: 6px 8px; text-align: center; color: #16a34a; font-weight: bold;">${accDisplay}</td>
                <td style="padding: 6px 8px; text-align: center; color: ${rejQty > 0 ? '#dc2626' : '#94a3b8'}; font-weight: bold;">${rejDisplay}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: 600;">
                    <div>${item.unit || 'PCS'}</div>
                    ${hasSec && secUnit ? `<div style="font-size: 9px; color: #4f46e5; font-weight: bold;">(${secUnit})</div>` : ''}
                </td>
                <td style="padding: 6px 8px; text-align: right;">₹${rate.toFixed(2)}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #0f172a;">₹${lineTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    const grnTaxRate = Number(grn.taxRate) || 0;
    const grnSubtotal = Number(grn.subtotal) || totalVal;
    const grnTaxAmount = Number(grn.taxAmount) || (grnTaxRate > 0 ? (grnSubtotal * grnTaxRate) / 100 : 0);
    const grnGrandTotal = Number(grn.totalAmount) || (grnSubtotal + grnTaxAmount);

    const pagesHtml = copyTypes.map((copyTitle) => `
        <div class="page" style="page-break-after: always; width: 100%; max-width: 800px; margin: 0 auto 30px auto; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <!-- Top Copy Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
                    ${compLogo ? `
                        <img src="${compLogo}" alt="${compName}" style="max-height: 52px; max-width: 140px; object-fit: contain;" />
                    ` : ''}
                    <div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e1b4b; letter-spacing: -0.5px;">${compName}</h2>
                        ${compAddress ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${compAddress}</div>` : ''}
                        <div style="font-size: 10px; color: #64748b;">GSTIN: <strong style="color: #0f172a;">${compGst}</strong> | PAN: <strong>${compPan}</strong> ${compPhone ? `| Ph: ${compPhone}` : ''} ${compEmail ? `| Email: ${compEmail}` : ''}</div>
                    </div>
                </div>
                <div style="text-align: right; flex-shrink: 0; margin-left: 10px;">
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
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">PO Number</div>
                        <div style="font-size: 11px; font-weight: bold; color: #0f172a;">${grn.poNumber || grn.purchaseOrder?.poNumber || (grn.poReference && !grn.invoiceNumber ? grn.poReference : 'Direct / None')}</div>
                    </div>
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Invoice Number</div>
                        <div style="font-size: 11px; font-weight: bold; color: #0f172a;">${grn.invoiceNumber || grn.invoiceNo || (grn.poReference && grn.poReference !== grn.poNumber ? grn.poReference : '-') || '-'}</div>
                    </div>
                    ${grn.mrpNumber ? `
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">MRP Plan</div>
                        <div style="font-size: 11px; font-weight: bold; color: #7c3aed;">MRP #${grn.mrpNumber}</div>
                    </div>
                    ` : ''}
                    <div>
                        <div style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">QC Status</div>
                        <div style="font-size: 11px; font-weight: bold; color: ${grn.qcStatus === 'Passed' || grn.qcStatus === 'Completed' ? '#16a34a' : '#4f46e5'};">${grn.qcStatus || (grn.qcRequired ? 'Pending QC' : 'Direct Accepted')}</div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background: #1e1b4b; color: #fff; font-size: 10px; text-transform: uppercase; font-weight: 800;">
                        <th style="padding: 7px 8px; width: 28px; text-align: center;">#</th>
                        <th style="padding: 7px 8px; text-align: left;">Item Description</th>
                        <th style="padding: 7px 8px; width: 65px; text-align: center;">HSN/SAC</th>
                        <th style="padding: 7px 8px; width: 55px; text-align: center;">Rcv Qty</th>
                        <th style="padding: 7px 8px; width: 55px; text-align: center;">Acc Qty</th>
                        <th style="padding: 7px 8px; width: 55px; text-align: center;">Rej Qty</th>
                        <th style="padding: 7px 8px; width: 45px; text-align: center;">Unit</th>
                        <th style="padding: 7px 8px; width: 65px; text-align: right;">Rate (₹)</th>
                        <th style="padding: 7px 8px; width: 80px; text-align: right;">Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: bold; font-size: 11px; border-top: 2px solid #cbd5e1;">
                        <td colspan="3" style="padding: 7px 8px; text-align: right; text-transform: uppercase;">${grnTaxRate > 0 ? 'Total Qty / Subtotal:' : 'Total:'}</td>
                        <td style="padding: 7px 8px; text-align: center;">${totalRcvQty}</td>
                        <td style="padding: 7px 8px; text-align: center; color: #16a34a;">${totalAccQty}</td>
                        <td style="padding: 7px 8px; text-align: center; color: ${totalRejQty > 0 ? '#dc2626' : '#64748b'};">${totalRejQty}</td>
                        <td></td>
                        <td></td>
                        <td style="padding: 7px 8px; text-align: right; font-size: 11px; color: ${grnTaxRate > 0 ? '#1e293b' : '#4f46e5'}; font-weight: 800;">₹${grnSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    ${grnTaxRate > 0 ? `
                    <tr style="background: #f8fafc; font-weight: bold; font-size: 11px;">
                        <td colspan="8" style="padding: 5px 8px; text-align: right; color: #4f46e5; font-size: 10px; text-transform: uppercase;">GST (${grnTaxRate}%):</td>
                        <td style="padding: 5px 8px; text-align: right; font-size: 11px; color: #4f46e5; font-weight: 700;">+ ₹${grnTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style="background: #eef2ff; font-weight: 900; font-size: 12px; border-top: 1px solid #c7d2fe;">
                        <td colspan="8" style="padding: 8px; text-align: right; text-transform: uppercase; color: #1e1b4b;">Whole GRN Price (with GST):</td>
                        <td style="padding: 8px; text-align: right; font-size: 12px; color: #059669; font-weight: 900;">₹${grnGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    ` : ''}
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

    if (!printWindow) {
        alert("Pop-up blocked! Please allow pop-ups to print/download the GRN PDF.");
        return;
    }

    printWindow.document.open();
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

/**
 * Generate Quality MRB Corrective Action Sheet PDF
 */
export const generateMRBCorrectiveActionPDF = (ticket: any, companyInfo?: any) => {
    const compName = companyInfo?.companyName || 'BINSERP MANUFACTURING ENTERPRISE';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || 'Industrial Area, Phase 2';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || 'N/A';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked! Please allow pop-ups to print the MRB Report.");
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>MRB_${ticket.ticketNumber || 'Report'}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; background: #fff; }
                .border-box { border: 1.5px solid #1e293b; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
                th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; font-weight: bold; }
                .badge { display: inline-block; padding: 2px 8px; font-weight: bold; border-radius: 4px; font-size: 10px; text-transform: uppercase; }
                .badge-danger { background: #ffe4e6; color: #9f1239; border: 1px solid #f43f5e; }
                .badge-success { background: #dcfce7; color: #166534; border: 1px solid #22c55e; }
                .badge-primary { background: #e0e7ff; color: #3730a3; border: 1px solid #6366f1; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body style="padding: 10px;">
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 999; background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 6px; display: flex; gap: 8px; font-weight: bold;">
                <button onclick="window.print()" style="background: #4f46e5; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Print / Save PDF</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>

            <div class="border-box" style="padding: 15px;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a;">${compName}</h2>
                        <div style="font-size: 10px; color: #475569; margin-top: 3px;">${compAddress} | GSTIN: ${compGst}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 14px; font-weight: 900; color: #4338ca;">MRB CORRECTIVE ACTION REPORT</div>
                        <div style="font-size: 11px; font-weight: bold; font-family: monospace;">TICKET #: ${ticket.ticketNumber}</div>
                        <div style="font-size: 10px; color: #64748b;">Date: ${new Date(ticket.createdAt || Date.now()).toLocaleDateString('en-GB')}</div>
                    </div>
                </div>

                <!-- Info Grid -->
                <table>
                    <tr>
                        <td style="width: 25%; font-weight: bold; background: #f8fafc;">Inspection Phase:</td>
                        <td style="width: 25%; font-weight: bold; color: #1e1b4b;">${ticket.sourceType || 'Quality Inspection'}</td>
                        <td style="width: 25%; font-weight: bold; background: #f8fafc;">Source Document:</td>
                        <td style="width: 25%; font-family: monospace; font-weight: bold;">${ticket.sourceDocNumber || 'Direct QC'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; background: #f8fafc;">Material Name:</td>
                        <td style="font-weight: bold;">${ticket.materialName}</td>
                        <td style="font-weight: bold; background: #f8fafc;">Material Code / Type:</td>
                        <td>${ticket.materialCode || 'N/A'} (${ticket.itemType || 'RM'})</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; background: #f8fafc;">Defective Quantity:</td>
                        <td style="font-weight: 900; color: #be123c; font-size: 12px;">${ticket.rejectedQuantity} ${ticket.unit || 'KG'}</td>
                        <td style="font-weight: bold; background: #f8fafc;">Origin / Supplier:</td>
                        <td>${ticket.vendorName || ticket.workstation || 'Shop Floor'}</td>
                    </tr>
                </table>

                <!-- Defect Diagnosis -->
                <div style="margin-top: 15px;">
                    <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; border-bottom: none;">
                        1. Defect Diagnosis & Root Cause Classification
                    </div>
                    <table>
                        <tr>
                            <td style="width: 30%; font-weight: bold;">Defect Category:</td>
                            <td style="font-weight: bold; color: #be123c;">${ticket.defectCategory || 'Dimensional Deviation'}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">Inspector Remarks / Failure Mode:</td>
                            <td>${ticket.rejectionReason || 'Failure observed during inspection against quality drawing standards.'}</td>
                        </tr>
                    </table>
                </div>

                <!-- Corrective Action Disposition -->
                <div style="margin-top: 15px;">
                    <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; background: #e0e7ff; color: #3730a3; padding: 6px; border: 1px solid #c7d2fe; border-bottom: none;">
                        2. MRB Corrective Action Disposition
                    </div>
                    <table>
                        <tr>
                            <td style="width: 30%; font-weight: bold;">Action Pathway:</td>
                            <td style="font-weight: 900; font-size: 12px; color: #4338ca;">${ticket.dispositionAction}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">Linked Official Document:</td>
                            <td style="font-family: monospace; font-weight: bold;">${ticket.documentType || 'None'}: ${ticket.documentNumber || ticket.rtvDetails?.challanNumber || ticket.reworkDetails?.reworkJobNumber || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">Disposition Date & Auditor:</td>
                            <td>${ticket.dispositionDate ? new Date(ticket.dispositionDate).toLocaleString('en-GB') : 'Pending'} by <b>${ticket.dispositionByName || ticket.createdByName || 'Quality Authority'}</b></td>
                        </tr>
                    </table>
                </div>

                <!-- Financial Loss & Valuation -->
                <div style="margin-top: 15px;">
                    <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; border-bottom: none;">
                        3. Valuation & Financial Impact
                    </div>
                    <table>
                        <tr>
                            <td style="width: 30%; font-weight: bold;">Unit Purchase Rate:</td>
                            <td>₹${Number(ticket.unitRate || 0).toFixed(2)} / ${ticket.unit || 'KG'}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">Total Estimated Material Valuation:</td>
                            <td style="font-weight: 900; color: #0f172a;">₹${((ticket.rejectedQuantity || 0) * (ticket.unitRate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </table>
                </div>

                <!-- Signatures -->
                <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center;">
                    <div style="width: 28%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        QC Inspector<br><span style="font-weight: normal; color: #64748b;">(${ticket.createdByName || 'Prepared By'})</span>
                    </div>
                    <div style="width: 28%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Quality Head / MRB Lead<br><span style="font-weight: normal; color: #64748b;">(Authorized Signatory)</span>
                    </div>
                    <div style="width: 28%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Store In-Charge / Plant Head<br><span style="font-weight: normal; color: #64748b;">(Acknowledge & Close)</span>
                    </div>
                </div>
            </div>
            <script>setTimeout(function() { window.print(); }, 400);</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

/**
 * Generate Return Invoice / Tax Return Bill & Debit Note PDF
 */
export const generateReturnInvoicePDF = (ticket: any, companyInfo?: any) => {
    const compName = companyInfo?.companyName || 'BINSERP MANUFACTURING ENTERPRISE';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || 'Industrial Area, Phase 2';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || '27AAAAA0000A1Z5';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked! Please allow pop-ups to print the Return Bill.");
        return;
    }

    const qty = Number(ticket.rejectedQuantity || 1);
    const rate = Number(ticket.unitRate || 0);
    const taxableBase = ticket.taxDetails?.taxableAmount || (qty * rate);
    const cgst = ticket.taxDetails?.cgst || (taxableBase * 0.09);
    const sgst = ticket.taxDetails?.sgst || (taxableBase * 0.09);
    const igst = ticket.taxDetails?.igst || 0;
    const grandTotal = ticket.taxDetails?.totalAmount || (taxableBase + cgst + sgst + igst);

    const docNo = ticket.documentNumber || ticket.rtvDetails?.challanNumber || `RET-INV-${Date.now().toString().slice(-5)}`;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${docNo}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; background: #fff; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 11px; }
                th { background: #f8fafc; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body style="padding: 10px;">
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 999; background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 6px; display: flex; gap: 8px; font-weight: bold;">
                <button onclick="window.print()" style="background: #e11d48; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Print Return Bill</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>

            <div style="border: 2px solid #0f172a; padding: 15px;">
                <!-- Header Title -->
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: 900; color: #be123c; text-transform: uppercase;">TAX RETURN INVOICE & DEBIT NOTE</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">(Issued under GST Law for Return of Rejected / Substandard Materials)</div>
                </div>

                <!-- Company & Document Meta -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <div style="width: 50%;">
                        <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${compName}</div>
                        <div style="font-size: 10px; color: #475569; margin-top: 2px;">${compAddress}</div>
                        <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">GSTIN: ${compGst}</div>
                    </div>
                    <div style="width: 45%; text-align: right;">
                        <table>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Return Bill #:</td><td style="font-family: monospace; font-weight: 900; color: #be123c;">${docNo}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Debit Note #:</td><td style="font-family: monospace;">${ticket.rtvDetails?.debitNoteNumber || 'DN-AUTO'}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Date:</td><td>${new Date(ticket.documentDate || Date.now()).toLocaleDateString('en-GB')}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Ref GRN #:</td><td>${ticket.sourceDocNumber || 'N/A'}</td></tr>
                        </table>
                    </div>
                </div>

                <!-- Vendor Bill-To -->
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Returned To (Supplier / Vendor):</div>
                    <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px;">${ticket.vendorName || 'SUPPLIER'}</div>
                    <div style="font-size: 10px; color: #475569; margin-top: 1px;">Vehicle #: ${ticket.rtvDetails?.vehicleNumber || 'Hand Delivery / Carrier'} | Dispatch By: ${ticket.rtvDetails?.dispatchedBy || 'Store In-Charge'}</div>
                </div>

                <!-- Items Table -->
                <table style="margin-bottom: 12px;">
                    <thead>
                        <tr>
                            <th style="width: 5%; text-align: center;">#</th>
                            <th style="width: 45%;">Description of Returned Material</th>
                            <th style="width: 15%; text-align: center;">HSN Code</th>
                            <th style="width: 15%; text-align: center;">Returned Qty</th>
                            <th style="width: 10%; text-align: right;">Unit Rate</th>
                            <th style="width: 10%; text-align: right;">Taxable Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="text-align: center; font-weight: bold;">1</td>
                            <td>
                                <div style="font-weight: bold; font-size: 12px;">${ticket.materialName}</div>
                                <div style="font-size: 10px; color: #64748b;">Code: ${ticket.materialCode || 'N/A'} | Reason: ${ticket.rejectionReason || 'Quality Rejection'}</div>
                            </td>
                            <td style="text-align: center; font-family: monospace;">7208 / RM</td>
                            <td style="text-align: center; font-weight: 900; color: #be123c; font-size: 12px;">${qty} ${ticket.unit || 'KG'}</td>
                            <td style="text-align: right; font-family: monospace;">₹${rate.toFixed(2)}</td>
                            <td style="text-align: right; font-weight: bold; font-family: monospace;">₹${taxableBase.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Tax & Grand Total -->
                <div style="display: flex; justify-content: space-between;">
                    <div style="width: 50%; font-size: 10px; color: #475569; border: 1px solid #cbd5e1; padding: 8px;">
                        <b>Terms of Return:</b>
                        <ol style="margin: 4px 0 0 14px; padding: 0;">
                            <li>The debit note has been debited to your supplier ledger account.</li>
                            <li>Material returned due to QC inspection failure at receiving bay.</li>
                            <li>Please issue matching credit note within 15 days under GST rules.</li>
                        </ol>
                    </div>
                    <div style="width: 45%;">
                        <table>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Taxable Base:</td><td style="text-align: right; font-family: monospace;">₹${taxableBase.toFixed(2)}</td></tr>
                            <tr><td style="background: #f8fafc;">CGST (9%):</td><td style="text-align: right; font-family: monospace;">₹${cgst.toFixed(2)}</td></tr>
                            <tr><td style="background: #f8fafc;">SGST (9%):</td><td style="text-align: right; font-family: monospace;">₹${sgst.toFixed(2)}</td></tr>
                            ${igst > 0 ? `<tr><td style="background: #f8fafc;">IGST (18%):</td><td style="text-align: right; font-family: monospace;">₹${igst.toFixed(2)}</td></tr>` : ''}
                            <tr style="background: #ffe4e6;"><td style="font-weight: 900; font-size: 12px; color: #9f1239;">GRAND TOTAL (DEBIT):</td><td style="text-align: right; font-weight: 900; font-size: 13px; font-family: monospace; color: #9f1239;">₹${grandTotal.toFixed(2)}</td></tr>
                        </table>
                    </div>
                </div>

                <!-- Signatures -->
                <div style="margin-top: 35px; display: flex; justify-content: space-between; text-align: center;">
                    <div style="width: 30%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Store Dispatcher
                    </div>
                    <div style="width: 30%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Carrier / Driver Signature
                    </div>
                    <div style="width: 30%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        For ${compName}<br><span style="font-weight: normal; color: #64748b;">(Authorized Signatory)</span>
                    </div>
                </div>
            </div>
            <script>setTimeout(function() { window.print(); }, 400);</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

/**
 * Generate Replacement Delivery Challan PDF
 */
export const generateReplacementDcPDF = (ticket: any, companyInfo?: any) => {
    const compName = companyInfo?.companyName || 'BINSERP MANUFACTURING ENTERPRISE';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || 'Industrial Area, Phase 2';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || '27AAAAA0000A1Z5';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked! Please allow pop-ups to print the Replacement DC.");
        return;
    }

    const docNo = ticket.documentNumber || `RPL-DC-${Date.now().toString().slice(-5)}`;
    const qty = Number(ticket.rejectedQuantity || 1);

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${docNo}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; background: #fff; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 11px; }
                th { background: #f8fafc; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body style="padding: 10px;">
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 999; background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 6px; display: flex; gap: 8px; font-weight: bold;">
                <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Print Delivery Challan</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>

            <div style="border: 2px solid #0f172a; padding: 15px;">
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: 900; color: #1e40af; text-transform: uppercase;">DELIVERY CHALLAN (WARRANTY REPLACEMENT)</div>
                    <div style="font-size: 10px; font-weight: bold; color: #be123c; margin-top: 2px;">(MATERIAL SENT FOR FREE OF COST REPLACEMENT UNDER WARRANTY - NOT FOR SALE)</div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <div style="width: 50%;">
                        <div style="font-size: 14px; font-weight: 900;">${compName}</div>
                        <div style="font-size: 10px; color: #475569; margin-top: 2px;">${compAddress}</div>
                        <div style="font-size: 10px; font-weight: bold;">GSTIN: ${compGst}</div>
                    </div>
                    <div style="width: 45%; text-align: right;">
                        <table>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Challan #:</td><td style="font-family: monospace; font-weight: 900; color: #1e40af;">${docNo}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Date:</td><td>${new Date(ticket.documentDate || Date.now()).toLocaleDateString('en-GB')}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Ref Ticket #:</td><td>${ticket.ticketNumber}</td></tr>
                        </table>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b;">DISPATCHED TO SUPPLIER:</div>
                    <div style="font-size: 13px; font-weight: 900; color: #0f172a;">${ticket.vendorName || 'SUPPLIER'}</div>
                </div>

                <table style="margin-bottom: 15px;">
                    <thead>
                        <tr>
                            <th style="width: 8%; text-align: center;">#</th>
                            <th style="width: 60%;">Item Description</th>
                            <th style="width: 15%; text-align: center;">Dispatched Qty</th>
                            <th style="width: 17%; text-align: center;">Defect Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="text-align: center; font-weight: bold;">1</td>
                            <td>
                                <div style="font-weight: bold; font-size: 12px;">${ticket.materialName}</div>
                                <div style="font-size: 10px; color: #64748b;">Code: ${ticket.materialCode || 'N/A'} | Expected Replacement by: ${ticket.replacementDetails?.expectedDate ? new Date(ticket.replacementDetails.expectedDate).toLocaleDateString('en-GB') : '7 Days'}</div>
                            </td>
                            <td style="text-align: center; font-weight: 900; font-size: 13px; color: #1e40af;">${qty} ${ticket.unit || 'KG'}</td>
                            <td style="text-align: center; font-weight: bold; color: #be123c;">${ticket.defectCategory || 'Defect'}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; color: #475569; margin-bottom: 30px;">
                    <b>Special Instructions & Warranty Declaration:</b>
                    <div>1. This delivery challan is issued under Section 55 of the CGST Rules for dispatch of defective goods for replacement.</div>
                    <div>2. No commercial sale is involved in this outward shipment.</div>
                    <div>3. The replacement material must be delivered accompanied by a zero-value inward delivery challan referencing this document number.</div>
                </div>

                <div style="display: flex; justify-content: space-between; text-align: center;">
                    <div style="width: 30%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">Store Dispatcher</div>
                    <div style="width: 30%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">Carrier Signature</div>
                    <div style="width: 30%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">For ${compName}</div>
                </div>
            </div>
            <script>setTimeout(function() { window.print(); }, 400);</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

/**
 * Generate Scrap Write-Off Certificate PDF
 */
export const generateScrapCertificatePDF = (ticket: any, companyInfo?: any) => {
    const compName = companyInfo?.companyName || 'BINSERP MANUFACTURING ENTERPRISE';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || 'Industrial Area, Phase 2';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked! Please allow pop-ups to print the Scrap Certificate.");
        return;
    }

    const docNo = ticket.documentNumber || `SCRAP-CERT-${Date.now().toString().slice(-5)}`;
    const qty = Number(ticket.rejectedQuantity || ticket.reworkDetails?.reworkScrappedQuantity || 1);
    const rate = Number(ticket.unitRate || 0);
    const totalLoss = qty * rate;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${docNo}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; background: #fff; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 11px; }
                th { background: #f8fafc; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body style="padding: 10px;">
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 999; background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 6px; display: flex; gap: 8px; font-weight: bold;">
                <button onclick="window.print()" style="background: #334155; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Print Scrap Certificate</button>
                <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>

            <div style="border: 2px solid #0f172a; padding: 15px;">
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; text-transform: uppercase;">CERTIFICATE OF SCRAP & MATERIAL WRITE-OFF</div>
                    <div style="font-size: 10px; color: #64748b;">(Official Plant Authorization for Disposal of Non-Salvageable Material)</div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <div style="width: 50%;">
                        <div style="font-size: 14px; font-weight: 900;">${compName}</div>
                        <div style="font-size: 10px; color: #475569;">${compAddress}</div>
                    </div>
                    <div style="width: 45%; text-align: right;">
                        <table>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Certificate #:</td><td style="font-family: monospace; font-weight: 900;">${docNo}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">Disposal Date:</td><td>${new Date(ticket.scrapDetails?.scrapDisposalDate || Date.now()).toLocaleDateString('en-GB')}</td></tr>
                            <tr><td style="font-weight: bold; background: #f8fafc;">MRB Ticket #:</td><td>${ticket.ticketNumber}</td></tr>
                        </table>
                    </div>
                </div>

                <table>
                    <tr>
                        <td style="width: 25%; font-weight: bold; background: #f8fafc;">Material Scrapped:</td>
                        <td style="width: 35%; font-weight: bold;">${ticket.materialName} (${ticket.materialCode || 'N/A'})</td>
                        <td style="width: 20%; font-weight: bold; background: #f8fafc;">Origin QC Phase:</td>
                        <td style="width: 20%; font-weight: bold;">${ticket.sourceType || 'QC Inspection'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; background: #f8fafc;">Scrap Quantity:</td>
                        <td style="font-weight: 900; color: #be123c; font-size: 12px;">${qty} ${ticket.unit || 'KG'}</td>
                        <td style="font-weight: bold; background: #f8fafc;">Scrap Yard Location:</td>
                        <td>${ticket.scrapDetails?.scrapLocation || 'Scrap Bay A'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; background: #f8fafc;">Defect Root Cause:</td>
                        <td colspan="3">${ticket.defectCategory} - ${ticket.rejectionReason || 'Unrecoverable dimensional / machining damage.'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; background: #f8fafc;">Financial Loss Valuation:</td>
                        <td colspan="3" style="font-weight: 900; font-size: 12px; color: #0f172a;">
                            ₹${totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Unit Cost: ₹${rate.toFixed(2)})
                            ${ticket.scrapDetails?.salvageRealizedAmount ? ` | <span style="color: #166534;">Est. Salvage Recovery: ₹${ticket.scrapDetails.salvageRealizedAmount.toFixed(2)}</span>` : ''}
                        </td>
                    </tr>
                </table>

                <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center;">
                    <div style="width: 28%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Quality In-Charge<br><span style="font-weight: normal; color: #64748b;">(${ticket.createdByName || 'QC Lead'})</span>
                    </div>
                    <div style="width: 28%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Scrap Yard Officer<br><span style="font-weight: normal; color: #64748b;">(${ticket.scrapDetails?.scrapAuthorizedBy || 'Authorized'})</span>
                    </div>
                    <div style="width: 28%; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; font-weight: bold;">
                        Plant Manager / Finance<br><span style="font-weight: normal; color: #64748b;">(Write-Off Sign-Off)</span>
                    </div>
                </div>
            </div>
            <script>setTimeout(function() { window.print(); }, 400);</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};


