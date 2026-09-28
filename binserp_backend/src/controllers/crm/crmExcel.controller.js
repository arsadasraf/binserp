import ExcelJS from "exceljs";
import { leadSchema, customerSchema } from "../../models/crm/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// 1. Download Blank Import Excel Template
export const downloadExcelTemplate = asyncHandler(async (req, res) => {
    const { type } = req.params; // 'leads' or 'customers'
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BinsERP CRM";
    workbook.created = new Date();

    if (type === "customers") {
        const sheet = workbook.addWorksheet("Customers Import Template");
        sheet.columns = [
            { header: "Customer / Company Name *", key: "name", width: 30 },
            { header: "Contact Person", key: "contactPerson", width: 25 },
            { header: "Designation", key: "designation", width: 20 },
            { header: "Email Address", key: "email", width: 25 },
            { header: "Phone Number", key: "phone", width: 18 },
            { header: "GST Number", key: "gstin", width: 20 },
            { header: "PAN Number", key: "pan", width: 16 },
            { header: "Industry", key: "industry", width: 22 },
            { header: "Customer Tier (Platinum/Gold/Silver/Standard)", key: "tier", width: 25 },
            { header: "Street Address", key: "street", width: 30 },
            { header: "City", key: "city", width: 18 },
            { header: "State", key: "state", width: 18 },
            { header: "Pincode", key: "zipCode", width: 12 },
            { header: "Annual Revenue (INR)", key: "annualRevenue", width: 22 },
            { header: "Notes", key: "notes", width: 30 }
        ];

        sheet.addRow({
            name: "Apex Precision Tools Pvt Ltd",
            contactPerson: "Rajesh Sharma",
            designation: "Procurement Head",
            email: "rajesh@apexprecision.com",
            phone: "+919876543210",
            gstin: "27AAACA1234A1Z5",
            pan: "AAACA1234A",
            industry: "Automotive & OEM",
            tier: "Gold",
            street: "Plot 42, MIDC Industrial Area",
            city: "Pune",
            state: "Maharashtra",
            zipCode: "411018",
            annualRevenue: 50000000,
            notes: "Strategic buyer for CNC turned parts."
        });

        // Styling header
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=CRM_Customers_Import_Template.xlsx");
        const buffer = await workbook.xlsx.writeBuffer();
        return res.status(200).send(buffer);
    }

    // Default: Leads Template
    const sheet = workbook.addWorksheet("Leads Import Template");
    sheet.columns = [
        { header: "Customer Name *", key: "name", width: 28 },
        { header: "Contact Number *", key: "phone", width: 18 },
        { header: "Email Address", key: "email", width: 25 },
        { header: "Company Name", key: "companyName", width: 28 },
        { header: "Address", key: "address", width: 30 },
        { header: "City", key: "city", width: 18 },
        { header: "Pincode", key: "pincode", width: 14 },
        { header: "State", key: "state", width: 18 },
        { header: "Looking For (Requirements)", key: "requirements", width: 35 },
        { header: "Our Product / Service (From Master)", key: "productInterest", width: 32 },
        { header: "Source (Default: Direct)", key: "source", width: 22 },
        { header: "Warmth (Warm / Hot / Cold)", key: "warmth", width: 20 },
        { header: "Stage (New / Contacted / Qualified)", key: "status", width: 22 },
        { header: "Budget Amount (INR)", key: "estimatedValue", width: 20 },
        { header: "Details with Budget / Notes", key: "budgetDetails", width: 30 }
    ];

    sheet.addRow({
        name: "Rajesh Kumar",
        phone: "+919876543210",
        email: "rajesh@precisionauto.com",
        companyName: "Precision Auto Components",
        address: "Plot 45, Sector 7, IMT Manesar",
        city: "Gurugram",
        pincode: "122051",
        state: "Haryana",
        requirements: "Requirement for 5000 units of custom hydraulic valves monthly.",
        productInterest: "Industrial Automation Valve",
        source: "Direct",
        warmth: "Warm",
        status: "New",
        estimatedValue: 250000,
        budgetDetails: "Payment terms 30 days credit. Delivery required within 4 weeks."
    });

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=CRM_Leads_Import_Template.xlsx");
    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
});

