export function generateMaterialRequestReportPDF(
  records: any[],
  filterInfo?: {
    type?: string;
    status?: string;
    department?: string;
    userName?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to preview and print Material Request Report");
    return;
  }

  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalRequests = records.length;
  const totalItems = records.reduce((acc, r) => acc + (r.items?.length || 0), 0);
  const totalQty = records.reduce((acc, r) => {
    return acc + (r.items || []).reduce((iAcc: number, item: any) => iAcc + (Number(item.quantity) || 0), 0);
  }, 0);

  let rowsHtml = "";
  records.forEach((req, idx) => {
    const reqDate = req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
    const requester = req.requestedBy?.name || req.createdByName || "User";
    const dept = req.department || req.requestedBy?.department || "General";
    const status = req.status || "Pending";
    const type = (req.type || "rm").toUpperCase();
    const issuer = req.issuedByName || req.issuedBy?.name || "-";
    const issueDate = req.issuedAt ? new Date(req.issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-";

    (req.items || []).forEach((item: any, iIdx: number) => {
      const isFirst = iIdx === 0;
      const rowSpan = req.items?.length || 1;

      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0; ${isFirst ? 'background: #fafafa;' : ''}">
          ${isFirst ? `
            <td rowspan="${rowSpan}" style="padding: 6px 8px; text-align: center; font-size: 10px; font-weight: bold; border-right: 1px solid #e2e8f0;">${idx + 1}</td>
            <td rowspan="${rowSpan}" style="padding: 6px 8px; font-size: 10px; font-family: monospace; font-weight: bold; color: #1e3a8a; border-right: 1px solid #e2e8f0;">${req.requestNumber}</td>
            <td rowspan="${rowSpan}" style="padding: 6px 8px; text-align: center; font-size: 10px; border-right: 1px solid #e2e8f0;">${reqDate}</td>
            <td rowspan="${rowSpan}" style="padding: 6px 8px; text-align: center; font-size: 10px; font-weight: 700; border-right: 1px solid #e2e8f0;">${type}</td>
            <td rowspan="${rowSpan}" style="padding: 6px 8px; font-size: 10px; border-right: 1px solid #e2e8f0;">
              <strong>${requester}</strong><br/>
              <span style="font-size: 9px; color: #64748b;">${dept}</span>
            </td>
          ` : ''}
          <td style="padding: 6px 8px; font-size: 10px; border-right: 1px solid #e2e8f0;">
            <strong>${item.materialName || item.name}</strong>
            ${(item.materialDescription || item.description || item.specification) ? `<br/><span style="font-size: 9px; color: #64748b;">${item.materialDescription || item.description || item.specification}</span>` : ''}
            ${item.purpose ? `<br/><span style="font-size: 9px; color: #475569; font-style: italic;">Purpose: ${item.purpose}</span>` : ''}
          </td>
          <td style="padding: 6px 8px; text-align: center; font-size: 10px; font-weight: bold; border-right: 1px solid #e2e8f0;">
            ${item.quantity} <span style="font-size: 9px; color: #64748b; font-weight: normal;">${item.unit || "PCS"}</span>
          </td>
          ${isFirst ? `
            <td rowspan="${rowSpan}" style="padding: 6px 8px; text-align: center; font-size: 10px; border-right: 1px solid #e2e8f0;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; ${
                status === 'Issued' ? 'background: #dcfce7; color: #166534;' :
                status === 'Approved' ? 'background: #e0e7ff; color: #3730a3;' :
                status === 'Rejected' ? 'background: #fee2e2; color: #991b1b;' :
                'background: #fef3c7; color: #92400e;'
              }">${status}</span>
            </td>
            <td rowspan="${rowSpan}" style="padding: 6px 8px; font-size: 9px; text-align: center;">
              ${status === 'Issued' ? `<strong>${issuer}</strong><br/><span style="color: #64748b;">${issueDate}</span>` : '-'}
            </td>
          ` : ''}
        </tr>
      `;
    });
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Material_Request_Ledger_Report</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
        table { border-collapse: collapse; width: 100%; }
        .no-print { display: block; }
        @media print {
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body style="padding: 12px;">
      <!-- Action Toolbar (Hidden in Print) -->
      <div class="no-print" style="position: fixed; top: 12px; right: 16px; z-index: 9999; background: #0f172a; color: #fff; padding: 8px 16px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 13px; font-weight: bold; display: flex; gap: 10px; align-items: center;">
        <span>Material Request Ledger (${totalRequests} Requests)</span>
        <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">Print / Save as PDF</button>
        <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">Close</button>
      </div>

      <!-- Report Header -->
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px;">MATERIAL REQUISITION & CONSUMPTION LEDGER</h1>
          <p style="margin: 3px 0 0; font-size: 11px; color: #475569;">Detailed department-wise material requisition log, item breakdown & issue fulfillment history</p>
        </div>
        <div style="text-align: right; font-size: 10px; color: #64748b;">
          <div>Generated: <strong>${generatedDate}</strong></div>
          ${filterInfo?.startDate || filterInfo?.endDate ? `<div>Period: <strong>${filterInfo.startDate || 'Start'}</strong> to <strong>${filterInfo.endDate || 'Present'}</strong></div>` : ''}
          ${filterInfo?.type && filterInfo.type !== 'All' ? `<div>Type Filter: <strong>${filterInfo.type.toUpperCase()}</strong></div>` : ''}
        </div>
      </div>

      <!-- Summary KPI Box -->
      <div style="display: flex; gap: 12px; margin-bottom: 14px;">
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Requisitions</div>
          <div style="font-size: 16px; font-weight: 800; color: #1e3a8a;">${totalRequests}</div>
        </div>
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Line Items</div>
          <div style="font-size: 16px; font-weight: 800; color: #0284c7;">${totalItems}</div>
        </div>
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Units Requested</div>
          <div style="font-size: 16px; font-weight: 800; color: #16a34a;">${totalQty.toLocaleString()}</div>
        </div>
      </div>

      <!-- Main Ledger Table -->
      <table style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; width: 100%;">
        <thead style="background: #1e3a8a; color: #fff;">
          <tr>
            <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 4%;">#</th>
            <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: left; width: 12%;">Req #</th>
            <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 9%;">Date</th>
            <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 7%;">Type</th>
            <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: left; width: 16%;">Requester / Dept</th>
            <th style="padding: 7px 8px; font-size: 10px; font-weight: 800; text-align: left; width: 28%;">Item Description & Spec</th>
            <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 8%;">Req Qty</th>
            <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 8%;">Status</th>
            <th style="padding: 7px 6px; font-size: 10px; font-weight: 800; text-align: center; width: 8%;">Issued By / Date</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="9" style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">No material requests found matching the selected criteria.</td></tr>`}
        </tbody>
      </table>
    </body>
    </html>
  `);

  printWindow.document.close();
}
