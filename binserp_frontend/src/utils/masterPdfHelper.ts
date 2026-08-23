/**
 * Master Data PDF Generator Helper
 * 
 * Generates professional printable specifications & profile sheets for Store Master records:
 * - Vendors & Suppliers
 * - Customers & Clients
 * - Raw Materials & Bought Out Items (RM/BO)
 * - Finished Goods (FG Items with BOM & Allocation details)
 * - Storage Locations
 * - Item Categories
 */

interface GenerateMasterPdfProps {
    masterTab: string;
    item: any;
    companyInfo?: any;
}

export const generateMasterRecordPDF = ({ masterTab, item, companyInfo }: GenerateMasterPdfProps) => {
    if (!item) {
        alert("No record data provided for PDF generation");
        return;
    }

    const compName = companyInfo?.companyName || 'BINSERP ENTERPRISE';
    const compAddress = companyInfo?.billingAddress || companyInfo?.address || companyInfo?.companyAddress || '';
    const compPhone = companyInfo?.contactNumber || companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gstNumber || companyInfo?.gstin || companyInfo?.gst || 'N/A';
    const compPan = companyInfo?.panNumber || companyInfo?.pan || 'N/A';
    const compLogo = companyInfo?.logoUrl || companyInfo?.logo || '';

    const todayDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    let docTitle = 'MASTER RECORD PROFILE';
    let docThemeColor = '#3b82f6'; // default blue
    let specificContentHtml = '';

    // Standardize masterTab identifier
    const tabKey = (masterTab || '').toLowerCase();

    if (tabKey === 'vendor' || tabKey === 'vendors') {
        docTitle = 'VENDOR / SUPPLIER MASTER PROFILE';
        docThemeColor = '#059669'; // Emerald
        const v = item;

        specificContentHtml = `
            <!-- General Information -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #065f46; margin-bottom: 8px;">
                    1. GENERAL & IDENTIFICATION DETAILS
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Vendor Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${v.name || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Vendor Code:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #059669;">${v.code || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Vendor Type:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${v.vendorType || 'Rm Vendor'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Status:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #059669;">Active</td>
                    </tr>
                </table>
            </div>

            <!-- Contact & Communication -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #065f46; margin-bottom: 8px;">
                    2. CONTACT & COMMUNICATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Contact Person:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0;">${v.contactPerson || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Phone / Mobile:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${v.phone || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Email Address:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${v.email || '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Website:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${v.website || '-'}</td>
                    </tr>
                </table>
            </div>

            <!-- Tax & Legal Registration -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #065f46; margin-bottom: 8px;">
                    3. TAX & STATUTORY REGISTRATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">GSTIN Number:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${v.gst || v.gstNumber || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">PAN Number:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${v.pan || '-'}</td>
                    </tr>
                </table>
            </div>

            <!-- Addresses -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #065f46; margin-bottom: 8px;">
                    4. ADDRESS & LOCATION DETAILS
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc;">
                            <strong style="color: #065f46;">Registered / Billing Address:</strong>
                            <div style="margin-top: 4px; line-height: 1.5; color: #334155;">
                                ${v.billingAddress || v.address || '-'}<br/>
                                <b>City:</b> ${v.billingCity || v.city || '-'}<br/>
                                <b>State:</b> ${v.billingState || v.state || '-'}<br/>
                                <b>Pincode:</b> ${v.billingPincode || v.pincode || '-'}<br/>
                                <b>Country:</b> ${v.billingCountry || v.country || 'India'}
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc;">
                            <strong style="color: #065f46;">Shipping / Plant Address:</strong>
                            <div style="margin-top: 4px; line-height: 1.5; color: #334155;">
                                ${v.shippingAddress || v.address || '-'}<br/>
                                <b>City:</b> ${v.shippingCity || v.city || '-'}<br/>
                                <b>State:</b> ${v.shippingState || v.state || '-'}<br/>
                                <b>Pincode:</b> ${v.shippingPincode || v.pincode || '-'}<br/>
                                <b>Country:</b> ${v.shippingCountry || v.country || 'India'}
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Bank Details -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #065f46; margin-bottom: 8px;">
                    5. BANKING & PAYMENT DETAILS
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Bank Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0;">${v.bankDetails?.bankName || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Account Number:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${v.bankDetails?.accountNumber || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">IFSC Code:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace;">${v.bankDetails?.ifscCode || '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Branch Name:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${v.bankDetails?.branchName || v.bankDetails?.branch || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Account Holder:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${v.bankDetails?.accountName || v.name || '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Swift Code:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${v.bankDetails?.swiftCode || '-'}</td>
                    </tr>
                </table>
            </div>
        `;
    } else if (tabKey === 'customer' || tabKey === 'customers') {
        docTitle = 'CUSTOMER / CLIENT MASTER PROFILE';
        docThemeColor = '#4f46e5'; // Indigo
        const c = item;

        specificContentHtml = `
            <!-- General Information -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #3730a3; margin-bottom: 8px;">
                    1. GENERAL & IDENTIFICATION DETAILS
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Customer Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${c.name || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Customer Code:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #4f46e5;">${c.code || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Customer Type:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${c.customerType || 'Manufacturing Sales'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Status:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #16a34a;">Active</td>
                    </tr>
                </table>
            </div>

            <!-- Contact & Communication -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #3730a3; margin-bottom: 8px;">
                    2. CONTACT & COMMUNICATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Contact Person:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0;">${c.contactPerson || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Phone / Mobile:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${c.phone || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Email Address:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${c.email || '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Website:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${c.website || '-'}</td>
                    </tr>
                </table>
            </div>

            <!-- Tax & Legal Registration -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #3730a3; margin-bottom: 8px;">
                    3. TAX & STATUTORY REGISTRATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">GSTIN Number:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${c.gst || c.gstNumber || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">PAN Number:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${c.pan || '-'}</td>
                    </tr>
                </table>
            </div>

            <!-- Addresses -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #3730a3; margin-bottom: 8px;">
                    4. ADDRESS & LOCATION DETAILS
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc;">
                            <strong style="color: #3730a3;">Billing Address:</strong>
                            <div style="margin-top: 4px; line-height: 1.5; color: #334155;">
                                ${c.billingAddress || c.address || '-'}<br/>
                                <b>City:</b> ${c.billingCity || c.city || '-'}<br/>
                                <b>State:</b> ${c.billingState || c.state || '-'}<br/>
                                <b>Pincode:</b> ${c.billingPincode || c.pincode || '-'}<br/>
                                <b>Country:</b> ${c.billingCountry || c.country || 'India'}
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc;">
                            <strong style="color: #3730a3;">Shipping / Delivery Address:</strong>
                            <div style="margin-top: 4px; line-height: 1.5; color: #334155;">
                                ${c.shippingAddress || c.address || '-'}<br/>
                                <b>City:</b> ${c.shippingCity || c.city || '-'}<br/>
                                <b>State:</b> ${c.shippingState || c.state || '-'}<br/>
                                <b>Pincode:</b> ${c.shippingPincode || c.pincode || '-'}<br/>
                                <b>Country:</b> ${c.shippingCountry || c.country || 'India'}
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Bank Details -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #3730a3; margin-bottom: 8px;">
                    5. BANKING & PAYMENT DETAILS
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Bank Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0;">${c.bankDetails?.bankName || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Account Number:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${c.bankDetails?.accountNumber || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">IFSC Code:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace;">${c.bankDetails?.ifscCode || '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Branch Name:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${c.bankDetails?.branchName || c.bankDetails?.branch || '-'}</td>
                    </tr>
                </table>
            </div>
        `;
    } else if (
        tabKey === 'raw-material' || tabKey === 'raw-materials' || tabKey === 'rm-item' || tabKey === 'rm-items' ||
        tabKey === 'bought-out' || tabKey === 'bought-outs' || tabKey === 'bo-item' || tabKey === 'bo-items' ||
        tabKey === 'rm-bo-item' || tabKey === 'materials' || tabKey === 'material' || tabKey === 'rm-bo' ||
        tabKey === 'consumable-item' || tabKey === 'consumables' || tabKey === 'consumable'
    ) {
        const isConsumable = tabKey === 'consumable-item' || tabKey === 'consumables' || tabKey === 'consumable';
        const isBO = tabKey === 'bought-out' || tabKey === 'bought-outs' || tabKey === 'bo-item' || tabKey === 'bo-items';
        docTitle = isConsumable ? 'CONSUMABLE ITEM SPECIFICATION' : (isBO ? 'BOUGHT OUT ITEM SPECIFICATION' : 'RAW MATERIAL SPECIFICATION');
        docThemeColor = isConsumable ? '#0d9488' : (isBO ? '#d97706' : '#2563eb'); // Teal / Amber / Blue
        const m = item;
        const catName = typeof m.categoryId === 'object' ? m.categoryId?.name : m.category || '-';
        const catUnit = typeof m.categoryId === 'object' ? m.categoryId?.unit : m.unit || 'PCS';
        const catHsn = typeof m.categoryId === 'object' ? m.categoryId?.hsnCode : m.hsnCode || '-';
        const locName = typeof m.locationId === 'object' ? m.locationId?.name : (typeof m.location === 'object' ? m.location?.name : (m.storageLocation || m.location || '-'));

        specificContentHtml = `
            <!-- Item Core Specifications -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #1e40af; margin-bottom: 8px;">
                    1. MATERIAL SPECIFICATION & IDENTITY
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Material Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${m.name || m.materialName || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Item Code:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #2563eb;">${m.code || m.materialCode || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Category:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${catName}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Unit of Measurement:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${m.unit || catUnit}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Minimum Stock (Reorder):</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #dc2626;">${m.minimumStock ?? m.minStock ?? 0} ${m.unit || catUnit}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Storage Location:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${locName}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">HSN / SAC Code:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace;">${catHsn}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Standard Rate / Unit:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${m.rate ? '₹ ' + Number(m.rate).toFixed(2) : '-'}</td>
                    </tr>
                </table>
            </div>

            <!-- Description & Technical Notes -->
            <div style="margin-bottom: 16px;">
                <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #1e40af; margin-bottom: 8px;">
                    2. DESCRIPTION & TECHNICAL SPECIFICATIONS
                </div>
                <div style="padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px; line-height: 1.6; color: #334155; min-height: 60px;">
                    ${m.descriptions || m.description || 'No detailed technical descriptions specified for this raw material item.'}
                </div>
            </div>
        `;
    } else if (tabKey === 'fg-items' || tabKey === 'fg-item' || tabKey === 'finished-goods') {
        docTitle = 'FINISHED GOODS PRODUCT SPECIFICATION & BOM';
        docThemeColor = '#7c3aed'; // Purple
        const fg = item;
        const locName = typeof fg.location === 'object' ? fg.location?.name : (typeof fg.locationId === 'object' ? fg.locationId?.name : (fg.location || '-'));
        const bomItems = fg.bom || [];

        let bomRowsHtml = '';
        if (bomItems.length > 0) {
            bomItems.forEach((b: any, idx: number) => {
                bomRowsHtml += `
                    <tr>
                        <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">${idx + 1}</td>
                        <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold;">${b.itemName || '-'}</td>
                        <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;"><span style="background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${b.itemType || 'Material'}</span></td>
                        <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0; font-weight: bold;">${b.quantity || 1} ${b.unit || 'Nos'}</td>
                    </tr>
                `;
            });
        } else {
            bomRowsHtml = `<tr><td colspan="4" style="text-align: center; padding: 16px; color: #64748b; border: 1px solid #e2e8f0;">No BOM components configured for this finished product.</td></tr>`;
        }

        specificContentHtml = `
            <!-- FG Identity -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #5b21b6; margin-bottom: 8px;">
                    1. FINISHED PRODUCT MASTER SPECIFICATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Product Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${fg.name || fg.productName || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Product Code / Part No:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #7c3aed;">${fg.code || fg.productCode || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Assembly Type:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${fg.type || fg.category || 'Component'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Standard Unit:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${fg.unit || 'Nos'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Storage Location:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${locName}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Revision Number:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${fg.revisionNumber || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Reorder Level:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${fg.reorderLevel !== undefined ? fg.reorderLevel + ' ' + (fg.unit || 'Nos') : '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">BOM Components:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${bomItems.length} Items</td>
                    </tr>
                </table>
            </div>

            <!-- Bill of Materials (BOM) -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #5b21b6; margin-bottom: 8px;">
                    2. BILL OF MATERIALS (BOM STRUCTURE)
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #ede9fe; color: #4c1d95;">
                            <th style="width: 8%; padding: 6px; border: 1px solid #e2e8f0; text-align: center;">#</th>
                            <th style="padding: 6px; border: 1px solid #e2e8f0; text-align: left;">Component / RM Name</th>
                            <th style="width: 25%; padding: 6px; border: 1px solid #e2e8f0; text-align: center;">Item Type</th>
                            <th style="width: 20%; padding: 6px; border: 1px solid #e2e8f0; text-align: center;">Qty Required</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bomRowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- Description -->
            <div style="margin-bottom: 16px;">
                <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #5b21b6; margin-bottom: 8px;">
                    3. DESCRIPTION & SPECIFICATIONS
                </div>
                <div style="padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px; line-height: 1.6; color: #334155; min-height: 50px;">
                    ${fg.description || 'No detailed technical descriptions provided for this finished good.'}
                </div>
            </div>
        `;
    } else if (tabKey === 'location' || tabKey === 'locations') {
        docTitle = 'STORAGE LOCATION MASTER RECORD';
        docThemeColor = '#0284c7'; // Sky
        const l = item;

        specificContentHtml = `
            <div style="margin-bottom: 16px;">
                <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #0369a1; margin-bottom: 8px;">
                    1. LOCATION SPECIFICATION & CLASSIFICATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Location Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${l.name || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Location Code:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #0284c7;">${l.code || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Storage Type:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${l.type || 'Rack'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Status:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #16a34a;">Active</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 16px;">
                <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #0369a1; margin-bottom: 8px;">
                    2. DESCRIPTION & RACK / BIN ARRANGEMENT
                </div>
                <div style="padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px; line-height: 1.6; color: #334155; min-height: 60px;">
                    ${l.description || 'Standard warehouse storage area.'}
                </div>
            </div>
        `;
    } else if (tabKey === 'category' || tabKey === 'categories') {
        docTitle = 'MATERIAL CATEGORY SPECIFICATION';
        docThemeColor = '#d97706'; // Amber
        const cat = item;

        specificContentHtml = `
            <div style="margin-bottom: 16px;">
                <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #b45309; margin-bottom: 8px;">
                    1. CATEGORY DETAILS & CLASSIFICATION
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Category Name:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${cat.name || '-'}</td>
                        <td style="width: 25%; font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Category Code:</td>
                        <td style="width: 25%; padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #d97706;">${cat.code || '-'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Category Type:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${cat.type || 'Raw Material'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Standard Unit:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${cat.unit || 'PCS'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">HSN / SAC Code:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace;">${cat.hsnCode || '-'}</td>
                        <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc;">Status:</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #16a34a;">Active</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 16px;">
                <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #b45309; margin-bottom: 8px;">
                    2. DESCRIPTION & NOTES
                </div>
                <div style="padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px; line-height: 1.6; color: #334155; min-height: 60px;">
                    ${cat.description || 'Standard category group.'}
                </div>
            </div>
        `;
    }

    const htmlContent = `
        <div class="page" style="padding: 30px; max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #1e293b;">
            
            <!-- Document Header with Company Branding -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid ${docThemeColor}; padding-bottom: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${compName}</h1>
                    <div style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
                        ${compAddress ? `${compAddress}<br/>` : ''}
                        ${compPhone ? `<b>Phone:</b> ${compPhone} | ` : ''}
                        ${compEmail ? `<b>Email:</b> ${compEmail}` : ''}
                    </div>
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-top: 4px;">
                        ${compGst !== 'N/A' ? `GSTIN: <span style="color: #0f172a; font-family: monospace;">${compGst}</span>` : ''}
                        ${compPan !== 'N/A' ? ` | PAN: <span style="color: #0f172a; font-family: monospace;">${compPan}</span>` : ''}
                    </div>
                </div>

                <div style="text-align: right; margin-left: 20px;">
                    <div style="background: ${docThemeColor}; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                        ${docTitle}
                    </div>
                    <div style="margin-top: 8px; font-size: 11px; color: #475569;">
                        <b>Generated Date:</b> ${todayDate}
                    </div>
                    <div style="font-size: 10px; color: #94a3b8; font-family: monospace; margin-top: 2px;">
                        Record ID: ${item._id || item.code || 'N/A'}
                    </div>
                </div>
            </div>

            <!-- Master-Specific Content -->
            ${specificContentHtml}

            <!-- Footer / Verification -->
            <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="font-size: 10px; color: #64748b; line-height: 1.5;">
                    <i>This is a computer-generated master specification sheet from Binserp ERP System.</i><br/>
                    <b>Last Synchronized:</b> ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : todayDate}
                </div>
                <div style="text-align: center; border-top: 1px solid #475569; width: 180px; padding-top: 6px;">
                    <div style="font-size: 10px; font-weight: bold; color: #1e293b;">Authorized Signature</div>
                    <div style="font-size: 9px; color: #64748b;">Store & Operations Dept</div>
                </div>
            </div>

        </div>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Print popup blocked by browser. Please allow popups to view/print Master PDF.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${docTitle} - ${item.name || item.code || 'Record'}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 12mm;
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    padding: 20px;
                    background-color: #f1f5f9;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                @media print {
                    body {
                        background-color: #fff;
                        padding: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .page {
                        border: none !important;
                        padding: 0 !important;
                        max-width: 100% !important;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Printable Action Header Bar -->
            <div class="no-print" style="max-width: 900px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: ${docThemeColor}; width: 10px; height: 10px; border-radius: 50%;"></span>
                    <strong style="font-size: 13px; letter-spacing: 0.5px;">${docTitle}: ${item.name || item.code || ''}</strong>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.print()" style="background: ${docThemeColor}; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        🖨️ Print / Save as PDF
                    </button>
                    <button onclick="window.close()" style="background: #334155; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        ✕ Close
                    </button>
                </div>
            </div>

            ${htmlContent}
        </body>
        </html>
    `);

    printWindow.document.close();
};
