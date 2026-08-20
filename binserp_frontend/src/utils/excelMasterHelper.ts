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

export interface ParsedMasterExcelResult {
    validRows: any[];
    invalidRows: { rowNumber: number; data: any; errors: string[] }[];
    totalCount: number;
}

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
                const workbook = XLSX.read(buffer, { type: 'array' });
                
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert sheet to array of objects
                const rawJsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (!Array.isArray(rawJsonData) || rawJsonData.length === 0) {
                    return resolve({ validRows: [], invalidRows: [], totalCount: 0 });
                }

                // Map header labels to schema keys
                const labelToKeyMap: Record<string, MasterColumnConfig> = {};
                config.columns.forEach(col => {
                    const cleanLabel = col.label.replace(/\*/g, '').trim().toLowerCase();
                    labelToKeyMap[cleanLabel] = col;
                });

                const validRows: any[] = [];
                const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];

                rawJsonData.forEach((row, index) => {
                    const rowNumber = index + 2; // Accounting for 1-based header row
                    const mappedItem: Record<string, any> = {};
                    const errors: string[] = [];

                    // Standardize keys
                    Object.keys(row).forEach(rawHeader => {
                        const cleanHeader = rawHeader.replace(/\*/g, '').trim().toLowerCase();
                        const colConfig = labelToKeyMap[cleanHeader];

                        if (colConfig) {
                            let val = row[rawHeader];
                            if (typeof val === 'string') val = val.trim();
                            mappedItem[colConfig.key] = val;
                        }
                    });

                    // Check required fields
                    config.columns.filter(c => c.required).forEach(reqCol => {
                        const val = mappedItem[reqCol.key];
                        if (val === undefined || val === null || String(val).trim() === '') {
                            errors.push(`${reqCol.label.replace(/\*/g, '')} is required`);
                        }
                    });

                    // Validate numeric types
                    ['openingStock', 'minStock', 'maxStock', 'rate', 'gstRate', 'reorderLevel', 'bomQuantity'].forEach(numKey => {
                        if (mappedItem[numKey] !== undefined && mappedItem[numKey] !== '') {
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
                        invalidRows.push({ rowNumber, data: row, errors });
                    }
                });

                if (key === 'fg-items') {
                    // Group rows by FG Name to assemble multi-row BOM components
                    const groupedMap = new Map<string, any>();
                    validRows.forEach(item => {
                        const fgKey = (item.name || '').toLowerCase().trim();
                        if (!groupedMap.has(fgKey)) {
                            groupedMap.set(fgKey, {
                                ...item,
                                bom: []
                            });
                        }
                        const existing = groupedMap.get(fgKey);
                        if (item.bomItemName && String(item.bomItemName).trim() !== '') {
                            existing.bom.push({
                                itemName: String(item.bomItemName).trim(),
                                itemType: (item.bomItemType || 'Material').trim(),
                                quantity: Number(item.bomQuantity || 1) || 1,
                                unit: (item.bomUnit || 'Nos').trim()
                            });
                        }
                    });
                    const aggregatedValidRows = Array.from(groupedMap.values());
                    return resolve({
                        validRows: aggregatedValidRows,
                        invalidRows,
                        totalCount: rawJsonData.length
                    });
                }

                resolve({
                    validRows,
                    invalidRows,
                    totalCount: rawJsonData.length
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
