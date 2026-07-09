import ExcelJS from 'exceljs';

export const generateExcel = async (data, type) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Binserp ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(type);

    if (type === 'Delivery Challans') {
        const isSingleReceipt = data.length === 1 && data[0].doc;
        
        if (isSingleReceipt) {
            const payload = data[0];
            const dc = payload.doc;
            const companyInfo = payload.companyInfo || {};
            
            sheet.getColumn(1).width = 5;
            sheet.getColumn(2).width = 40;
            sheet.getColumn(3).width = 15;
            sheet.getColumn(4).width = 10;
            sheet.getColumn(5).width = 10;
            sheet.getColumn(6).width = 25;

            const addBorders = (cell) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            };

            // Top Header
            sheet.mergeCells('A1:F1');
            const h1 = sheet.getCell('A1');
            h1.value = companyInfo.companyName || 'COMPANY NAME';
            h1.font = { bold: true, size: 16 };
            h1.alignment = { horizontal: 'center' };
            
            sheet.mergeCells('A2:F2');
            const h2 = sheet.getCell('A2');
            h2.value = `${companyInfo.billingAddress || companyInfo.address || ''}\nPh: ${companyInfo.contactNumber || ''} | Email: ${companyInfo.email || ''}`;
            h2.alignment = { horizontal: 'center', wrapText: true };
            sheet.getRow(2).height = 30;
            
            sheet.mergeCells('A3:F3');
            const h3 = sheet.getCell('A3');
            h3.value = 'DELIVERY CHALLAN';
            h3.font = { bold: true, size: 12 };
            h3.alignment = { horizontal: 'center' };
            h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
            h3.border = { top: {style:'medium'}, bottom: {style:'medium'}, left: {style:'thin'}, right: {style:'thin'} };

            // TO section
            sheet.mergeCells('A4:D4');
            sheet.getCell('A4').value = 'SHIP TO:';
            sheet.getCell('A4').font = { bold: true };
            sheet.mergeCells('A5:D5');
            sheet.getCell('A5').value = `M/S ${dc.customerName || dc.customer?.name || 'N/A'}`;
            sheet.getCell('A5').font = { bold: true };
            sheet.mergeCells('A6:D7');
            sheet.getCell('A6').value = dc.customerAddress || dc.customer?.address || '';
            sheet.getCell('A6').alignment = { vertical: 'top', wrapText: true };
            
            // Right details
            sheet.mergeCells('E4:E5');
            sheet.getCell('E4').value = 'DC NO:';
            sheet.getCell('E4').font = { bold: true };
            sheet.getCell('E4').alignment = { vertical: 'middle' };
            sheet.getCell('F4').value = dc.dcNumber;
            sheet.getCell('F4').font = { bold: true };
            
            sheet.mergeCells('E6:E7');
            sheet.getCell('E6').value = 'Date:';
            sheet.getCell('E6').alignment = { vertical: 'middle' };
            sheet.getCell('F6').value = new Date(dc.date || Date.now()).toLocaleDateString('en-GB');

            // Borders for header
            ['A1','A2','A4','A5','A6','E4','F4','E6','F6'].forEach(r => {
                const cell = sheet.getCell(r);
                cell.border = { ...cell.border, left: {style:'thin'}, right: {style:'thin'} };
            });
            ['A7','B7','C7','D7','E7','F7'].forEach(cellId => {
                const cell = sheet.getCell(cellId);
                cell.border = { ...cell.border, bottom: {style:'medium'} };
            });

            // Table headers
            const headerRow = sheet.addRow(['Sl. No', 'Material', 'HSN', 'Qty', 'Unit', 'Remarks']);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                addBorders(cell);
                cell.border.bottom = {style:'medium'};
            });

            // Items
            let totalQty = 0;
            let lastRowIdx = 8;
            if (dc.items && dc.items.length > 0) {
                dc.items.forEach((item, index) => {
                    totalQty += (item.quantity || 0);
                    const row = sheet.addRow([
                        index + 1,
                        item.materialName || '',
                        item.hsnCode || '-',
                        item.quantity || 0,
                        item.unit || '-',
                        item.description || '-'
                    ]);
                    row.eachCell((cell, colNumber) => {
                        cell.alignment = { vertical: 'top', horizontal: [1,3,4,5].includes(colNumber) ? 'center' : 'left', wrapText: true };
                        cell.border = { right: {style: 'thin'} };
                    });
                    lastRowIdx++;
                });
                for(let i = dc.items.length; i < 15; i++) {
                    const row = sheet.addRow(['','','','','','']);
                    row.height = 20;
                    row.eachCell((cell) => { cell.border = { right: {style: 'thin'} }; });
                    lastRowIdx++;
                }
            } else {
                const row = sheet.addRow(['','No Items','','','','']);
                row.height = 50;
                row.eachCell((cell) => { cell.border = { right: {style: 'thin'} }; cell.alignment = { vertical: 'middle', horizontal: 'center' } });
                lastRowIdx++;
            }

            // Totals
            const totalRow = sheet.addRow(['', 'Total Qty =', '', totalQty, '', '']);
            totalRow.font = { bold: true };
            totalRow.eachCell((cell, colNumber) => {
                cell.border = { top: {style:'medium'}, bottom: {style:'medium'}, right: {style:'thin'} };
                cell.alignment = { horizontal: colNumber === 4 ? 'center' : 'right' };
            });
            lastRowIdx++;

            // Footer / Remarks
            if (dc.otherDetails) {
                const remRow = sheet.addRow([]);
                sheet.mergeCells(`A${lastRowIdx+1}:F${lastRowIdx+1}`);
                const remCell = sheet.getCell(`A${lastRowIdx+1}`);
                remCell.value = `Remarks: ${dc.otherDetails}`;
                remCell.border = { bottom: {style:'medium'} };
                lastRowIdx++;
            }

            // Signatures Row
            const sigRow = sheet.addRow([]);
            sigRow.height = 80;
            sheet.mergeCells(`A${lastRowIdx+1}:C${lastRowIdx+1}`);
            const sigLeft = sheet.getCell(`A${lastRowIdx+1}`);
            if (companyInfo.commercialTerms) {
                sigLeft.value = `Terms & Conditions:\n${companyInfo.commercialTerms}`;
            }
            sigLeft.alignment = { vertical: 'top', wrapText: true };
            
            sheet.mergeCells(`D${lastRowIdx+1}:F${lastRowIdx+1}`);
            const sigRight = sheet.getCell(`D${lastRowIdx+1}`);
            sigRight.value = `For ${companyInfo.companyName || 'COMPANY NAME'}\n\n\n\nAuthorised Signatory`;
            sigRight.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };
            
            [sigLeft, sigRight].forEach(cell => { cell.border = { left: {style:'thin'}, right: {style:'thin'} }; });
            lastRowIdx++;

            // Outer box
            for(let i=1; i<=lastRowIdx; i++) {
                const leftCell = sheet.getCell(`A${i}`);
                leftCell.border = { ...leftCell.border, left: {style:'medium'} };
                const rightCell = sheet.getCell(`F${i}`);
                rightCell.border = { ...rightCell.border, right: {style:'medium'} };
            }
            for(let j=1; j<=6; j++) {
                const colLtr = String.fromCharCode(64 + j);
                const topCell = sheet.getCell(`${colLtr}1`);
                topCell.border = { ...topCell.border, top: {style:'medium'} };
                const btmCell = sheet.getCell(`${colLtr}${lastRowIdx}`);
                btmCell.border = { ...btmCell.border, bottom: {style:'medium'} };
            }

            return await workbook.xlsx.writeBuffer();
        }

        // --- Original Summary Table formatting for List Exports ---
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
        const payload = data[0] || {};
        // Support both old and new payload structures
        const challan = payload.doc ? payload.doc : payload;
        const companyInfo = payload.companyInfo || {};
        
        sheet.getColumn(1).width = 5;
        sheet.getColumn(2).width = 30;
        sheet.getColumn(3).width = 12;
        sheet.getColumn(4).width = 30;
        sheet.getColumn(5).width = 12;
        sheet.getColumn(6).width = 12;
        sheet.getColumn(7).width = 25;

        // Apply borders helper
        const addBorders = (cell) => {
            cell.border = {
                top: {style:'thin'},
                left: {style:'thin'},
                bottom: {style:'thin'},
                right: {style:'thin'}
            };
        };

        // Top Header
        sheet.mergeCells('A1:G1');
        const h1 = sheet.getCell('A1');
        h1.value = companyInfo.companyName || 'COMPANY NAME';
        h1.font = { bold: true, size: 16 };
        h1.alignment = { horizontal: 'center' };
        
        sheet.mergeCells('A2:G2');
        const h2 = sheet.getCell('A2');
        h2.value = `${companyInfo.billingAddress || companyInfo.address || ''}\nPh: ${companyInfo.contactNumber || ''} | Email: ${companyInfo.email || ''}`;
        h2.alignment = { horizontal: 'center', wrapText: true };
        sheet.getRow(2).height = 30;
        
        sheet.mergeCells('A3:G3');
        const h3 = sheet.getCell('A3');
        h3.value = 'RETURNABLE - DELIVERY CHALLAN';
        h3.font = { bold: true, size: 12 };
        h3.alignment = { horizontal: 'center' };
        h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        h3.border = { top: {style:'medium'}, bottom: {style:'medium'}, left: {style:'thin'}, right: {style:'thin'} };

        // TO section & Details section
        sheet.mergeCells('A4:D4');
        sheet.getCell('A4').value = 'TO,';
        sheet.getCell('A4').font = { bold: true };
        sheet.mergeCells('A5:D5');
        sheet.getCell('A5').value = `M/S ${challan.vendorName || challan.vendor?.name || 'N/A'}`;
        sheet.getCell('A5').font = { bold: true };
        sheet.mergeCells('A6:D8');
        sheet.getCell('A6').value = `${challan.vendor?.address || ''}\n${challan.vendor?.city || ''} ${challan.vendor?.pincode ? '-' + challan.vendor?.pincode : ''}`;
        sheet.getCell('A6').alignment = { vertical: 'top', wrapText: true };
        
        // Right details
        sheet.mergeCells('E4:F4');
        sheet.getCell('E4').value = 'DC NO:';
        sheet.getCell('E4').font = { bold: true };
        sheet.getCell('G4').value = challan.challanNumber;
        sheet.getCell('G4').font = { bold: true };

        sheet.mergeCells('E5:F5');
        sheet.getCell('E5').value = 'Date:';
        sheet.getCell('G5').value = new Date(challan.date || Date.now()).toLocaleDateString('en-GB');

        sheet.mergeCells('E6:F6');
        sheet.getCell('E6').value = 'Our PO No:';
        sheet.getCell('G6').value = challan.poNumber || '';

        sheet.mergeCells('E7:F7');
        sheet.getCell('E7').value = 'Estimated Price:';
        sheet.getCell('G7').value = challan.estimatedPrice || '';
        
        sheet.mergeCells('E8:F8');
        sheet.getCell('E8').value = 'Vehicle No:';
        sheet.getCell('G8').value = challan.vehicleNo || '';

        // Add some borders around header
        ['A1','A2','A4','A5','A6','E4','G4','E5','G5','E6','G6','E7','G7','E8','G8'].forEach(r => {
            const rowStr = r.replace(/[A-Z]/g, '');
            const colStr = r.replace(/[0-9]/g, '');
            const cell = sheet.getCell(r);
            cell.border = { ...cell.border, left: {style:'thin'}, right: {style:'thin'} };
        });
        
        // Bottom border for address block
        ['A8','B8','C8','D8','E8','F8','G8'].forEach(cellId => {
            const cell = sheet.getCell(cellId);
            cell.border = { ...cell.border, bottom: {style:'medium'} };
        });

        // Table headers
        const headerRow = sheet.addRow(['Sl. No', 'Items Sent', 'Qty', 'Items to be Received', 'Qty', 'Unit Price', 'Remarks']);
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            addBorders(cell);
            cell.border.bottom = {style:'medium'};
        });
        sheet.getRow(9).height = 30;

        // Items
        let totalQty = 0;
        let lastRowIdx = 9;
        if (challan && challan.items && challan.items.length > 0) {
            challan.items.forEach((item, index) => {
                totalQty += (item.quantitySent || 0);
                const row = sheet.addRow([
                    index + 1,
                    item.itemName || (item.item ? item.item.name : '') || '',
                    `${item.quantitySent} ${item.unit || 'Nos'}`,
                    item.itemToBeReceived || item.itemName || (item.item ? item.item.name : '') || '',
                    `${item.quantitySent} ${item.unit || 'Nos'}`,
                    item.unitPrice || '',
                    item.description || ''
                ]);
                row.eachCell((cell, colNumber) => {
                    cell.alignment = { vertical: 'top', horizontal: [3,5].includes(colNumber) ? 'center' : 'left', wrapText: true };
                    cell.border = { right: {style: 'thin'} };
                });
                lastRowIdx++;
            });
            
            // Pad rows
            for(let i = challan.items.length; i < 5; i++) {
                const row = sheet.addRow(['','','','','','','']);
                row.height = 20;
                row.eachCell((cell) => { cell.border = { right: {style: 'thin'} }; });
                lastRowIdx++;
            }
        } else {
            const row = sheet.addRow(['','No Items','','','','','']);
            row.height = 50;
            row.eachCell((cell) => { cell.border = { right: {style: 'thin'} }; cell.alignment = { vertical: 'middle', horizontal: 'center' } });
            lastRowIdx++;
        }

        // Totals
        const totalRow = sheet.addRow(['', 'Total Qty =', totalQty, 'Total Qty =', totalQty, '', '']);
        totalRow.font = { bold: true };
        totalRow.eachCell((cell, colNumber) => {
            cell.border = { top: {style:'medium'}, bottom: {style:'medium'}, right: {style:'thin'} };
            cell.alignment = { horizontal: [2,4].includes(colNumber) ? 'right' : 'center' };
        });
        lastRowIdx++;

        // Footer Transport Row
        const tfRow = sheet.addRow([]);
        tfRow.height = 30;
        sheet.mergeCells(`A${lastRowIdx+1}:C${lastRowIdx+1}`);
        sheet.getCell(`A${lastRowIdx+1}`).value = `The above materials sent\nDate: ${new Date(challan.date || Date.now()).toLocaleDateString('en-GB')}`;
        sheet.mergeCells(`D${lastRowIdx+1}:E${lastRowIdx+1}`);
        sheet.getCell(`D${lastRowIdx+1}`).value = `Freight to pay/Paid\n${challan.freightType || ''}`;
        sheet.mergeCells(`F${lastRowIdx+1}:G${lastRowIdx+1}`);
        sheet.getCell(`F${lastRowIdx+1}`).value = `LR/NR\n${challan.lrNr || ''}`;
        
        tfRow.eachCell((cell) => { 
            cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
            cell.border = { bottom: {style:'thin'}, right: {style:'thin'}, left: {style:'thin'} }; 
        });
        lastRowIdx++;

        // Note row
        const noteRow = sheet.addRow([]);
        noteRow.height = 40;
        sheet.mergeCells(`A${lastRowIdx+1}:G${lastRowIdx+1}`);
        const noteCell = sheet.getCell(`A${lastRowIdx+1}`);
        noteCell.value = `Note:\nPlease arrange to return the material back to us before ${challan.expectedReturnDate ? new Date(challan.expectedReturnDate).toLocaleDateString('en-GB') : '___________'} and while returning the material please quote this challan reference on your delivery challan invariably, failing which payment will be delayed.`;
        noteCell.font = { size: 9 };
        noteCell.alignment = { vertical: 'top', wrapText: true };
        noteCell.border = { bottom: {style:'thin'}, right: {style:'thin'}, left: {style:'thin'} };
        lastRowIdx++;

        // Signatures Row
        const sigRow = sheet.addRow([]);
        sigRow.height = 70;
        sheet.mergeCells(`A${lastRowIdx+1}:D${lastRowIdx+1}`);
        const sigLeft = sheet.getCell(`A${lastRowIdx+1}`);
        sigLeft.value = `Our GST No : ${companyInfo.gstNumber || ''}\nOur PAN No : ${companyInfo.panNumber || ''}\nParty's GST No : ${challan.vendor?.gst || ''}\nParty's PAN No : ${challan.vendor?.pan || ''}`;
        sigLeft.alignment = { vertical: 'top', wrapText: true };
        
        sheet.mergeCells(`E${lastRowIdx+1}:G${lastRowIdx+1}`);
        const sigRight = sheet.getCell(`E${lastRowIdx+1}`);
        sigRight.value = `E-Sugam No: ${challan.eSugamNo || ''}\nDate: ${challan.eSugamDate ? new Date(challan.eSugamDate).toLocaleDateString('en-GB') : ''}\n\nFor ${companyInfo.companyName || 'COMPANY NAME'}\n\nAuthorised Signatory`;
        sigRight.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };
        
        [sigLeft, sigRight].forEach(cell => { cell.border = { left: {style:'thin'}, right: {style:'thin'}, bottom: {style:'medium'} }; });
        lastRowIdx++;
        
        // Part II
        sheet.mergeCells(`A${lastRowIdx+1}:G${lastRowIdx+1}`);
        const p2Title = sheet.getCell(`A${lastRowIdx+1}`);
        p2Title.value = 'PART II (to be filled by the Supplier)';
        p2Title.font = { bold: true };
        p2Title.alignment = { horizontal: 'center' };
        p2Title.border = { bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
        lastRowIdx++;

        const p2HeadRow = sheet.addRow(['Party\'s DC / Inv No. & Date', '', 'Qty Returned', '', 'Waste (if any) Returned', '', 'Authorised Signatory']);
        sheet.mergeCells(`A${lastRowIdx+1}:B${lastRowIdx+1}`);
        sheet.mergeCells(`C${lastRowIdx+1}:D${lastRowIdx+1}`);
        sheet.mergeCells(`E${lastRowIdx+1}:F${lastRowIdx+1}`);
        p2HeadRow.eachCell((cell) => { 
            cell.border = { bottom: {style:'thin'}, right: {style:'thin'}, left: {style:'thin'} }; 
            cell.alignment = { horizontal: 'center' };
        });
        lastRowIdx++;

        const p2ValRow = sheet.addRow(['', '', '', '', '', '', '']);
        p2ValRow.height = 30;
        sheet.mergeCells(`A${lastRowIdx+1}:B${lastRowIdx+1}`);
        sheet.mergeCells(`C${lastRowIdx+1}:D${lastRowIdx+1}`);
        sheet.mergeCells(`E${lastRowIdx+1}:F${lastRowIdx+1}`);
        p2ValRow.eachCell((cell) => { 
            cell.border = { bottom: {style:'thin'}, right: {style:'thin'}, left: {style:'thin'} }; 
        });
        
        // Put outer box around the whole thing
        for(let i=1; i<=lastRowIdx+1; i++) {
            const leftCell = sheet.getCell(`A${i}`);
            leftCell.border = { ...leftCell.border, left: {style:'medium'} };
            const rightCell = sheet.getCell(`G${i}`);
            rightCell.border = { ...rightCell.border, right: {style:'medium'} };
        }
        for(let j=1; j<=7; j++) {
            const colLtr = String.fromCharCode(64 + j);
            const topCell = sheet.getCell(`${colLtr}1`);
            topCell.border = { ...topCell.border, top: {style:'medium'} };
            const btmCell = sheet.getCell(`${colLtr}${lastRowIdx+1}`);
            btmCell.border = { ...btmCell.border, bottom: {style:'medium'} };
        }

        // Skip default header formatting for this type
        return await workbook.xlsx.writeBuffer();
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
