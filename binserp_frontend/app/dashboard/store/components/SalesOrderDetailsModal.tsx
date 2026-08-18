import React, { useState } from "react";
import { X, Download, ShoppingCart, Calendar, User, Package, FileText, Truck, Building2, Tag, ArrowRight, GitBranch, Sparkles, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
import { API_BASE_URL } from "@/src/utils/config";

interface SalesOrderDetailsModalProps {
  isOpen: boolean;
  order: any;
  companyInfo?: any;
  customers?: any[];
  onClose: () => void;
  onEdit?: () => void;
  onOpenMrp?: (order: any) => void;
}

export const SalesOrderDetailsModal: React.FC<SalesOrderDetailsModalProps> = ({
  isOpen,
  order,
  companyInfo,
  customers = [],
  onClose,
  onEdit,
  onOpenMrp
}) => {
  if (!isOpen || !order) return null;

  const orderType = order.orderType || (order.poReference ? "PO_BASED" : "DIRECT");
  const custObj = typeof order.customer === "object" ? order.customer : customers.find(c => (c._id || c.id) === order.customer);
  const custName = custObj?.name || custObj?.customerName || (typeof order.customer === "string" ? order.customer : "Internal Stock Production");
  const custAddress = custObj?.address || custObj?.location || "";
  const custPhone = custObj?.phone || custObj?.contactNumber || "";
  const custEmail = custObj?.email || "";

  const [reserving, setReserving] = useState(false);
  const [allocatingItemFgId, setAllocatingItemFgId] = useState<string | null>(null);

  const handleReserveStock = async () => {
    setReserving(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/sales/order/${order._id}/move-to-mrp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid response from server.");
      }

      if (res.ok && data.success) {
        Swal.fire("Stock Reserved!", data.message, "success");
        onClose();
        if (typeof window !== "undefined") window.location.reload();
      } else {
        Swal.fire("Error", data.message || "Failed to reserve stock.", "error");
      }
    } catch (err: any) {
      Swal.fire("Error", err.message || "Failed to reserve stock.", "error");
    } finally {
      setReserving(false);
    }
  };

  const handleAllocateFGItem = async (fgItemId: string, maxAvailable: number, orderUnfilled: number) => {
    const defaultQty = Math.min(maxAvailable, orderUnfilled);
    const { value: qtyStr } = await Swal.fire({
      title: "Reserve Finished Goods Stock",
      text: `Enter quantity to reserve for Sales Order #${order.orderNumber} (Available Store Stock: ${maxAvailable} PCS, Needed: ${orderUnfilled} PCS):`,
      input: "number",
      inputValue: defaultQty,
      showCancelButton: true,
      inputValidator: (val) => {
        const n = Number(val);
        if (!n || n <= 0) return "Please enter a valid positive quantity!";
        if (n > maxAvailable) return `Cannot allocate more than available stock (${maxAvailable} PCS)!`;
        return null;
      }
    });

    if (!qtyStr) return;

    const allocateQty = Number(qtyStr);
    setAllocatingItemFgId(fgItemId);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/store/fg/allocate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          salesOrderId: order._id,
          fgItemId,
          allocateQty,
          action: "allocate"
        })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("Stock Reserved!", data.message, "success");
        onClose();
        if (typeof window !== "undefined") window.location.reload();
      } else {
        Swal.fire("Allocation Failed", data.message, "error");
      }
    } catch (err: any) {
      console.error("Allocation error:", err);
      Swal.fire("Error", "Failed to reserve FG stock.", "error");
    } finally {
      setAllocatingItemFgId(null);
    }
  };

  const currentStatus = order.status || order.fulfillmentStatus || "Pending";

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Items Allocated":
      case "Fully Allocated":
        return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300";
      case "Moved to MRP":
      case "Moved MRP":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300";
      case "Completed":
      case "Dispatched":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300";
      case "In-Progress":
      case "Partially Dispatched":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300";
    }
  };

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
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/30">
              <ShoppingCart size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Sales Order #{order.orderNumber}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getStatusBadgeClass(currentStatus)}`}>
                  {currentStatus}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  orderType === "PO_BASED" 
                    ? "bg-purple-900/50 text-purple-200 border border-purple-700" 
                    : "bg-blue-900/50 text-blue-200 border border-blue-700"
                }`}>
                  {orderType === "PO_BASED" ? "PO-BASED" : "DIRECT"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Target Date: {order.targetDate ? new Date(order.targetDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenMrp && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMrp(order);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
                title="Move Order to Purchase MRP for FG Stock Allocation & BOM Explosion"
              >
                <GitBranch size={14} /> Move to Purchase MRP
              </button>
            )}

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
            >
              <Download size={14} />
              PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
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
                  <span className="text-gray-500 block">Lifecycle Status:</span>
                  <span className={`font-bold text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 border ${getStatusBadgeClass(currentStatus)}`}>
                    {currentStatus}
                  </span>
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

          {/* Stock Availability & Allocation Summary Cards */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-indigo-600" />
                Finished Goods Stock Availability & Allocation Phase
              </h4>
              {onOpenMrp && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenMrp(order);
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  <GitBranch size={13} /> Check & Move to Purchase MRP
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(order.items || []).map((item: any, idx: number) => {
                const fgObj = typeof item.fgItem === 'object' ? item.fgItem : {};
                const fgId = fgObj._id || item.fgItem;
                const currentStock = Number(fgObj.quantity || 0);
                const currentAllocated = Number(fgObj.allocatedQuantity || 0);
                const unreservedStock = Math.max(0, currentStock - currentAllocated);
                const orderedQty = Number(item.quantity || 0);
                const allocatedQty = Number(item.allocatedFgQty || 0);
                const shortage = Math.max(0, orderedQty - allocatedQty);

                return (
                  <div key={idx} className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-indigo-100 dark:border-gray-800 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-gray-900 dark:text-white text-sm">{item.name || item.productName || fgObj.name}</p>
                      <div className="flex flex-wrap gap-2.5 text-gray-600 dark:text-gray-300">
                        <span>SO Needed: <b className="font-mono text-gray-900 dark:text-white">{orderedQty} PCS</b></span>
                        <span>Allocated: <b className="font-mono text-amber-600">{allocatedQty} PCS</b></span>
                        <span>Shortage: <b className="font-mono text-rose-600">{shortage} PCS</b></span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold rounded-lg text-[11px]">
                        Store Stock: {unreservedStock} PCS
                      </span>

                      {allocatedQty >= orderedQty ? (
                        <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 rounded-lg font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 size={13} /> Fully Covered
                        </span>
                      ) : unreservedStock > 0 ? (
                        <button
                          onClick={() => handleAllocateFGItem(fgId, unreservedStock, shortage)}
                          disabled={allocatingItemFgId === fgId}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1"
                          title={`Reserve up to ${Math.min(unreservedStock, shortage)} PCS for this item`}
                        >
                          <Sparkles size={13} /> Reserve {Math.min(unreservedStock, shortage)} PCS
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 rounded-lg font-bold text-[10px]">
                          No Store Stock
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
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
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReserveStock}
              disabled={reserving}
              className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <ShieldCheck size={14} />
              {reserving ? "Reserving..." : "Reserve Available Stock"}
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Edit Order
              </button>
            )}
            {onOpenMrp && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMrp(order);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <GitBranch size={14} /> Move to Purchase MRP
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
