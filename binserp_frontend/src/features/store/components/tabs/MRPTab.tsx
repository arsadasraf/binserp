/**
 * MRPTab Component
 * 
 * Manages Material Requirements Planning (MRP) for:
 * 1. Finished Goods (FG) Shortfalls moved from Sales Orders
 * 2. Raw Materials / Bought-Out (RM / BO) Items exploded from FG BOMs
 */

import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/src/utils/config';
import LoadingSpinner from '@/src/components/LoadingSpinner';

import { Search, Save, AlertCircle, CheckCircle2, ClipboardList, Layers, Send, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MRPTab() {
  const [loading, setLoading] = useState(true);
  const [fgMrps, setFgMrps] = useState<any[]>([]);
  const [rmPlans, setRmPlans] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentSubTab, setCurrentSubTab] = useState<'fg' | 'bo'>('fg');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const apiUrl = getApiBaseUrl();



  useEffect(() => {
    fetchMRPData();
  }, []);

  const fetchMRPData = async () => {
    setLoading(true);
    try {
      // Fetch FG MRPs (moved from Sales Orders)
      const resFg = await fetch(`${apiUrl}/api/store/mrp`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataFg = await resFg.json();
      if (resFg.ok) {
        setFgMrps(dataFg.data || dataFg.mrps || []);
      }

      // Fetch RM/BO Plans (exploded from FG BOMs)
      const resRm = await fetch(`${apiUrl}/api/store/rm-plan`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataRm = await resRm.json();
      if (resRm.ok) {
        setRmPlans(dataRm.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch MRP data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExplodeBOM = async (mrpId: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/store/mrp/${mrpId}/plan-rm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to explode BOM');

      Swal.fire({
        icon: 'success',
        title: 'BOM Exploded',
        text: data.message || 'BOM exploded into RM/BO material requirements',
        timer: 2000
      });
      fetchMRPData();
      setCurrentSubTab('bo');
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Failed to explode BOM'
      });
    }
  };

  const handleSendToPPC = async (mrpId: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/store/mrp/${mrpId}/send-to-ppc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send to PPC');

      Swal.fire({
        icon: 'success',
        title: 'Sent to PPC Intake',
        text: data.message || 'FG Requirement sent to PPC Order Intake Bucket',
        timer: 2000
      });
      fetchMRPData();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Failed to send to PPC'
      });
    }
  };

  const filteredFgItems = fgMrps.filter((item: any) => {
    const fgName = item.fgItem?.name || item.materialName || '';
    const orderNum = item.salesOrder?.orderNumber || item.orderNumber || '';
    const term = searchTerm.toLowerCase();
    return fgName.toLowerCase().includes(term) || orderNum.toLowerCase().includes(term);
  });

  const filteredRmItems = rmPlans.filter((item: any) => {
    const rmName = item.rmBoItem?.name || item.materialName || '';
    const orderNum = item.sourceMRP?.salesOrder?.orderNumber || item.orderNumber || '';
    const term = searchTerm.toLowerCase();
    return rmName.toLowerCase().includes(term) || orderNum.toLowerCase().includes(term);
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sub-Tabs */}
      <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 w-fit shadow-sm">
        <button
          onClick={() => setCurrentSubTab("fg")}
          className={`px-5 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${currentSubTab === "fg"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-800"
            }`}
        >
          Finished Goods Shortfalls ({fgMrps.length})
        </button>
        <button
          onClick={() => setCurrentSubTab("bo")}
          className={`px-5 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${currentSubTab === "bo"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-800"
            }`}
        >
          RM / BO Material Requirements ({rmPlans.length})
        </button>
      </div>

      {/* Toolbar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Purchase MRP & Material Planning</h2>
            <p className="text-xs text-gray-500">Manage order shortfalls, explode BOMs, and route requirements to PPC / Purchasing</p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            placeholder="Search item or order number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {currentSubTab === "fg" ? (
          <>
            {/* Finished Goods (FG) Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-indigo-50/80 dark:bg-slate-800 text-indigo-900 dark:text-indigo-300 font-bold uppercase">
                  <tr>
                    <th className="px-6 py-4">Finished Goods Item</th>
                    <th className="px-6 py-4">Source Sales Order</th>
                    <th className="px-6 py-4 text-center">Shortfall Qty</th>
                    <th className="px-6 py-4">Target Due Date</th>
                    <th className="px-6 py-4 text-center">MRP Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredFgItems.length > 0 ? (
                    filteredFgItems.map((item) => {
                      const fgName = item.fgItem?.name || item.materialName || 'FG Product';
                      const fgCode = item.fgItem?.code || '';
                      const orderNum = item.salesOrder?.orderNumber || item.storeOrder?.orderNumber || item.orderNumber || 'SO-Direct';
                      const custName = item.salesOrder?.customerName || item.storeOrder?.customerName || item.customerName || '';

                      return (
                        <tr key={item._id} className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                            {fgName} {fgCode && <span className="text-[10px] text-gray-400 block font-mono">{fgCode}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                              {orderNum}
                            </span>
                            {custName && <span className="text-[10px] text-gray-500 block mt-0.5">{custName}</span>}
                          </td>
                          <td className="px-6 py-4 text-center font-extrabold text-amber-600 dark:text-amber-400 text-sm font-mono">
                            {item.requiredQuantity} Units
                          </td>
                          <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">
                            {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              item.status === 'Sent to PPC' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40' :
                              item.status === 'RM Planned' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-950/40'
                            }`}>
                              {item.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleExplodeBOM(item._id)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1"
                                title="Explode BOM to calculate RM/BO requirements"
                              >
                                <Layers size={14} />
                                <span>Explode BOM</span>
                              </button>

                              <button
                                onClick={() => handleSendToPPC(item._id)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1"
                                title="Send demand to PPC Order Intake Bucket"
                              >
                                <Send size={14} />
                                <span>Send to PPC</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                        No FG shortfalls found in Purchase MRP. Use "Move to MRP" on Sales Orders to add items here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Finished Goods (FG) Mobile Cards */}
            <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-slate-900/40">
              {filteredFgItems.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No FG shortfalls found.
                </div>
              ) : (
                filteredFgItems.map((item) => {
                  const fgName = item.fgItem?.name || item.materialName || 'FG Product';
                  const fgCode = item.fgItem?.code || '';
                  const orderNum = item.salesOrder?.orderNumber || item.storeOrder?.orderNumber || item.orderNumber || 'SO-Direct';
                  const custName = item.salesOrder?.customerName || item.storeOrder?.customerName || item.customerName || '';

                  return (
                    <div key={item._id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{fgName}</h4>
                          {fgCode && <p className="text-[11px] text-gray-400 font-mono">{fgCode}</p>}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Sent to PPC' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          item.status === 'RM Planned' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {item.status || 'Pending'}
                        </span>
                      </div>

                      <div className="bg-indigo-50/50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs space-y-1.5 border border-indigo-100/50 dark:border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Source Order:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{orderNum} {custName && `(${custName})`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Shortfall:</span>
                          <span className="font-extrabold text-amber-600 dark:text-amber-400 font-mono text-sm">{item.requiredQuantity} Units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Due Date:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : '-'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleExplodeBOM(item._id)}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Layers size={13} /> Explode BOM
                        </button>
                        <button
                          onClick={() => handleSendToPPC(item._id)}
                          className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Send size={13} /> Send to PPC
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* RM / BO Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/80 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold uppercase">
                  <tr>
                    <th className="px-6 py-4">Material / Component</th>
                    <th className="px-6 py-4">Source Order / FG Ref</th>
                    <th className="px-6 py-4 text-center">Required Qty</th>
                    <th className="px-6 py-4 text-center">In-House Stock</th>
                    <th className="px-6 py-4 text-center">Net Shortage</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredRmItems.length > 0 ? (
                    filteredRmItems.map((item) => {
                      const matName = item.rmBoItem?.name || item.materialName || 'RM / BO Item';
                      const orderNum = item.sourceMRP?.salesOrder?.orderNumber || item.orderNumber || 'MRP';
                      const fgName = item.sourceMRP?.fgItem?.name || '';
                      const reqQty = Number(item.requiredQuantity || 0);
                      const stock = Number(item.currentStock || 0);
                      const shortage = Number(item.shortage !== undefined ? item.shortage : Math.max(0, reqQty - stock));

                      return (
                        <tr key={item._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                            {matName}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">
                              {orderNum}
                            </span>
                            {fgName && <span className="text-[10px] text-gray-400 block mt-0.5">{fgName}</span>}
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-gray-700 dark:text-slate-300">
                            {reqQty}
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-gray-600 dark:text-slate-400">
                            {stock}
                          </td>
                          <td className="px-6 py-4 text-center font-extrabold">
                            {shortage > 0 ? (
                              <span className="text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md border border-red-200 font-mono">
                                {shortage} Short
                              </span>
                            ) : (
                              <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.status === 'PO Created' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {item.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/dashboard/store/purchase/rfq?materialId=${item.rmBoItem?._id || item._id}&qty=${shortage || reqQty}`}
                                className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg transition-colors"
                                title="Create Outward RFQ"
                              >
                                Outward RFQ
                              </a>

                              <a
                                href={`/dashboard/store/purchase/po?materialId=${item.rmBoItem?._id || item._id}&qty=${shortage || reqQty}`}
                                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                                title="Create Outward PO"
                              >
                                Outward PO
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        No RM/BO material requirements found. Explode a BOM from the "Finished Goods Shortfalls" sub-tab above to generate material plans.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* RM / BO Mobile Cards */}
            <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-slate-900/40">
              {filteredRmItems.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No RM/BO material requirements found.
                </div>
              ) : (
                filteredRmItems.map((item) => {
                  const matName = item.rmBoItem?.name || item.materialName || 'RM / BO Item';
                  const orderNum = item.sourceMRP?.salesOrder?.orderNumber || item.orderNumber || 'MRP';
                  const fgName = item.sourceMRP?.fgItem?.name || '';
                  const reqQty = Number(item.requiredQuantity || 0);
                  const stock = Number(item.currentStock || 0);
                  const shortage = Number(item.shortage !== undefined ? item.shortage : Math.max(0, reqQty - stock));

                  return (
                    <div key={item._id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{matName}</h4>
                          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">{orderNum} {fgName && `(${fgName})`}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'PO Created' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.status || 'Pending'}
                        </span>
                      </div>

                      <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs space-y-1.5 border border-gray-100 dark:border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Required:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">{reqQty} Units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">In-House Stock:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{stock} Units</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-slate-700">
                          <span className="font-bold text-gray-700 dark:text-gray-300">Net Status:</span>
                          {shortage > 0 ? (
                            <span className="text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded font-mono font-bold text-xs">
                              {shortage} Short
                            </span>
                          ) : (
                            <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-bold text-xs">
                              In Stock
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={`/dashboard/store/purchase/rfq?materialId=${item.rmBoItem?._id || item._id}&qty=${shortage || reqQty}`}
                          className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition-colors text-center shadow-sm"
                        >
                          Outward RFQ
                        </a>
                        <a
                          href={`/dashboard/store/purchase/po?materialId=${item.rmBoItem?._id || item._id}&qty=${shortage || reqQty}`}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors text-center shadow-sm"
                        >
                          Outward PO
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
