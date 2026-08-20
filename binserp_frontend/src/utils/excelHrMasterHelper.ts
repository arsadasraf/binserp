/**
 * HR Master Data Excel Helper
 * 
 * Provides template generation, data export, & parsing for HR master tabs:
 * - Employee (employee)
 * - Department (department)
 * - Designation (designation)
 * - Employee Type (employee-type)
 * - Skill (skill)
 * - Holiday (holiday)
 */

import * as XLSX from 'xlsx';

export interface HrMasterColumnConfig {
    label: string;
    key: string;
    required?: boolean;
    sample: string | number;
    type?: 'string' | 'number' | 'date';
}

export const HR_MASTER_EXCEL_CONFIGS: Record<string, { title: string; filename: string; columns: HrMasterColumnConfig[] }> = {
    'employee': {
        title: 'Employee Master Template',
        filename: 'Template_HR_Employees.xlsx',
        columns: [
            { label: 'Employee ID*', key: 'employeeId', required: true, sample: 'EMP-001' },
            { label: 'Full Name*', key: 'name', required: true, sample: 'Rahul Sharma' },
            { label: 'Contact Phone', key: 'contact', sample: '9876543210' },
            { label: 'Email', key: 'email', sample: 'rahul.sharma@company.com' },
            { label: 'Gender', key: 'gender', sample: 'Male' },
            { label: 'Blood Group', key: 'bloodGroup', sample: 'O+' },
            { label: 'DOB (YYYY-MM-DD)', key: 'dob', sample: '1995-05-15', type: 'date' },
            { label: 'Joining Date* (YYYY-MM-DD)', key: 'joiningDate', required: true, sample: '2023-01-10', type: 'date' },
            { label: 'Department*', key: 'department', required: true, sample: 'Production' },
            { label: 'Designation*', key: 'designation', required: true, sample: 'CNC Operator' },
            { label: 'Employee Type', key: 'employeeType', sample: 'Full-Time' },
            { label: 'Status', key: 'status', sample: 'Active' },
            { label: 'Basic Salary', key: 'basic', sample: 25000, type: 'number' },
            { label: 'HRA', key: 'hra', sample: 10000, type: 'number' },
            { label: 'Conveyance', key: 'conveyance', sample: 2000, type: 'number' },
            { label: 'Medical Allowance', key: 'medical', sample: 1500, type: 'number' },
            { label: 'Special Allowance', key: 'specialAllowance', sample: 3000, type: 'number' },
            { label: 'PF', key: 'pf', sample: 1800, type: 'number' },
            { label: 'ESI', key: 'esi', sample: 750, type: 'number' },
            { label: 'Professional Tax', key: 'professionalTax', sample: 200, type: 'number' }
        ]
    },
    'department': {
        title: 'Department Master Template',
        filename: 'Template_HR_Departments.xlsx',
        columns: [
            { label: 'Department Name*', key: 'name', required: true, sample: 'Production' },
            { label: 'Description', key: 'description', sample: 'Manufacturing and assembly department' }
        ]
    },
    'designation': {
        title: 'Designation Master Template',
        filename: 'Template_HR_Designations.xlsx',
        columns: [
            { label: 'Designation Name*', key: 'name', required: true, sample: 'Senior Machinist' },
            { label: 'Description', key: 'description', sample: 'Responsible for CNC turning operations' }
        ]
    },
    'employee-type': {
        title: 'Employee Type Master Template',
        filename: 'Template_HR_Employee_Types.xlsx',
        columns: [
            { label: 'Type Name*', key: 'name', required: true, sample: 'Full-Time' },
            { label: 'Description', key: 'description', sample: 'Permanent full time payroll employees' }
        ]
    },
    'skill': {
        title: 'Skill Master Template',
        filename: 'Template_HR_Skills.xlsx',
        columns: [
            { label: 'Skill Name*', key: 'name', required: true, sample: 'CNC Programming' },
            { label: 'Description', key: 'description', sample: 'Fanuc and Siemens G-code programming' }
        ]
    },
    'holiday': {
        title: 'Holiday Master Template',
        filename: 'Template_HR_Holidays.xlsx',
        columns: [
            { label: 'Holiday Name*', key: 'name', required: true, sample: 'Independence Day' },
            { label: 'Holiday Date* (YYYY-MM-DD)', key: 'date', required: true, sample: '2026-08-15', type: 'date' },
            { label: 'Holiday Type (Public/Optional/Company)', key: 'type', sample: 'Public' },
            { label: 'Description', key: 'description', sample: 'National Holiday' }
        ]
    }
};