// 2. Bulk Import Leads from Excel
export const importLeadsFromExcel = asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Please upload an Excel (.xlsx/.xls) file");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) throw new ApiError(400, "Uploaded Excel file contains no worksheets");

    const Lead = req.getModel("Lead", leadSchema);
    const rows = [];
    const errors = [];
    let skipped = 0;
    let inserted = 0;

    // Header index resolution
    const headerMap = {};

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            // Build flexible column mappings based on headers
            row.eachCell((cell, colNumber) => {
                const headerText = cell.text?.toLowerCase().trim() || "";
                if (headerText.includes("customer") || headerText.includes("lead name") || headerText.includes("contact person")) {
                    headerMap.name = colNumber;
                } else if (headerText.includes("phone") || headerText.includes("contact number") || headerText.includes("mobile")) {
                    headerMap.phone = colNumber;
                } else if (headerText.includes("email")) {
                    headerMap.email = colNumber;
                } else if (headerText.includes("company")) {
                    headerMap.companyName = colNumber;
                } else if (headerText.includes("address") || headerText.includes("street")) {
                    headerMap.address = colNumber;
                } else if (headerText.includes("city")) {
                    headerMap.city = colNumber;
                } else if (headerText.includes("pincode") || headerText.includes("zip")) {
                    headerMap.pincode = colNumber;
                } else if (headerText.includes("state")) {
                    headerMap.state = colNumber;
                } else if (headerText.includes("looking for") || headerText.includes("requirement")) {
                    headerMap.requirements = colNumber;
                } else if (headerText.includes("product") || headerText.includes("service")) {
                    headerMap.productInterest = colNumber;
                } else if (headerText.includes("source")) {
                    headerMap.source = colNumber;
                } else if (headerText.includes("warmth")) {
                    headerMap.warmth = colNumber;
                } else if (headerText.includes("stage") || headerText.includes("status")) {
                    headerMap.status = colNumber;
                } else if (headerText.includes("budget") || headerText.includes("estimated value") || headerText.includes("deal value")) {
                    headerMap.estimatedValue = colNumber;
                } else if (headerText.includes("detail") || headerText.includes("notes") || headerText.includes("remark")) {
                    headerMap.budgetDetails = colNumber;
                }
            });
            return;
        }

        const getVal = (key, fallbackCol) => {
            const col = headerMap[key] || fallbackCol;
            return row.getCell(col).text?.trim();
        };

        const name = getVal("name", 1);
        const phone = getVal("phone", 2);
        const email = getVal("email", 3)?.toLowerCase();
        const companyName = getVal("companyName", 4);
        const address = getVal("address", 5);
        const city = getVal("city", 6);
        const pincode = getVal("pincode", 7);
        const state = getVal("state", 8);
        const requirements = getVal("requirements", 9);
        const productInterestRaw = getVal("productInterest", 10);
        const source = getVal("source", 11) || "Direct";
        const warmthRaw = getVal("warmth", 12) || "Warm";
        const status = getVal("status", 13) || "New";
        const estimatedValue = parseFloat(getVal("estimatedValue", 14)?.replace(/[^0-9.]/g, "")) || 0;
        const budgetDetails = getVal("budgetDetails", 15);

        if (!name && !companyName && !phone) {
            skipped++;
            return;
        }

        const productInterest = productInterestRaw
            ? productInterestRaw.split(",").map(p => p.trim()).filter(Boolean)
            : [];

        // Normalize warmth
        let warmth = "Warm";
        const lowerWarmth = warmthRaw.toLowerCase();
        if (lowerWarmth.includes("hot")) warmth = "Hot";
        else if (lowerWarmth.includes("cold")) warmth = "Cold";
        else if (lowerWarmth.includes("warm")) warmth = "Warm";

        rows.push({
            rowNumber,
            data: {
                company: req.company._id,
                name: name || companyName || `Lead ${phone || rowNumber}`,
                companyName: companyName || name,
                email: email || undefined,
                phone: phone || undefined,
                address,
                city,
                pincode,
                state,
                requirements,
                productInterest,
                source: source || "Direct",
                warmth,
                status: status || "New",
                estimatedValue,
                budgetDetails,
                notes: budgetDetails,
                createdBy: req.user._id
            }
        });
    });

    for (const item of rows) {
        try {
            // Check existing lead by phone or email in this company
            let duplicate = null;
            if (item.data.phone) {
                duplicate = await Lead.findOne({ company: req.company._id, phone: item.data.phone });
            }
            if (!duplicate && item.data.email) {
                duplicate = await Lead.findOne({ company: req.company._id, email: item.data.email });
            }

            if (duplicate) {
                skipped++;
                continue;
            }

            await Lead.create(item.data);
            inserted++;
        } catch (err) {
            errors.push(`Row ${item.rowNumber}: ${err.message}`);
            skipped++;
        }
    }

    return res.status(200).json(new ApiResponse(200, {
        totalRows: rows.length,
        inserted,
        skipped,
        errors
    }, `Import completed: ${inserted} leads inserted, ${skipped} skipped`));
});

