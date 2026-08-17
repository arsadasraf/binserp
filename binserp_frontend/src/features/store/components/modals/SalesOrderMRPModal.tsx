import React, { useState, useEffect } from 'react';
import { X, Layers, GitBranch, ShoppingCart, Wrench, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, RefreshCw, ChevronRight, ChevronDown, Sparkles, Box } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'fg' | 'bom' | 'consolidated'>('fg');

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
      } else {
        Swal.fire("MRP Error", data.message || "Failed to explode Sales Order MRP.", "error");
      }
    } catch (err: any) {
      console.error("Failed to explode MRP:", err);
      Swal.fire("MRP Error", "Server connection error running MRP explosion.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateFG = async (fgItemId: string, maxAvailable: number, orderUnfilled: number) => {
    const defaultQty = Math.min(maxAvailable, orderUnfilled);
    const { value: qtyStr } = await Swal.fire({
      title: "Allocate Finished Goods Stock",
      text: `Enter quantity to allocate to Sales Order #${salesOrder.orderNumber} (Available in Store: ${maxAvailable} pcs, Needed: ${orderUnfilled} pcs):`,
      input: "number",
      inputValue: defaultQty,
      showCancelButton: true,
      inputValidator: (val) => {
        const n = Number(val);
        if (!n || n <= 0) return "Please enter a valid positive quantity!";
        if (n > maxAvailable) return `Cannot allocate more than available stock (${maxAvailable} pcs)!`;
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

  const handleSendToPurchase = async (itemsToSend: any[]) => {
    if (!itemsToSend || itemsToSend.length === 0) {
      Swal.fire("No Deficit Items", "There are no raw material net deficit items to send to Purchase.", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Send Deficit to Purchase Indent / MRP?",
      text: `Create Purchase Requisition / Indent for ${itemsToSend.length} raw material item(s) for Sales Order #${salesOrder.orderNumber}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Create Purchase Indent"
    });

    if (!confirm.isConfirmed) return;

    try {
      const authToken = token || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/store/purchase/indent-from-mrp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          salesOrderId: salesOrder._id,
          items: itemsToSend
        })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("Sent to Purchase!", data.message, "success");
        fetchMRPExplosion();
        if (onRefetch) onRefetch();
      } else {
        Swal.fire("Purchase Error", data.message, "error");
      }
    } catch (err) {
      Swal.fire("Error", "Failed to create Purchase Indent from MRP.", "error");
    }
  };

  const handleSendToPPC = async (itemsToSend: any[]) => {
    if (!itemsToSend || itemsToSend.length === 0) {
      Swal.fire("No Manufactured Items", "Please select manufactured assembly items to send to PPC Intake.", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Send to PPC Intake?",
      text: `Create PPC Work Orders / Job Cards for ${itemsToSend.length} item(s) for Sales Order #${salesOrder.orderNumber}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Create Work Orders"
    });

    if (!confirm.isConfirmed) return;

    try {
      const authToken = token || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}/api/store/ppc/workorder-from-mrp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          salesOrderId: salesOrder._id,
          items: itemsToSend
        })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("Sent to PPC Intake!", data.message, "success");
        fetchMRPExplosion();
        if (onRefetch) onRefetch();
      } else {
        Swal.fire("PPC Error", data.message, "error");
      }
    } catch (err) {
      Swal.fire("Error", "Failed to send to PPC Intake.", "error");
    }
  };

  if (!isOpen || !salesOrder) return null;

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const renderTreeNode = (node: any, pathId: string) => {
    const isExpanded = expandedNodes[pathId] !== false; // default expanded
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={pathId} className="space-y-1 my-1">
        <div className={`p-3.5 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
          node.level === 0
            ? 'bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700'
            : node.level === 1
            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ml-4 sm:ml-6'
            : 'bg-slate-50/50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 ml-8 sm:ml-12'
        }`}>
          <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
            {hasChildren ? (
              <button
                onClick={() => toggleNodeExpand(pathId)}
                className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-300"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <div className="w-6 h-6" />
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {node.name}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                  node.level === 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                    : node.itemType === 'Component'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {node.level === 0 ? 'Assembly (FG)' : node.itemType}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Parent: <b>{node.parentName}</b> | Depth Level {node.level}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Required:</span>
              <span className="font-bold text-slate-900 dark:text-white">{node.requiredQty} {node.unit}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Store Stock:</span>
              <span className="font-bold text-emerald-600">{node.availableStock} {node.unit}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Net Deficit:</span>
              <span className={`font-black ${node.netDeficit > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {node.netDeficit} {node.unit}
              </span>
            </div>

            {/* Direct Action Button */}
            <div>
              {node.routingAction === 'PURCHASE_RFQ_PO' && node.netDeficit > 0 && (
                <button
                  onClick={() => handleSendToPurchase([node])}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm"
                >
                  <ShoppingCart size={13} /> Purchase Indent
                </button>
              )}
              {node.routingAction === 'PPC_INTAKE' && (
                <button
                  onClick={() => handleSendToPPC([node])}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm"
                >
                  <Wrench size={13} /> Send to PPC
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Children Render */}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child: any, idx: number) =>
              renderTreeNode(child, `${pathId}-${idx}`)
            )}
          </div>
        )}
      </div>
    );
  };

  const rmDeficitItems = mrpData?.consolidatedView?.filter((i: any) => i.routingAction === 'PURCHASE_RFQ_PO' && i.totalNetDeficit > 0) || [];
  const ppcItems = mrpData?.consolidatedView?.filter((i: any) => i.routingAction === 'PPC_INTAKE') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">

        {/* Simplified Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <GitBranch className="text-indigo-400 w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Purchase MRP Module — Sales Order #{salesOrder.orderNumber}
                </h3>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30 uppercase">
                  {salesOrder.fulfillmentStatus || 'Moved MRP'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Customer: <b>{salesOrder.customerName || salesOrder.customer?.name || salesOrder.customer?.companyName || 'Customer'}</b> | Target Date: {salesOrder.targetDate ? new Date(salesOrder.targetDate).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/dashboard/store/purchase/mrp"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-bold border border-indigo-500/30 transition-all flex items-center gap-1"
            >
              Open Purchase MRP Tab <ArrowRight size={13} />
            </a>
            <button
              onClick={fetchMRPExplosion}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="Refresh MRP"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center text-slate-300 hover:text-white border border-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Workflow Banner */}
        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 px-6 border-b border-indigo-100 dark:border-indigo-900 flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
          <Sparkles size={15} className="text-amber-500 flex-shrink-0" />
          <span><b>Purchase MRP Pipeline:</b> Sales Orders route to Purchase MRP to reserve FG stock, explode multi-level BOMs, send raw material deficits to Purchase Indents, and route manufactured assemblies to PPC Intake.</span>
        </div>

        {/* Simple Workflow Navigation Tabs */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-3 px-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('fg')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === 'fg'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Box size={14} /> Step 1: FG Stock Check & Allocation
            </button>

            <button
              onClick={() => setActiveTab('bom')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === 'bom'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <GitBranch size={14} /> Step 2: Exploded BOM Tree
            </button>

            <button
              onClick={() => setActiveTab('consolidated')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === 'consolidated'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Layers size={14} /> Step 3: Consolidated Demand
            </button>
          </div>

          <div className="flex gap-2">
            {rmDeficitItems.length > 0 && (
              <button
                onClick={() => handleSendToPurchase(rmDeficitItems)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <ShoppingCart size={14} /> Send Deficit ({rmDeficitItems.length}) to Purchase Indent
              </button>
            )}
            {ppcItems.length > 0 && (
              <button
                onClick={() => handleSendToPPC(ppcItems)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Wrench size={14} /> Send ({ppcItems.length}) to PPC Intake
              </button>
            )}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">

          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <RefreshCw className="animate-spin w-8 h-8 mx-auto text-indigo-600" />
              <p className="text-xs font-bold">Checking FG Inventory & Exploding Multi-Level BOM...</p>
            </div>
          ) : !mrpData ? (
            <div className="py-12 text-center text-slate-400">
              No MRP data available. Click refresh to run.
            </div>
          ) : activeTab === 'fg' ? (
            
            /* STEP 1: FG INVENTORY ALLOCATION VIEW */
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-500" /> Step 1: Finished Goods Stock Check & Reservation
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    If Finished Goods are available in warehouse, allocate them to `#SO-${salesOrder.orderNumber}` first to reduce production demand.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(salesOrder.items || []).map((item: any, idx: number) => {
                  const fgObj = item.fgItem || {};
                  const currentTotalStock = Number(fgObj.quantity || 0);
                  const currentAllocated = Number(fgObj.allocatedQuantity || 0);
                  const availableStock = Math.max(0, currentTotalStock - currentAllocated);
                  const orderQty = Number(item.quantity || 0);
                  const alreadyAllocatedSO = Number(item.allocatedFgQty || 0);
                  const orderUnfilled = Math.max(0, orderQty - alreadyAllocatedSO);

                  return (
                    <div key={idx} className="bg-white dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          SO Line Item #{idx + 1}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {item.name}
                        </h4>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1">
                          <span>SO Needed: <b className="font-mono text-slate-900 dark:text-white">{orderQty} PCS</b></span>
                          <span>Allocated to SO: <b className="font-mono text-amber-600">{alreadyAllocatedSO} PCS</b></span>
                          <span>Unfilled Net Needed: <b className="font-mono text-rose-600">{orderUnfilled} PCS</b></span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-center">
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Unreserved Store Stock</span>
                          <span className="font-mono font-black text-sm text-emerald-600">{availableStock} PCS</span>
                        </div>

                        {availableStock > 0 && orderUnfilled > 0 ? (
                          <button
                            onClick={() => handleAllocateFG(fgObj._id || item.fgItem, availableStock, orderUnfilled)}
                            disabled={allocatingFgId === (fgObj._id || item.fgItem)}
                            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <Sparkles size={15} /> Allocate {Math.min(availableStock, orderUnfilled)} PCS
                          </button>
                        ) : (
                          <span className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-xs font-bold text-center">
                            {alreadyAllocatedSO >= orderQty ? 'Fully Covered' : 'No Store Stock'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          ) : activeTab === 'bom' ? (

            /* STEP 2: EXPLODED BOM TREE VIEW */
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <GitBranch size={16} className="text-indigo-500" /> Step 2: Multi-Level Exploded BOM Linkage Tree
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hierarchical breakdown showing Assembly $\rightarrow$ Sub-Assemblies $\rightarrow$ Raw Materials for remaining unallocated demand.
                  </p>
                </div>
              </div>

              {(mrpData.treeView || []).map((rootNode: any, idx: number) =>
                renderTreeNode(rootNode, `root-${idx}`)
              )}
            </div>

          ) : (

            /* STEP 3: CONSOLIDATED DEMAND TABLE */
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Layers size={16} className="text-purple-500" /> Step 3: Consolidated Component & Net Material Demand
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aggregated list of all unique raw materials and components needed across the entire order.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Item / Material Description</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-right">Gross Needed</th>
                      <th className="p-3 text-right">Available Stock</th>
                      <th className="p-3 text-right">Net Shortage Deficit</th>
                      <th className="p-3 text-center">Action Routing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {mrpData.consolidatedView.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.itemType}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {item.totalRequiredQty} {item.unit}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                          {item.availableStock} {item.unit}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-rose-600">
                          {item.totalNetDeficit} {item.unit}
                        </td>
                        <td className="p-3 text-center">
                          {item.routingAction === 'PURCHASE_RFQ_PO' && item.totalNetDeficit > 0 ? (
                            <button
                              onClick={() => handleSendToPurchase([item])}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 mx-auto"
                            >
                              <ShoppingCart size={13} /> Send Purchase Indent
                            </button>
                          ) : item.routingAction === 'PPC_INTAKE' ? (
                            <button
                              onClick={() => handleSendToPPC([item])}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 mx-auto"
                            >
                              <Wrench size={13} /> Send to PPC
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                              <CheckCircle2 size={14} /> Stock Covered
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-500 font-medium">
            Sales Order Status: <b className="text-slate-900 dark:text-white">{salesOrder.fulfillmentStatus || 'Pending'}</b>
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
          >
            Close Preview
          </button>
        </div>

      </div>
    </div>
  );
}
