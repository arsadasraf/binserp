/**
 * Master Data Excel Helper
 * 
 * Provides template generation & parsing for individual master tabs:
 * - Raw Materials & Bought Out Items (rm-bo-item)
 * - Finished Goods (fg-items)
 * - Inhouse Components (inhouse-items)
 * - Vendors & Suppliers (vendor)
 * - Customers & Clients (customer)
 * - Storage Locations (location)
 * - Categories (category)
 * - Job Work Suppliers (job-work-supplier)
 */

import * as XLSX from 'xlsx';
import { MasterType } from "@/src/features/store/types/store.types";

export interface MasterColumnConfig {
    label: string;
    key: string;
    required?: boolean;
    sample: string | number;
}

export const MASTER_EXCEL_CONFIGS: Record<string, { title: string; filename: string; columns: MasterColumnConfig[] }> = {
    'rm-bo-item': {
        title: 'Raw Material & Bought Out Items Master Template',
        filename: 'Template_Raw_Material_Bought_Out_Items.xlsx',
        columns: [
            { label: 'Material Name*', key: 'name', required: true, sample: 'Steel Rod 12mm' },
            { label: 'Category Name*', key: 'category', required: true, sample: 'Raw Material' },
            { label: 'Unit*', key: 'unit', required: true, sample: 'PCS' },
            { label: 'Minimum Stock', key: 'minStock', sample: 20 },
            { label: 'Storage Location', key: 'storageLocation', sample: 'Rack A1' },
            { label: 'Description', key: 'description', sample: 'High tensile steel rod grade EN8' }
        ]
    },
    'consumable-item': {
        title: 'Consumable Items Master Template',
        filename: 'Template_Consumable_Items.xlsx',
        columns: [
            { label: 'Consumable Name*', key: 'name', required: true, sample: 'Hydraulic Oil ISO 68' },
            { label: 'Category Name*', key: 'category', required: true, sample: 'Lubricants & Oils' },
            { label: 'Unit*', key: 'unit', required: true, sample: 'Ltr' },
            { label: 'Minimum Stock', key: 'minStock', sample: 50 },
            { label: 'Storage Location', key: 'storageLocation', sample: 'Oil Store / Drum 2' },
            { label: 'Description', key: 'description', sample: 'High performance anti-wear hydraulic oil' }
        ]
    },
    'fg-items': {
        title: 'Finished Goods Items Master Template',
        filename: 'Template_Finished_Goods_Master.xlsx',
        columns: [
            { label: 'FG Name*', key: 'name', required: true, sample: 'Electric Motor Assembly' },
            { label: 'FG Code', key: 'code', sample: 'FG-0001' },
            { label: 'Item Type* (Assembly/Sub Assembly/Component)', key: 'type', required: true, sample: 'Assembly' },
            { label: 'Unit*', key: 'unit', required: true, sample: 'Nos' },
            { label: 'Storage Location', key: 'location', sample: 'Main Store' },
            { label: 'Revision Number', key: 'revisionNumber', sample: 'Rev 1.0' },
            { label: 'Reorder Level', key: 'reorderLevel', sample: 10 },
            { label: 'Description', key: 'description', sample: '3-Phase AC Electric Motor 2HP' },
            { label: 'BOM Item Name', key: 'bomItemName', sample: 'Copper Wire 0.5mm' },
            { label: 'BOM Item Type (Material/FGItem)', key: 'bomItemType', sample: 'Material' },
            { label: 'BOM Quantity', key: 'bomQuantity', sample: 2.5 },
            { label: 'BOM Unit', key: 'bomUnit', sample: 'KG' }
        ]
    },
    'inhouse-items': {
        title: 'Inhouse Components Master Template',
        filename: 'Template_Inhouse_Components.xlsx',
        columns: [
            { label: 'Component Name*', key: 'name', required: true, sample: 'Machined Shaft Pin' },
            { label: 'Component Code*', key: 'code', required: true, sample: 'CMP-SHF-05' },
            { label: 'Unit', key: 'unit', sample: 'PCS' },
            { label: 'Opening Stock', key: 'openingStock', sample: 250 },
            { label: 'Standard Rate (INR)', key: 'rate', sample: 125.00 },
            { label: 'Description', key: 'description', sample: 'CNC turned & ground steel shaft pin' }
        ]
    },
    'vendor': {
        title: 'Vendors & Suppliers Master Template',
        filename: 'Template_Vendors.xlsx',
        columns: [
            { label: 'Vendor Name*', key: 'name', required: true, sample: 'Apex Industrial Supplies' },
            { label: 'Vendor Code', key: 'code', sample: 'VEND-001' },
            { label: 'Contact Person', key: 'contactPerson', sample: 'Rahul Sharma' },
            { label: 'Phone Number', key: 'phone', sample: '9876543210' },
            { label: 'Email', key: 'email', sample: 'apex@supplies.com' },
            { label: 'GSTIN', key: 'gst', sample: '27AAAAA0000A1Z5' },
            { label: 'PAN Number', key: 'pan', sample: 'AAAAA0000A' },
            { label: 'Address', key: 'address', sample: 'Plot 45, MIDC Industrial Area' },
            { label: 'City', key: 'city', sample: 'Pune' },
            { label: 'State', key: 'state', sample: 'Maharashtra' },
            { label: 'Pincode', key: 'pincode', sample: '411018' }
        ]
    },
    'customer': {
        title: 'Customers & Clients Master Template',
        filename: 'Template_Customers.xlsx',
        columns: [
            { label: 'Customer Name*', key: 'name', required: true, sample: 'Global Engineering Corp' },
            { label: 'Customer Code', key: 'code', sample: 'CUST-101' },
            { label: 'Customer Type', key: 'customerType', sample: 'Manufacturing Sales' },
            { label: 'Contact Person', key: 'contactPerson', sample: 'Anil Mehta' },
            { label: 'Phone Number', key: 'phone', sample: '9123456789' },
            { label: 'Email', key: 'email', sample: 'orders@globaleng.com' },
            { label: 'GSTIN', key: 'gst', sample: '24BBBBB1111B1Z2' },
            { label: 'PAN Number', key: 'pan', sample: 'BBBBB1111B' },
            { label: 'Billing Address', key: 'address', sample: 'Suite 302, Business Tower' },
            { label: 'City', key: 'city', sample: 'Ahmedabad' },
            { label: 'State', key: 'state', sample: 'Gujarat' },
            { label: 'Pincode', key: 'pincode', sample: '380015' }
        ]
    },
    'location': {
        title: 'Storage Locations Master Template',
        filename: 'Template_Storage_Locations.xlsx',
        columns: [
            { label: 'Location Name*', key: 'name', required: true, sample: 'Main Raw Material Warehouse' },
            { label: 'Location Code', key: 'code', sample: 'LOC-WH1' },
            { label: 'Storage Type', key: 'type', sample: 'Rack' },
            { label: 'Description', key: 'description', sample: 'Primary warehouse racking system' }
        ]
    },
    'category': {
        title: 'Item Categories Master Template',
        filename: 'Template_Categories.xlsx',
        columns: [
            { label: 'Category Name*', key: 'name', required: true, sample: 'Electrical Components' },
            { label: 'Category Code', key: 'code', sample: 'CAT-ELEC' },
            { label: 'Default Unit', key: 'unit', sample: 'PCS' },
            { label: 'HSN Code', key: 'hsnCode', sample: '8501' },
            { label: 'Description', key: 'description', sample: 'All electrical and motor parts' }
        ]
    },
    'job-work-supplier': {
        title: 'Job Work Suppliers Master Template',
        filename: 'Template_Job_Work_Suppliers.xlsx',
        columns: [
            { label: 'Supplier Name*', key: 'name', required: true, sample: 'Precision Heat Treaters' },
            { label: 'Supplier Code', key: 'code', sample: 'JW-HT-01' },
            { label: 'Contact Person', key: 'contactPerson', sample: 'Suresh Patil' },
            { label: 'Phone Number', key: 'phone', sample: '9822012345' },
            { label: 'Email', key: 'email', sample: 'info@precisionheat.com' },
            { label: 'GSTIN', key: 'gst', sample: '27CCCCC2222C1Z8' },
            { label: 'Address', key: 'address', sample: 'Gat No 123, Chakan Industrial Zone' },
            { label: 'City', key: 'city', sample: 'Pune' },
            { label: 'State', key: 'state', sample: 'Maharashtra' }
        ]
    },
    'inventory-bo': {
        title: 'Raw Material & Bought Out Inventory Stock Template',
        filename: 'Template_Inventory_BO_Stock.xlsx',
        columns: [
            { label: 'Material Name*', key: 'materialName', required: true, sample: 'Hex Head Bolt M10' },
            { label: 'Material Code*', key: 'materialCode', required: true, sample: 'RM-BLT-010' },
            { label: 'Opening Stock', key: 'openingStock', sample: 500 },
            { label: 'Unit', key: 'unit', sample: 'PCS' },
            { label: 'Category', key: 'category', sample: 'Hardware' },
            { label: 'Storage Location', key: 'location', sample: 'Bin B-03' }
        ]
    },
    'inventory-inhouse': {
        title: 'In-house Components Stock Template',
        filename: 'Template_Inventory_Inhouse_Stock.xlsx',
        columns: [
            { label: 'Component Name*', key: 'componentName', required: true, sample: 'Shaft Collar Ring' },
            { label: 'Component Code*', key: 'componentCode', required: true, sample: 'CMP-CLR-02' },
            { label: 'Opening Stock', key: 'openingStock', sample: 150 },
            { label: 'Unit', key: 'unit', sample: 'NOS' },
            { label: 'Description', key: 'description', sample: 'Precision lathed steel collar' }
        ]
    },
    'po': {
        title: 'Outward Purchase Orders Template',
        filename: 'Template_Purchase_Orders.xlsx',
        columns: [
            { label: 'Vendor Name*', key: 'vendorName', required: true, sample: 'Apex Industrial Supplies' },
            { label: 'PO Number', key: 'poNumber', sample: 'PO-2026-001' },
            { label: 'Item Name*', key: 'materialName', required: true, sample: 'Steel Rod 12mm' },
            { label: 'Quantity*', key: 'quantity', required: true, sample: 100 },
            { label: 'Unit Rate (INR)*', key: 'rate', required: true, sample: 450.00 },
            { label: 'GST Rate (%)', key: 'gstRate', sample: 18 },
            { label: 'Transport Type', key: 'transportType', sample: 'Road Freight' },
            { label: 'Packing Type', key: 'packingType', sample: 'Wooden Crate' },
            { label: 'Item Description', key: 'description', sample: 'Grade EN8 heat treated' }
        ]
    },
    'purchase-rfq': {
        title: 'Outward Request For Quotations (RFQ) Template',
        filename: 'Template_Outward_RFQ.xlsx',
        columns: [
            { label: 'Vendor Name*', key: 'vendorName', required: true, sample: 'Apex Industrial Supplies' },
            { label: 'RFQ Number', key: 'rfqNumber', sample: 'RFQ-2026-005' },
            { label: 'Item Name*', key: 'materialName', required: true, sample: 'Copper Wire Spool' },
            { label: 'Quantity*', key: 'quantity', required: true, sample: 50 },
            { label: 'Unit', key: 'unit', sample: 'ROLES' },
            { label: 'Target Delivery Date', key: 'targetDate', sample: '2026-09-01' },
            { label: 'Specifications', key: 'specifications', sample: 'Pure electrolytic copper wire 1.5 sq mm' }
        ]
    },
    'vendor-quotation': {
        title: 'Vendor Quotations Template',
        filename: 'Template_Vendor_Quotations.xlsx',
        columns: [
            { label: 'Vendor Name*', key: 'vendorName', required: true, sample: 'Apex Industrial Supplies' },
            { label: 'Quotation Number*', key: 'quotationNumber', required: true, sample: 'QUO-APX-882' },
            { label: 'Item Name*', key: 'materialName', required: true, sample: 'Aluminium Plate 10mm' },
            { label: 'Quantity*', key: 'quantity', required: true, sample: 25 },
            { label: 'Unit Price (INR)*', key: 'unitPrice', required: true, sample: 1250.00 },
            { label: 'GST Rate (%)', key: 'gstRate', sample: 18 }
        ]
    }
};