// 3. Bulk Import Customers from Excel
export const importCustomersFromExcel = asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Please upload an Excel (.xlsx/.xls) file");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) throw new ApiError(400, "Uploaded Excel file contains no worksheets");

    const Customer = req.getModel("Customer", customerSchema);
    const rows = [];
    const errors = [];
    let skipped = 0;
    let inserted = 0;

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const name = row.getCell(1).text?.trim();
        const contactPerson = row.getCell(2).text?.trim();
        const designation = row.getCell(3).text?.trim();
        const email = row.getCell(4).text?.trim()?.toLowerCase();
        const phone = row.getCell(5).text?.trim();
        const gstin = row.getCell(6).text?.trim();
        const pan = row.getCell(7).text?.trim();
        const industry = row.getCell(8).text?.trim();
        const tier = row.getCell(9).text?.trim() || "Standard";
        const street = row.getCell(10).text?.trim();
        const city = row.getCell(11).text?.trim();
        const state = row.getCell(12).text?.trim();
        const zipCode = row.getCell(13).text?.trim();
        const annualRevenue = parseFloat(row.getCell(14).text?.replace(/[^0-9.]/g, "")) || 0;
        const notes = row.getCell(15).text?.trim();

        if (!name) {
            skipped++;
            return;
        }

        rows.push({
            rowNumber,
            data: {
                company: req.company._id,
                name,
                contactPerson,
                designation,
                email: email || undefined,
                phone: phone || undefined,
                gstin,
                pan,
                industry,
                tier: ["Platinum", "Gold", "Silver", "Standard"].includes(tier) ? tier : "Standard",
                address: { street, city, state, zipCode, country: "India" },
                annualRevenue,
                notes,
                createdBy: req.user._id
            }
        });
    });

    for (const item of rows) {
        try {
            const duplicate = await Customer.findOne({
                company: req.company._id,
                name: { $regex: new RegExp(`^${item.data.name}$`, "i") }
            });

            if (duplicate) {
                skipped++;
                continue;
            }

            await Customer.create(item.data);
            inserted++;
        } catch (err) {
            errors.push(`Row ${item.rowNumber}: ${err.message}`);
            skipped++;
        }
    }

    return res.status(200).json(new ApiResponse(200, {
        totalRows: rows.length,
        inserted,
        skipped,
        errors
    }, `Import completed: ${inserted} customers inserted, ${skipped} skipped`));
});

