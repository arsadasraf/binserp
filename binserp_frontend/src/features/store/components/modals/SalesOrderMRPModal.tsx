import React, { useState, useEffect } from 'react';
import { X, Layers, GitBranch, ShoppingCart, Wrench, CheckCircle2, RefreshCw, ChevronRight, ChevronDown, Sparkles, Box, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '@/src/utils/config';

interface SalesOrderMRPModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesOrder: any | null;
  token?: string;
  onRefetch?: () => void;
}

export default function SalesOrderMRPModal({
  isOpen,
  onClose,
  salesOrder,
  token,
  onRefetch
}: SalesOrderMRPModalProps) {
  const [loading, setLoading] = useState(false);
  const [mrpData, setMrpData] = useState<any | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [allocatingFgId, setAllocatingFgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fg' | 'bom'>('fg');

  useEffect(() => {
    if (isOpen && salesOrder) {
      fetchMRPExplosion();
    }
  }, [isOpen, salesOrder]);

  const fetchMRPExplosion = async () => {
    if (!salesOrder?._id) return;
    setLoading(true);
    try {
      const authToken = token || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/store/mrp/explode-so`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ salesOrderId: salesOrder._id })
      });
      const data = await res.json();
      if (data.success) {
        setMrpData(data.data);
      }
    } catch (err: any) {
      console.error("Failed to explode MRP:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateFG = async (fgItemId: string, maxAvailable: number, orderUnfilled: number) => {
    const defaultQty = Math.min(maxAvailable, orderUnfilled);
    const { value: qtyStr } = await Swal.fire({
      title: "Allocate Finished Goods Stock",
      text: `Enter quantity to allocate (Available: ${maxAvailable} PCS, Needed: ${orderUnfilled} PCS):`,
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
    setAllocatingFgId(fgItemId);
    try {
      const authToken = token || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/store/fg/allocate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          salesOrderId: salesOrder._id,
          fgItemId,
          allocateQty,
          action: "allocate"
        })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("FG Stock Allocated!", data.message, "success");
        fetchMRPExplosion();
        if (onRefetch) onRefetch();
      } else {
        Swal.fire("Allocation Failed", data.message, "error");
      }
    } catch (err: any) {
      console.error("Allocation error:", err);
      Swal.fire("Error", "Failed to allocate FG stock.", "error");
    } finally {
      setAllocatingFgId(null);
    }
  };

  const handleSendToPurchaseMRPBucket = async () => {
    setLoading(true);
    try {
      const authToken = token || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/sales/order/${salesOrder._id}/move-to-mrp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        }
      });
      
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        console.error("Non-JSON response received:", text);
        throw new Error(`Server error (${res.status}): ${res.statusText}`);
      }

      if (res.ok && data.success) {
        await Swal.fire({
          icon: "success",
          title: "Sent to Purchase MRP Bucket!",
          text: data.message,
          confirmButtonText: "Open Purchase MRP Bucket Page"
        });
        if (onRefetch) onRefetch();
        window.location.href = "/dashboard/store/purchase/mrp";
      } else {
        Swal.fire("Error", data.message || "Failed to send to Purchase MRP.", "error");
      }
    } catch (err: any) {
      console.error("Move to MRP error:", err);
      Swal.fire("Error", err.message || "Server connection error sending to Purchase MRP.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !salesOrder) return null;

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const renderTreeNode = (node: any, pathId: string) => {
    const isExpanded = expandedNodes[pathId] !== false;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={pathId} className="ml-3 sm:ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1 my-1">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button onClick={() => toggleNodeExpand(pathId)} className="text-slate-400 hover:text-slate-600">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            <span className="font-extrabold text-slate-900 dark:text-white">{node.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
              {node.itemType}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Req: <b>{node.requiredQty} {node.unit}</b></span>
            <span>Avail: <b className="text-emerald-600">{node.availableStock} {node.unit}</b></span>
            <span>Deficit: <b className="text-rose-600">{node.netDeficit} {node.unit}</b></span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child: any, idx: number) => renderTreeNode(child, `${pathId}-${idx}`))}
          </div>
        )}
      </div>
    );
  };

  const custName = salesOrder.customerName || salesOrder.customer?.name || salesOrder.customer?.companyName || 'Customer';
  const targetDateStr = salesOrder.targetDate ? new Date(salesOrder.targetDate).toLocaleDateString('en-GB') : '-';
  const currentStatus = salesOrder.status || salesOrder.fulfillmentStatus || 'Pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

        {/* Minimal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                Sales Order #{salesOrder.orderNumber}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                currentStatus === 'Items Allocated' || currentStatus === 'Fully Allocated' ? 'bg-cyan-900/60 text-cyan-300 border-cyan-700' :
                currentStatus === 'Moved to MRP' || currentStatus === 'Moved MRP' ? 'bg-indigo-900/60 text-indigo-300 border-indigo-700' :
                'bg-amber-900/60 text-amber-300 border-amber-700'
              }`}>
                {currentStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer: <b className="text-slate-200">{custName}</b> | Target Date: {targetDateStr}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Minimal Sub-Tabs */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-2 px-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('fg')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'fg'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Box size={14} /> FG Stock Allocation
            </button>
            <button
              onClick={() => setActiveTab('bom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'bom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <GitBranch size={14} /> Exploded BOM Tree
            </button>
          </div>

          <button
            onClick={fetchMRPExplosion}
            className="p-1.5 text-slate-500 hover:text-indigo-600 transition-colors"
            title="Refresh Stock Status"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Main Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="animate-spin w-7 h-7 mx-auto text-indigo-600" />
              <p className="text-xs font-bold">Checking FG Stock Availability...</p>
            </div>
          ) : activeTab === 'fg' ? (

            /* SLEEK FG STOCK ALLOCATION TABLE */
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">FG Product Name</th>
                    <th className="p-3 text-center">SO Needed</th>
                    <th className="p-3 text-center">Allocated</th>
                    <th className="p-3 text-center">Store Unreserved</th>
                    <th className="p-3 text-center">Shortage Qty</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {(salesOrder.items || []).map((item: any, idx: number) => {
                    const fgObj = item.fgItem || {};
                    const currentTotalStock = Number(fgObj.quantity || 0);
                    const currentAllocated = Number(fgObj.allocatedQuantity || 0);
                    const availableStock = Math.max(0, currentTotalStock - currentAllocated);
                    const orderQty = Number(item.quantity || 0);
                    const alreadyAllocatedSO = Number(item.allocatedFgQty || 0);
                    const orderUnfilled = Math.max(0, orderQty - alreadyAllocatedSO);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          {item.name || fgObj.name}
                          {item.productCode && <span className="block text-[10px] text-slate-400 font-mono">{item.productCode}</span>}
                        </td>

                        <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {orderQty} PCS
                        </td>

                        <td className="p-3 text-center font-mono font-bold text-amber-600">
                          {alreadyAllocatedSO} PCS
                        </td>

                        <td className="p-3 text-center font-mono font-extrabold text-emerald-600">
                          {availableStock} PCS
                        </td>

                        <td className="p-3 text-center font-mono font-black text-rose-600">
                          {orderUnfilled} PCS
                        </td>

                        <td className="p-3 text-right">
                          {availableStock > 0 && orderUnfilled > 0 ? (
                            <button
                              onClick={() => handleAllocateFG(fgObj._id || item.fgItem, availableStock, orderUnfilled)}
                              disabled={allocatingFgId === (fgObj._id || item.fgItem)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-end gap-1 ml-auto"
                            >
                              <Sparkles size={13} /> Allocate {Math.min(availableStock, orderUnfilled)} PCS
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">
                              {alreadyAllocatedSO >= orderQty ? 'Fully Covered' : 'No Store Stock'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          ) : (

            /* EXPLODED BOM TREE VIEW */
            <div className="space-y-2">
              {mrpData?.treeView && mrpData.treeView.length > 0 ? (
                mrpData.treeView.map((rootNode: any, idx: number) => renderTreeNode(rootNode, `root-${idx}`))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No multi-level BOM explosion tree available for this order.
                </div>
              )}
            </div>

          )}
        </div>

        {/* Ultra-Clean Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <button
            onClick={handleSendToPurchaseMRPBucket}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Send size={14} /> Send Shortage to Purchase MRP Bucket
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