/**
 * Downloads a sample Excel template with headers and 1 row of sample dummy data
 */
export function downloadHrMasterExcelTemplate(tabKey: string) {
    const config = HR_MASTER_EXCEL_CONFIGS[tabKey];
    if (!config) {
        console.error(`No Excel template config found for HR master tab: ${tabKey}`);
        return;
    }

    const headers = config.columns.map(c => c.label);
    const sampleRow = config.columns.map(c => c.sample);

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

    // Auto-fit column widths
    const colWidths = config.columns.map(col => ({
        wch: Math.max(col.label.length + 4, String(col.sample).length + 4, 15)
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    XLSX.writeFile(wb, config.filename);
}

/**
 * Exports current table records to an Excel file formatted nicely
 */
export function exportHrMasterDataToExcel(tabKey: string, data: any[]) {
    const config = HR_MASTER_EXCEL_CONFIGS[tabKey];
    if (!config) return;

    const headers = config.columns.map(c => c.label);

    const rows = (data || []).map(item => {
        return config.columns.map(col => {
            let val: any = undefined;

            // Handle nested salary fields in employee
            if (tabKey === 'employee' && ['basic', 'hra', 'conveyance', 'medical', 'specialAllowance', 'pf', 'esi', 'professionalTax'].includes(col.key)) {
                val = item.salary?.[col.key] ?? item[col.key] ?? 0;
            } else if (col.key === 'isRecurring') {
                val = item.isRecurring ? 'Yes' : 'No';
            } else if (col.type === 'date' && item[col.key]) {
                const d = new Date(item[col.key]);
                val = isNaN(d.getTime()) ? item[col.key] : d.toISOString().split('T')[0];
            } else {
                val = item[col.key] ?? '';
            }

            return val === undefined || val === null ? '' : val;
        });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const colWidths = config.columns.map(col => ({
        wch: Math.max(col.label.length + 4, 15)
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const exportFilename = `${config.filename.replace('Template_', 'Export_').replace('.xlsx', '')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, exportFilename);
}

export interface ParsedHrMasterExcelResult {
    totalRows: number;
    validRows: any[];
    invalidRows: { rowNumber: number; data: any; errors: string[] }[];
    headers: string[];
}

// Common aliases for column header matching
const COLUMN_ALIASES: Record<string, string[]> = {
    'name': ['name', 'fullname', 'employeename', 'departmentname', 'designationname', 'typename', 'skillname', 'holidayname', 'holidaytitle', 'title', 'designation', 'department', 'skill', 'type', 'holiday'],
    'employeeId': ['employeeid', 'empid', 'id', 'empcode'],
    'department': ['department', 'departmentname', 'dept'],
    'designation': ['designation', 'designationname', 'desig', 'role'],
    'employeeType': ['employeetype', 'type', 'typename'],
    'joiningDate': ['joiningdate', 'doj', 'dateofjoining', 'joining'],
    'date': ['date', 'holidaydate'],
    'type': ['type', 'holidaytype', 'employeetype'],
    'status': ['status', 'employeestatus'],
    'contact': ['contact', 'contactphone', 'phone', 'mobile', 'phonenumber'],
    'email': ['email', 'emailid', 'emailaddress'],
    'gender': ['gender', 'sex'],
    'dob': ['dob', 'dateofbirth', 'birthdate'],
    'basic': ['basic', 'basicsalary', 'basicpay'],
    'hra': ['hra', 'houserentallowance'],
    'conveyance': ['conveyance', 'conveyanceallowance'],
    'medical': ['medical', 'medicalallowance'],
    'specialAllowance': ['specialallowance', 'special'],
    'pf': ['pf', 'providentfund'],
    'esi': ['esi'],
    'professionalTax': ['professionaltax', 'pt'],
    'description': ['description', 'desc', 'remarks', 'notes']
};

/**
 * Parses an uploaded Excel file and validates each row according to the tab's column config
 */
export async function parseHrMasterExcelFile(file: File, tabKey: string): Promise<ParsedHrMasterExcelResult> {
    const config = HR_MASTER_EXCEL_CONFIGS[tabKey];
    if (!config) {
        throw new Error(`Invalid HR master tab: ${tabKey}`);
    }

    const dataBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: true });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Read sheet as raw array of arrays
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rawData.length < 2) {
        return {
            totalRows: 0,
            validRows: [],
            invalidRows: [],
            headers: []
        };
    }

    const uploadedHeaders = rawData[0].map(h => String(h || '').trim());
    const rows = rawData.slice(1);

    // Create a mapping from config column to uploaded header index
    const colKeyToHeaderIndex: Record<string, number> = {};
    const usedIndices = new Set<number>();

    const cleanStr = (s: string) => s.toLowerCase().replace(/[\*\(\)\s_:\-\/]/g, '');

    // Pass 1: Exact label or key matching
    config.columns.forEach(col => {
        const cleanColLabel = cleanStr(col.label);
        const cleanColKey = cleanStr(col.key);

        uploadedHeaders.forEach((uploadedHeader, index) => {
            if (usedIndices.has(index)) return;
            const cleanUploaded = cleanStr(uploadedHeader);
            if (cleanUploaded === cleanColLabel || cleanUploaded === cleanColKey) {
                colKeyToHeaderIndex[col.key] = index;
                usedIndices.add(index);
            }
        });
    });

    // Pass 2: Alias matching for remaining columns
    config.columns.forEach(col => {
        if (colKeyToHeaderIndex[col.key] !== undefined) return;

        const aliases = COLUMN_ALIASES[col.key] || [];
        uploadedHeaders.forEach((uploadedHeader, index) => {
            if (usedIndices.has(index)) return;
            const cleanUploaded = cleanStr(uploadedHeader);
            if (aliases.some(alias => cleanUploaded === cleanStr(alias))) {
                colKeyToHeaderIndex[col.key] = index;
                usedIndices.add(index);
            }
        });
    });

    // Pass 3: Positional fallback if single column or exact count match and primary key missing
    if (colKeyToHeaderIndex['name'] === undefined && uploadedHeaders.length > 0 && !usedIndices.has(0)) {
        colKeyToHeaderIndex['name'] = 0;
        usedIndices.add(0);
    }

    const validRows: any[] = [];
    const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];

    rows.forEach((row, rowIdx) => {
        // Skip empty rows
        const isAllEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
        if (isAllEmpty) return;

        const rowNumber = rowIdx + 2; // 1-based index + header row
        const rowObj: Record<string, any> = {};
        const errors: string[] = [];

        // Extract values using mapped header indices
        config.columns.forEach(colConfig => {
            const cellIndex = colKeyToHeaderIndex[colConfig.key];
            let val = cellIndex !== undefined ? row[cellIndex] : undefined;
            if (val === undefined || val === null) {
                val = '';
            }

            // Normalize Date
            if (colConfig.type === 'date') {
                if (val instanceof Date) {
                    val = val.toISOString().split('T')[0];
                } else if (typeof val === 'number') {
                    // Excel serial date format
                    const parsedDate = new Date(Math.round((val - 25569) * 86400 * 1000));
                    val = isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString().split('T')[0];
                } else if (typeof val === 'string' && val.trim()) {
                    val = val.trim();
                }
            } else if (colConfig.type === 'number') {
                if (typeof val === 'string') {
                    val = Number(val.replace(/[^0-9.-]/g, '')) || 0;
                } else if (typeof val !== 'number') {
                    val = 0;
                }
            } else if (typeof val === 'string') {
                val = val.trim();
            }

            rowObj[colConfig.key] = val;
        });

        // Validate Required Fields
        config.columns.forEach(col => {
            if (col.required) {
                const val = rowObj[col.key];
                if (val === undefined || val === null || val === '') {
                    errors.push(`Missing required field: ${col.label.replace('*', '')}`);
                }
            }
        });

        if (errors.length > 0) {
            invalidRows.push({ rowNumber, data: rowObj, errors });
        } else {
            validRows.push(rowObj);
        }
    });

    return {
        totalRows: validRows.length + invalidRows.length,
        validRows,
        invalidRows,
        headers: config.columns.map(c => c.label)
    };
}