/**
 * Normalizes master tab names across routes
 */
export const resolveMasterTabKey = (tabKey: string): string => {
    const map: Record<string, string> = {
        'materials': 'rm-bo-item',
        'rm-bo': 'rm-bo-item',
        'rm-bo-item': 'rm-bo-item',
        'consumables': 'consumable-item',
        'consumable': 'consumable-item',
        'consumable-item': 'consumable-item',
        'finished-goods': 'fg-items',
        'fg-item': 'fg-items',
        'fg-items': 'fg-items',
        'inhouse-items': 'inhouse-items',
        'inhouse': 'inhouse-items',
        'vendors': 'vendor',
        'vendor': 'vendor',
        'customers': 'customer',
        'customer': 'customer',
        'locations': 'location',
        'location': 'location',
        'categories': 'category',
        'category': 'category',
        'job-work-suppliers': 'job-work-supplier',
        'job-work-supplier': 'job-work-supplier'
    };
    return map[tabKey] || tabKey;
};

/**
 * Downloads a standardized sample Excel template for the specified Master Tab
 */
export const downloadMasterExcelTemplate = (masterTab: string) => {
    const key = resolveMasterTabKey(masterTab);
    const config = MASTER_EXCEL_CONFIGS[key] || MASTER_EXCEL_CONFIGS['rm-bo-item'];

    const wb = XLSX.utils.book_new();
    const headers = config.columns.map(c => c.label);

    let rows: any[][] = [];

    if (key === 'fg-items') {
        // Multi-row BOM demonstration in sample template
        rows = [
            [
                'Electric Motor Assembly', 'FG-0001', 'Assembly', 'Nos', 'Main Store', 'Rev 1.0', 10,
                '3-Phase AC Electric Motor 2HP', 'Copper Wire 0.5mm', 'Material', 2.5, 'KG'
            ],
            [
                'Electric Motor Assembly', 'FG-0001', 'Assembly', 'Nos', 'Main Store', 'Rev 1.0', 10,
                '3-Phase AC Electric Motor 2HP', 'Rotor Shaft 25mm', 'FGItem', 1, 'Nos'
            ],
            [
                'Electric Motor Assembly', 'FG-0001', 'Assembly', 'Nos', 'Main Store', 'Rev 1.0', 10,
                '3-Phase AC Electric Motor 2HP', 'Ball Bearing 6204', 'Material', 2, 'Nos'
            ]
        ];
    } else {
        const sampleRow = config.columns.map(c => c.sample);
        rows = [sampleRow];
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set Column Widths nicely
    ws['!cols'] = config.columns.map(c => ({ wch: Math.max(c.label.length + 5, 20) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Master_Template');
    XLSX.writeFile(wb, config.filename);
};

export const STORE_COLUMN_ALIASES: Record<string, string[]> = {
    // Finished Goods
    'name': ['fg name', 'finished good name', 'finished goods name', 'item name', 'product name', 'name', 'component name', 'material name', 'supplier name', 'customer name', 'location name', 'category name'],
    'code': ['fg code', 'item code', 'part code', 'part no', 'part number', 'code', 'component code', 'supplier code', 'vendor code', 'customer code', 'location code', 'category code', 'material code'],
    'type': ['item type', 'type', 'fg item type', 'item type (assembly/sub assembly/component)', 'storage type', 'customer type', 'component type'],
    'unit': ['unit', 'uom', 'unit of measure', 'default unit', 'unit*'],
    'location': ['storage location', 'location', 'store location', 'location name'],
    'revisionNumber': ['revision number', 'revision', 'rev no', 'rev', 'rev.', 'revision no'],
    'reorderLevel': ['reorder level', 'reorder qty', 'reorder point', 'min stock', 'minimum stock', 'reorder'],
    'description': ['description', 'desc', 'specification', 'specifications', 'specs', 'remarks', 'note', 'notes', 'descriptions'],
    'bomItemName': ['bom item name', 'bom item', 'bom component', 'bom material', 'raw material', 'bom part name', 'component'],
    'bomItemType': ['bom item type', 'bom type', 'bom item type (material/fgitem)', 'bom type (material/fgitem)'],
    'bomQuantity': ['bom quantity', 'bom qty', 'quantity', 'qty', 'bom count'],
    'bomUnit': ['bom unit', 'bom uom', 'unit'],

    // Raw Material & Bought Out
    'category': ['category', 'category name', 'material category', 'item category'],
    'minStock': ['min stock', 'minimum stock', 'min qty', 'minimum quantity', 'reorder level'],
    'storageLocation': ['storage location', 'location', 'store location', 'location name'],

    // Inhouse Components
    'openingStock': ['opening stock', 'stock', 'current stock', 'qty', 'quantity', 'initial stock'],
    'rate': ['standard rate', 'standard rate (inr)', 'rate', 'unit rate', 'price', 'unit price', 'cost'],

    // Vendors, Customers & Suppliers
    'contactPerson': ['contact person', 'contact name', 'person name', 'contact'],
    'phone': ['phone number', 'phone', 'mobile', 'mobile number', 'contact number', 'telephone'],
    'email': ['email', 'email address', 'mail', 'email id'],
    'gst': ['gstin', 'gst', 'gst number', 'gst no'],
    'pan': ['pan number', 'pan', 'pan no'],
    'address': ['address', 'billing address', 'street', 'location address'],
    'city': ['city', 'town'],
    'state': ['state', 'province'],
    'pincode': ['pincode', 'pin code', 'postal code', 'zip', 'zip code'],
    'customerType': ['customer type', 'type of customer', 'client type'],

    // Category & Location
    'hsnCode': ['hsn code', 'hsn', 'hsn / sac', 'sac code'],

    // PO, RFQ & Quotation
    'vendorName': ['vendor name', 'supplier name', 'vendor'],
    'poNumber': ['po number', 'purchase order number', 'po no'],
    'rfqNumber': ['rfq number', 'rfq no', 'request for quotation number'],
    'quotationNumber': ['quotation number', 'quote number', 'quotation no', 'quote no'],
    'materialName': ['material name', 'item name', 'part name'],
    'quantity': ['quantity', 'qty', 'order qty', 'order quantity'],
    'unitPrice': ['unit price', 'unit price (inr)', 'price', 'rate', 'unit rate'],
    'gstRate': ['gst rate', 'gst rate (%)', 'gst %', 'tax rate'],
    'transportType': ['transport type', 'transportation', 'dispatch mode', 'transport'],
    'packingType': ['packing type', 'packaging', 'package type'],
    'targetDate': ['target delivery date', 'delivery date', 'target date', 'expected date'],
    'specifications': ['specifications', 'specification', 'specs', 'description']
};

export interface ParsedMasterExcelResult {
    validRows: any[];
    invalidRows: { rowNumber: number; data: any; errors: string[] }[];
    totalCount: number;
}

/**
 * Normalizes a string for header/alias comparison by stripping punctuation, asterisks, spaces, etc.
 */
const cleanHeaderStr = (s: any): string => {
    return String(s || '').toLowerCase().replace(/[\*\(\)\s_:\-\/\.]/g, '');
};

/**
 * Parses and validates an uploaded Excel file for the specified Master Tab
 */
export const parseMasterExcelFile = async (file: File, masterTab: string): Promise<ParsedMasterExcelResult> => {
    const key = resolveMasterTabKey(masterTab);
    const config = MASTER_EXCEL_CONFIGS[key] || MASTER_EXCEL_CONFIGS['rm-bo-item'];

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buffer = e.target?.result;
                if (!buffer) {
                    return reject(new Error("File buffer is empty or could not be read"));
                }

                const data = new Uint8Array(buffer as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    return reject(new Error("Uploaded Excel file has no sheets"));
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                if (!worksheet) {
                    return reject(new Error("First sheet in workbook is empty or invalid"));
                }

                // Read 2D array to identify headers accurately
                const rawSheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (!Array.isArray(rawSheetData) || rawSheetData.length === 0) {
                    return resolve({ validRows: [], invalidRows: [], totalCount: 0 });
                }

                // Find the header row (the first row containing non-empty text)
                let headerRowIndex = 0;
                while (
                    headerRowIndex < rawSheetData.length &&
                    (!Array.isArray(rawSheetData[headerRowIndex]) ||
                        rawSheetData[headerRowIndex].every((c: any) => String(c ?? '').trim() === ''))
                ) {
                    headerRowIndex++;
                }

                if (headerRowIndex >= rawSheetData.length) {
                    return resolve({ validRows: [], invalidRows: [], totalCount: 0 });
                }

                const uploadedHeaders: string[] = rawSheetData[headerRowIndex].map((h: any) => String(h ?? '').trim());
                const dataRows = rawSheetData.slice(headerRowIndex + 1);

                // Map configured column keys to uploaded column indices
                const colKeyToHeaderIndex: Record<string, number> = {};
                const usedHeaderIndices = new Set<number>();

                // Pass 1: Direct match against column label or key
                config.columns.forEach(col => {
                    const cleanColLabel = cleanHeaderStr(col.label);
                    const cleanColKey = cleanHeaderStr(col.key);

                    uploadedHeaders.forEach((uploadedHeader, index) => {
                        if (usedHeaderIndices.has(index)) return;
                        const cleanUploaded = cleanHeaderStr(uploadedHeader);
                        if (cleanUploaded && (cleanUploaded === cleanColLabel || cleanUploaded === cleanColKey)) {
                            colKeyToHeaderIndex[col.key] = index;
                            usedHeaderIndices.add(index);
                        }
                    });
                });

                // Pass 2: Match against aliases
                config.columns.forEach(col => {
                    if (colKeyToHeaderIndex[col.key] !== undefined) return;
                    const aliases = STORE_COLUMN_ALIASES[col.key] || [];

                    uploadedHeaders.forEach((uploadedHeader, index) => {
                        if (usedHeaderIndices.has(index)) return;
                        const cleanUploaded = cleanHeaderStr(uploadedHeader);
                        if (!cleanUploaded) return;

                        if (aliases.some(alias => cleanHeaderStr(alias) === cleanUploaded)) {
                            colKeyToHeaderIndex[col.key] = index;
                            usedHeaderIndices.add(index);
                        }
                    });
                });

                // Pass 3: Fuzzy / Substring match for missing required columns
                config.columns.forEach(col => {
                    if (colKeyToHeaderIndex[col.key] !== undefined) return;
                    const cleanColLabel = cleanHeaderStr(col.label);

                    uploadedHeaders.forEach((uploadedHeader, index) => {
                        if (usedHeaderIndices.has(index)) return;
                        const cleanUploaded = cleanHeaderStr(uploadedHeader);
                        if (!cleanUploaded) return;

                        if (cleanUploaded.includes(cleanColLabel) || cleanColLabel.includes(cleanUploaded)) {
                            colKeyToHeaderIndex[col.key] = index;
                            usedHeaderIndices.add(index);
                        }
                    });
                });

                // Pass 4: Positional fallback if primary 'name' column is not mapped and index 0 is free
                if (colKeyToHeaderIndex['name'] === undefined && uploadedHeaders.length > 0 && !usedHeaderIndices.has(0)) {
                    colKeyToHeaderIndex['name'] = 0;
                    usedHeaderIndices.add(0);
                }

                const validRows: any[] = [];
                const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];
                let totalNonEmptyRows = 0;

                dataRows.forEach((row, rowIdx) => {
                    if (!Array.isArray(row)) return;

                    // Skip completely empty rows
                    const isAllEmpty = row.every((cell: any) => cell === '' || cell === null || cell === undefined || String(cell).trim() === '');
                    if (isAllEmpty) return;

                    totalNonEmptyRows++;
                    const rowNumber = headerRowIndex + rowIdx + 2; // 1-based index
                    const mappedItem: Record<string, any> = {};
                    const rawRowData: Record<string, any> = {};
                    const errors: string[] = [];

                    // Populate mappedItem based on discovered column mappings
                    config.columns.forEach(col => {
                        const colIdx = colKeyToHeaderIndex[col.key];
                        if (colIdx !== undefined && colIdx < row.length) {
                            let cellVal = row[colIdx];
                            if (cellVal !== undefined && cellVal !== null) {
                                if (typeof cellVal === 'string') {
                                    cellVal = cellVal.trim();
                                }
                                mappedItem[col.key] = cellVal;
                            }
                        }
                    });

                    // Build rawRowData for debug preview
                    uploadedHeaders.forEach((h, idx) => {
                        if (h && idx < row.length) {
                            rawRowData[h] = row[idx];
                        }
                    });

                    // Validate required fields
                    config.columns.filter(c => c.required).forEach(reqCol => {
                        const val = mappedItem[reqCol.key];
                        if (val === undefined || val === null || String(val).trim() === '') {
                            errors.push(`${reqCol.label.replace(/\*/g, '').trim()} is required`);
                        }
                    });

                    // Validate and convert numeric types safely
                    ['openingStock', 'minStock', 'maxStock', 'rate', 'gstRate', 'reorderLevel', 'bomQuantity', 'quantity', 'unitPrice'].forEach(numKey => {
                        if (mappedItem[numKey] !== undefined && mappedItem[numKey] !== null && String(mappedItem[numKey]).trim() !== '') {
                            const parsedNum = Number(mappedItem[numKey]);
                            if (isNaN(parsedNum)) {
                                errors.push(`${numKey} must be a valid number`);
                            } else {
                                mappedItem[numKey] = parsedNum;
                            }
                        }
                    });

                    if (errors.length === 0) {
                        validRows.push(mappedItem);
                    } else {
                        invalidRows.push({ rowNumber, data: rawRowData, errors });
                    }
                });

                // Finished Goods: Multi-row BOM aggregation
                if (key === 'fg-items') {
                    const groupedMap = new Map<string, any>();
                    let lastFgKey = '';

                    validRows.forEach(item => {
                        const rawName = String(item.name || '').trim();
                        const fgKey = rawName.toLowerCase();

                        // If row has no name but has BOM components, attach to previous FG if available
                        const targetKey = fgKey || lastFgKey;
                        if (!targetKey) return;

                        if (!groupedMap.has(targetKey)) {
                            groupedMap.set(targetKey, {
                                ...item,
                                name: rawName || targetKey,
                                type: String(item.type || 'Assembly').trim(),
                                unit: String(item.unit || 'Nos').trim(),
                                code: String(item.code || '').trim(),
                                location: String(item.location || '').trim(),
                                revisionNumber: String(item.revisionNumber || '').trim(),
                                reorderLevel: Number(item.reorderLevel || 0) || 0,
                                description: String(item.description || '').trim(),
                                bom: []
                            });
                        }

                        const existing = groupedMap.get(targetKey);
                        if (item.bomItemName && String(item.bomItemName).trim() !== '') {
                            existing.bom.push({
                                itemName: String(item.bomItemName).trim(),
                                itemType: String(item.bomItemType || 'Material').trim(),
                                quantity: Number(item.bomQuantity || 1) || 1,
                                unit: String(item.bomUnit || 'Nos').trim()
                            });
                        }

                        if (fgKey) {
                            lastFgKey = fgKey;
                        }
                    });

                    const aggregatedValidRows = Array.from(groupedMap.values());
                    return resolve({
                        validRows: aggregatedValidRows,
                        invalidRows,
                        totalCount: totalNonEmptyRows
                    });
                }

                resolve({
                    validRows,
                    invalidRows,
                    totalCount: totalNonEmptyRows
                });
            } catch (err) {
                console.error("Excel parse error:", err);
                reject(err);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

