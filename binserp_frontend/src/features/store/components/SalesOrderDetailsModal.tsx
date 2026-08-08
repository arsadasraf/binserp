import React from "react";
import { X, Download, ShoppingCart, Calendar, User, Package, FileText, Truck, Building2, Tag, ArrowRight } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SalesOrderDetailsModalProps {
  isOpen: boolean;
  order: any;
  companyInfo?: any;
  customers?: any[];
  onClose: () => void;
  onEdit?: () => void;
}

export const SalesOrderDetailsModal: React.FC<SalesOrderDetailsModalProps> = ({
  isOpen,
  order,
  companyInfo,
  customers = [],
  onClose,
  onEdit
}) => {
  if (!isOpen || !order) return null;

  const orderType = order.orderType || (order.poReference ? "PO_BASED" : "DIRECT");
  const custObj = typeof order.customer === "object" ? order.customer : customers.find(c => (c._id || c.id) === order.customer);
  const custName = custObj?.name || custObj?.customerName || (typeof order.customer === "string" ? order.customer : "Internal Stock Production");
  const custAddress = custObj?.address || custObj?.location || "";
  const custPhone = custObj?.phone || custObj?.contactNumber || "";
  const custEmail = custObj?.email || "";

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();

      const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
      const compAddress = companyInfo?.address || companyInfo?.location || "";
      const compEmail = companyInfo?.email || "";
      const compPhone = companyInfo?.phone || companyInfo?.contactNumber || "";
      const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "";

      // Header Brand bar
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(compName.toUpperCase(), 14, 16);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const compHeaderSub = [compAddress, compPhone && `Ph: ${compPhone}`, compEmail && `Email: ${compEmail}`, compGst && `GSTIN: ${compGst}`].filter(Boolean).join(" | ");
      doc.text(compHeaderSub.substring(0, 110), 14, 22);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("SALES ORDER", 196, 16, { align: "right" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 26, 196, 26);

      // Order Details & Customer Section
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "bold");
      doc.text("SALES ORDER DETAILS", 14, 33);
      doc.text("CUSTOMER / ORDER TYPE", 110, 33);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Order No: ${order.orderNumber || 'N/A'}`, 14, 39);
      doc.text(`Date: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}`, 14, 44);
      doc.text(`Target Date: ${order.targetDate ? new Date(order.targetDate).toLocaleDateString() : ''}`, 14, 49);
      if (order.poReference) {
        doc.text(`PO Ref: ${order.poReference}`, 14, 54);
      }

      doc.setFont("helvetica", "bold");
      doc.text(custName, 110, 39);

      doc.setFont("helvetica", "normal");
      let custLineY = 44;
      if (custAddress) {
        const splitAddr = doc.splitTextToSize(custAddress, 85);
        doc.text(splitAddr, 110, custLineY);
        custLineY += (splitAddr.length * 4);
      }
      const custContact = [custEmail, custPhone].filter(Boolean).join(" | ");
      if (custContact) {
        doc.text(custContact, 110, Math.min(custLineY, 54));
      }

      const tableStartY = Math.max(60, custLineY + 4);

      // Table Data
      const tableData = (order.items || []).map((item: any, idx: number) => {
        const prodName = item.name || item.productName || "FG Item";
        const specText = item.description ? `\n${item.description}` : "";
        const rate = item.pricePerQuantity || item.rate || 0;
        const total = item.totalPrice || item.amount || (item.quantity * rate);
        return [
          idx + 1,
          `${prodName}${specText}`,
          item.quantity || 0,
          item.unit || "PCS",
          `₹${Number(rate).toFixed(2)}`,
          `${item.taxRate || 0}%`,
          `₹${Number(total).toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [["SI.No", "Product & Description", "Qty", "Unit", "Rate", "Tax Rate", "Total Price"]],
        body: tableData,
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8.5,
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        styles: {
          fontSize: 8,
          cellPadding: 3.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 76 },
          2: { cellWidth: 16, halign: 'right' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 18, halign: 'right' },
          6: { cellWidth: 20, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 120;

      // Clean Summary Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(114, finalY + 6, 82, 40, 1.5, 1.5, "FD");

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      doc.text("Items Subtotal:", 118, finalY + 13);
      doc.text(`₹${Number(order.subtotal || order.totalAmount || 0).toFixed(2)}`, 190, finalY + 13, { align: "right" });

      if (Number(order.transportationCharges || 0) > 0) {
        doc.text(`Transportation:`, 118, finalY + 19);
        doc.text(`+ ₹${Number(order.transportationCharges || 0).toFixed(2)}`, 190, finalY + 19, { align: "right" });
      }

      if (Number(order.packagingCharges || 0) > 0) {
        doc.text(`Packaging:`, 118, finalY + 25);
        doc.text(`+ ₹${Number(order.packagingCharges || 0).toFixed(2)}`, 190, finalY + 25, { align: "right" });
      }

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Total Order Amount:", 118, finalY + 38);
      doc.text(`₹${Number(order.totalAmount || 0).toFixed(2)}`, 190, finalY + 38, { align: "right" });

      if (order.remarks) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("REMARKS / INSTRUCTIONS", 14, finalY + 13);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitRemarks = doc.splitTextToSize(order.remarks, 90);
        doc.text(splitRemarks, 14, finalY + 19);
      }

      doc.save(`Sales_Order_${order.orderNumber || Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF generation error", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col my-auto border border-gray-100 dark:border-gray-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <ShoppingCart size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Sales Order #{order.orderNumber}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  orderType === "PO_BASED" 
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" 
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}>
                  {orderType === "PO_BASED" ? "PO-BASED" : "DIRECT / INTERNAL"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Target Date: {order.targetDate ? new Date(order.targetDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <Download size={14} />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-blue-500" />
                Customer / Production Type
              </h4>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{custName}</p>
              {custAddress && <p className="text-xs text-gray-600 dark:text-gray-400">{custAddress}</p>}
              {(custPhone || custEmail) && (
                <p className="text-xs text-gray-500">{[custPhone, custEmail].filter(Boolean).join(" | ")}</p>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-purple-500" />
                Order Metadata
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block">PO Reference:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{order.poReference || "None"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Order Status:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{order.status || "Pending"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Order Date:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Attached Document:</span>
                  {order.pdf ? (
                    <a href={order.pdf} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">View PDF</a>
                  ) : order.photos?.[0] ? (
                    <a href={order.photos[0]} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">View Document</a>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package size={14} className="text-emerald-500" />
              Finished Goods Line Items ({order.items?.length || 0})
            </h4>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Product Name & Description</th>
                    <th className="px-3 py-2 font-semibold text-right">Qty</th>
                    <th className="px-3 py-2 font-semibold text-center">Unit</th>
                    <th className="px-3 py-2 font-semibold text-right">Rate (₹)</th>
                    <th className="px-3 py-2 font-semibold text-right">Tax %</th>
                    <th className="px-3 py-2 font-semibold text-right">Total Price (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(order.items || []).map((item: any, idx: number) => {
                    const prodName = item.name || item.productName || "FG Item";
                    const rate = item.pricePerQuantity || item.rate || 0;
                    const total = item.totalPrice || item.amount || (item.quantity * rate);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-800 dark:text-gray-200">{prodName}</div>
                          {item.description && <div className="text-[11px] text-gray-500">{item.description}</div>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{item.unit || "PCS"}</td>
                        <td className="px-3 py-2 text-right">₹{Number(rate).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{item.taxRate || 0}%</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">
                          ₹{Number(total).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Items Subtotal:</span>
                <span>₹{Number(order.subtotal || order.totalAmount || 0).toFixed(2)}</span>
              </div>
              {Number(order.transportationCharges || 0) > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Transportation ({order.transportationType || 'Road'}):</span>
                  <span>+ ₹{Number(order.transportationCharges).toFixed(2)}</span>
                </div>
              )}
              {Number(order.packagingCharges || 0) > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Packaging ({order.packagingType || 'Standard'}):</span>
                  <span>+ ₹{Number(order.packagingCharges).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-sm text-gray-900 dark:text-white">
                <span>Total Order Amount:</span>
                <span className="text-blue-600 dark:text-blue-400">₹{Number(order.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
          <div>
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Edit Order
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
