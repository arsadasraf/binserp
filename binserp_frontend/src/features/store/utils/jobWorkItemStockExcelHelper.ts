import * as XLSX from 'xlsx';

export interface VendorItemStockRow {
    vendorId: string;
    vendorName: string;
    vendorCity?: string;
    itemId?: string;
    itemName: string;
    itemDescription?: string;
    itemType?: string;
    unit: string;
    totalSentQty: number;
    totalReceivedQty: number;
    balanceQty: number;
    expectedReturnItemName?: string;
    expectedReturnItemDesc?: string;
    pendingReturnQty?: number;
    challanNumbers: string[];
    latestDate?: string;
    status: 'Pending' | 'Cleared';
}

interface ExportVendorItemStockOptions {
    items: VendorItemStockRow[];
    vendorName?: string;
    companyInfo?: any;
    onlyPending?: boolean;
}

export const exportVendorItemStockToExcel = ({
    items,
    vendorName,
    companyInfo,
    onlyPending = true
}: ExportVendorItemStockOptions) => {
    const wb = XLSX.utils.book_new();

    // 1. Report Header Banner
    const companyName = companyInfo?.name || companyInfo?.companyName || 'BINS ERP';
    const reportTitle = 'JOB WORK - VENDOR-WISE ITEM STOCK & BALANCE REGISTER';
    const dateGenerated = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const filterContext = vendorName ? `Vendor: ${vendorName}` : 'All Subcontractors / Vendors';
    const filterScope = onlyPending ? 'Items with Active Pending Balance (> 0)' : 'All Dispatched Items (Full History)';

    const sheetData: any[][] = [
        [companyName.toUpperCase()],
        [reportTitle],
        [`Generated On: ${dateGenerated} | Scope: ${filterScope} | Filter: ${filterContext}`],
        [] // Blank row separator
    ];

    // 2. Table Column Headers
    const headers = [
        'S.No',
        'Subcontractor / Vendor',
        'Location / City',
        'Item Name',
        'Technical Description',
        'Category / Type',
        'Unit',
        'Total Sent Qty',
        'Total Received Qty',
        'Balance at Vendor (Pending)',
        'Expected Return Item',
        'Return Item Description',
        'Pending Return Qty',
        'Active Challan Numbers',
        'Latest Dispatch Date',
        'Stock Status'
    ];
    sheetData.push(headers);

    // 3. Populate Rows
    let grandSent = 0;
    let grandReceived = 0;
    let grandBalance = 0;
    let grandPendingReturn = 0;

    items.forEach((row, index) => {
        grandSent += Number(row.totalSentQty) || 0;
        grandReceived += Number(row.totalReceivedQty) || 0;
        grandBalance += Number(row.balanceQty) || 0;
        grandPendingReturn += Number(row.pendingReturnQty) || 0;

        const dateStr = row.latestDate 
            ? new Date(row.latestDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '-';

        sheetData.push([
            index + 1,
            row.vendorName || 'Unknown Vendor',
            row.vendorCity || '-',
            row.itemName || '-',
            row.itemDescription || '-',
            (row.itemType || 'Material').toUpperCase(),
            row.unit || 'PCS',
            Number(row.totalSentQty) || 0,
            Number(row.totalReceivedQty) || 0,
            Number(row.balanceQty) || 0,
            row.expectedReturnItemName || '-',
            row.expectedReturnItemDesc || '-',
            Number(row.pendingReturnQty) || 0,
            row.challanNumbers.join(', ') || '-',
            dateStr,
            row.balanceQty > 0 ? 'Pending with Vendor' : 'Fully Received'
        ]);
    });

    // 4. Summary Totals Row
    sheetData.push([
        '',
        'TOTAL SUMMARY',
        '',
        `${items.length} Unique Item(s)`,
        '',
        '',
        '',
        grandSent,
        grandReceived,
        grandBalance,
        '',
        '',
        grandPendingReturn,
        '',
        '',
        ''
    ]);

    // 5. Convert to Worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // 6. Set Optimal Column Widths
    ws['!cols'] = [
        { wch: 6 },   // S.No
        { wch: 28 },  // Vendor Name
        { wch: 15 },  // Location
        { wch: 32 },  // Item Name
        { wch: 38 },  // Description
        { wch: 14 },  // Category
        { wch: 8 },   // Unit
        { wch: 15 },  // Sent Qty
        { wch: 16 },  // Recv Qty
        { wch: 22 },  // Balance at Vendor
        { wch: 28 },  // Expected Return Item
        { wch: 30 },  // Return Desc
        { wch: 18 },  // Pending Return Qty
        { wch: 25 },  // Challans
        { wch: 16 },  // Latest Date
        { wch: 18 }   // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Vendor Item Stock');

    // 7. Trigger Download
    const cleanVendor = (vendorName || 'All_Vendors').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `JobWork_Vendor_Item_Stock_${cleanVendor}_${dateStamp}.xlsx`;

    XLSX.writeFile(wb, fileName);
};
