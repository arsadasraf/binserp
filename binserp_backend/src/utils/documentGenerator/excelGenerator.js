import ExcelJS from 'exceljs';

export const generateExcel = async (data, type) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Binserp ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(type);

    if (type === 'Delivery Challans') {
        sheet.columns = [
            { header: 'DC Number', key: 'dcNumber', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Customer', key: 'customerName', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Items Count', key: 'itemsCount', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 30 }
        ];

        data.forEach(item => {
            sheet.addRow({
                dcNumber: item.dcNumber,
                date: new Date(item.date).toLocaleDateString(),
                customerName: item.customerName || item.customer?.name || 'N/A',
                status: item.status,
                itemsCount: item.items?.length || 0,
                remarks: item.otherDetails || ''
            });
        });
    } else if (type === 'Invoices') {
        sheet.columns = [
            { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Customer', key: 'customerName', width: 30 },
            { header: 'Subtotal', key: 'subtotal', width: 15 },
            { header: 'Tax', key: 'taxAmount', width: 15 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Items Count', key: 'itemsCount', width: 15 }
        ];

        data.forEach(item => {
            sheet.addRow({
                invoiceNumber: item.invoiceNumber,
                date: new Date(item.date).toLocaleDateString(),
                customerName: item.customerName || item.customer?.name || 'N/A',
                subtotal: item.subtotal,
                taxAmount: item.taxAmount,
                totalAmount: item.totalAmount,
                status: item.status,
                itemsCount: item.items?.length || 0
            });
        });
    } else if (type === 'InHouse Inventory') {
        sheet.columns = [
            { header: 'Item Name', key: 'itemName', width: 30 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Stock Quantity', key: 'stock', width: 15 },
            { header: 'Location', key: 'location', width: 20 },
            { header: 'Category', key: 'category', width: 20 }
        ];

        data.forEach(item => {
            sheet.addRow({
                itemName: item.componentName || item.name || '',
                description: item.description || '',
                stock: item.quantity || 0,
                location: item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : 'N/A'),
                category: item.category?.name || item.categoryId?.name || (typeof item.category === 'string' ? item.category : 'N/A')
            });
        });
    } else if (type === 'Returnable DC') {
        const challan = data[0];
        sheet.columns = [
            { header: 'Challan Number', key: 'challanNumber', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Supplier', key: 'supplier', width: 30 },
            { header: 'Item Name', key: 'itemName', width: 30 },
            { header: 'Process Type', key: 'processType', width: 20 },
            { header: 'Qty Sent', key: 'qtySent', width: 15 },
            { header: 'Unit', key: 'unit', width: 15 }
        ];

        if (challan && challan.items) {
            challan.items.forEach(item => {
                sheet.addRow({
                    challanNumber: challan.challanNumber,
                    date: new Date(challan.date).toLocaleDateString(),
                    supplier: challan.vendorName || challan.vendor?.name || 'N/A',
                    itemName: item.itemName || '-',
                    processType: item.processType || '-',
                    qtySent: item.quantitySent,
                    unit: item.unit || 'PCS'
                });
            });
        }
    }

    // Style headers
    sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' } // Indigo 600
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    return await workbook.xlsx.writeBuffer();
};