// 4. Export Leads to Excel
export const exportLeadsToExcel = asyncHandler(async (req, res) => {
    const Lead = req.getModel("Lead", leadSchema);
    const { status, source, warmth, fromDate, toDate } = req.query;

    const filter = { company: req.company._id };
    if (status && status !== "All") filter.status = status;
    if (source && source !== "All") filter.source = source;
    if (warmth && warmth !== "All") filter.warmth = warmth;
    if (fromDate || toDate) {
        filter.createdAt = {};
        if (fromDate) filter.createdAt.$gte = new Date(fromDate);
        if (toDate) filter.createdAt.$lte = new Date(toDate + "T23:59:59.999Z");
    }

    const leads = await Lead.find(filter).populate("assignedTo", "name email").sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("CRM Leads");

    sheet.columns = [
        { header: "Customer Name", key: "name", width: 25 },
        { header: "Contact Number", key: "phone", width: 18 },
        { header: "Email Address", key: "email", width: 25 },
        { header: "Company", key: "companyName", width: 28 },
        { header: "Address", key: "address", width: 28 },
        { header: "City", key: "city", width: 16 },
        { header: "Pincode", key: "pincode", width: 14 },
        { header: "State", key: "state", width: 16 },
        { header: "Looking For (Requirements)", key: "requirements", width: 35 },
        { header: "Our Product / Service", key: "productInterest", width: 28 },
        { header: "Source", key: "source", width: 18 },
        { header: "Warmth", key: "warmth", width: 14 },
        { header: "Stage", key: "status", width: 18 },
        { header: "Budget Amount (INR)", key: "estimatedValue", width: 20 },
        { header: "Details with Budget", key: "budgetDetails", width: 28 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Created Date", key: "createdAt", width: 18 }
    ];

    leads.forEach(l => {
        sheet.addRow({
            name: l.name,
            phone: l.phone || "-",
            email: l.email || "-",
            companyName: l.companyName || "-",
            address: l.address || "-",
            city: l.city || "-",
            pincode: l.pincode || "-",
            state: l.state || "-",
            requirements: l.requirements || "-",
            productInterest: Array.isArray(l.productInterest) ? l.productInterest.join(", ") : (l.productInterest || "-"),
            source: l.source || "Direct",
            warmth: l.warmth || "Warm",
            status: l.status || "New",
            estimatedValue: l.estimatedValue || 0,
            budgetDetails: l.budgetDetails || l.notes || "-",
            assignedTo: l.assignedTo?.name || "Unassigned",
            createdAt: l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : "-"
        });
    });

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=CRM_Leads_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
});

// 5. Export Customers to Excel
export const exportCustomersToExcel = asyncHandler(async (req, res) => {
    const Customer = req.getModel("Customer", customerSchema);
    const { industry, tier } = req.query;

    const filter = { company: req.company._id };
    if (industry && industry !== "All") filter.industry = industry;
    if (tier && tier !== "All") filter.tier = tier;

    const customers = await Customer.find(filter).populate("assignedAccountManager", "name email").sort({ name: 1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("CRM Customers");

    sheet.columns = [
        { header: "Customer Name", key: "name", width: 30 },
        { header: "Code", key: "customerCode", width: 15 },
        { header: "Contact Person", key: "contactPerson", width: 25 },
        { header: "Email", key: "email", width: 25 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "GSTIN", key: "gstin", width: 20 },
        { header: "Industry", key: "industry", width: 22 },
        { header: "Tier", key: "tier", width: 16 },
        { header: "City", key: "city", width: 18 },
        { header: "State", key: "state", width: 18 },
        { header: "Account Manager", key: "accountManager", width: 22 }
    ];

    customers.forEach(c => {
        sheet.addRow({
            name: c.name,
            customerCode: c.customerCode || "-",
            contactPerson: c.contactPerson || "-",
            email: c.email || "-",
            phone: c.phone || "-",
            gstin: c.gstin || "-",
            industry: c.industry || "-",
            tier: c.tier || "-",
            city: c.address?.city || "-",
            state: c.address?.state || "-",
            accountManager: c.assignedAccountManager?.name || "Unassigned"
        });
    });

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=CRM_Customers_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
});
