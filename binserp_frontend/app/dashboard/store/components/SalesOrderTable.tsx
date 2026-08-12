import React, { useState, useMemo } from "react";
import { Plus, Search, Eye, Edit2, Trash2, Download, ShoppingCart, Filter, FileText, Building2, Tag } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import MoveToMrpModal from "./MoveToMrpModal";

interface SalesOrderTableProps {
  orders: any[];
  customers?: any[];
  companyInfo?: any;
  onCreate: () => void;
  onEdit: (order: any) => void;
  onView: (order: any) => void;
  onDelete: (id: string) => void;
}

export const SalesOrderTable: React.FC<SalesOrderTableProps> = ({
  orders = [],
  customers = [],
  companyInfo,
  onCreate,
  onEdit,
  onView,
  onDelete
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PO_BASED" | "DIRECT">("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrderForMrp, setSelectedOrderForMrp] = useState<any | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderNum = (order.orderNumber || "").toLowerCase();
      const poRef = (order.poReference || "").toLowerCase();
      const custName = (order.customer?.name || order.customer?.customerName || order.customer || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = orderNum.includes(term) || poRef.includes(term) || custName.includes(term);
      
      const orderType = order.orderType || (order.poReference ? "PO_BASED" : "DIRECT");
      const matchesType = typeFilter === "ALL" ? true : orderType === typeFilter;

      const matchesStatus = statusFilter === "ALL" ? true : order.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [orders, searchTerm, typeFilter, statusFilter]);

  const handleDownloadPDF = (order: any) => {
    try {
      const doc = new jsPDF();

      const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
      const compAddress = companyInfo?.address || companyInfo?.location || "";
      const compEmail = companyInfo?.email || "";
      const compPhone = companyInfo?.phone || companyInfo?.contactNumber || "";
      const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "";

      const custObj = typeof order.customer === "object" ? order.customer : customers.find(c => (c._id || c.id) === order.customer);
      const custName = custObj?.name || custObj?.customerName || (typeof order.customer === "string" ? order.customer : "Internal Stock Production");
      const custAddress = custObj?.address || custObj?.location || "";
      const custPhone = custObj?.phone || custObj?.contactNumber || "";
      const custEmail = custObj?.email || "";

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
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-gray-50/40 dark:bg-gray-800/30">
        
        {/* Left: Type Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-200/60 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setTypeFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              typeFilter === "ALL" 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            onClick={() => setTypeFilter("PO_BASED")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              typeFilter === "PO_BASED" 
                ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm" 
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            PO-Based ({orders.filter(o => (o.orderType || (o.poReference ? "PO_BASED" : "DIRECT")) === "PO_BASED").length})
          </button>
          <button
            onClick={() => setTypeFilter("DIRECT")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              typeFilter === "DIRECT" 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Direct Internal ({orders.filter(o => (o.orderType || (o.poReference ? "PO_BASED" : "DIRECT")) === "DIRECT").length})
          </button>
        </div>

        {/* Right: Search, Status Filter & Create Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Sales Orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In-Progress">In-Progress</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Completed">Completed</option>
          </select>

          <button
            onClick={onCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Create Sales Order</span>
          </button>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50/70 dark:bg-gray-800/50 text-gray-500 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Order No. & Type</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Customer / Stock</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">PO Reference</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Target Date</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Line Items</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Total Amount (₹)</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Status</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="font-semibold text-sm">No Sales Orders Found</p>
                  <p className="text-xs mt-1">Create a new direct sales order or generate one from Inward PO.</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const orderType = order.orderType || (order.poReference ? "PO_BASED" : "DIRECT");
                const custName = order.customer?.name || order.customer?.customerName || (typeof order.customer === "string" ? order.customer : "Internal Stock Production");
                
                return (
                  <tr key={order._id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          orderType === "PO_BASED" 
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>
                          {orderType === "PO_BASED" ? "PO-BASED" : "DIRECT"}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        Created: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {custName}
                      </div>
                      {!order.customer && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Internal Production</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">
                      {order.poReference ? (
                        <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[11px] font-mono">
                          {order.poReference}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {order.targetDate ? new Date(order.targetDate).toLocaleDateString() : 'N/A'}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300">
                        {order.items?.length || 0} Items
                      </span>
                      {order.items?.[0] && (
                        <span className="text-[10px] text-gray-400 block mt-0.5 truncate max-w-[140px] mx-auto">
                          {order.items[0].name || order.items[0].productName}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-extrabold text-gray-900 dark:text-white">
                      ₹{Number(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        order.status === 'Completed' || order.status === 'Dispatched' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                        order.status === 'In-Progress' || order.status === 'Partially Dispatched' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                        order.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                      }`}>
                        {order.status || 'Pending'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {order.status !== 'Moved MRP' && order.status !== 'Completed' && (
                          <button
                            onClick={() => setSelectedOrderForMrp(order)}
                            title="Check FG Stock & Move Shortfall to MRP"
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <span>Move to MRP</span>
                          </button>
                        )}

                        <button
                          onClick={() => onView(order)}
                          title="View Details"
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        
                        <button
                          onClick={() => handleDownloadPDF(order)}
                          title="Download PDF"
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        >
                          <Download size={15} />
                        </button>

                        <button
                          onClick={() => onEdit(order)}
                          title="Edit Order"
                          className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>

                        <button
                          onClick={() => onDelete(order._id)}
                          title="Delete Order"
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Move to MRP Modal Form with FG Stock Availability */}
      {selectedOrderForMrp && (
        <MoveToMrpModal
          isOpen={!!selectedOrderForMrp}
          order={selectedOrderForMrp}
          onClose={() => setSelectedOrderForMrp(null)}
          onSuccess={(msg) => {
            alert(msg);
            setSelectedOrderForMrp(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};
