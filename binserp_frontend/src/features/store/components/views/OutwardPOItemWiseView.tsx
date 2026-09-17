"use client";

import React, { useState, useMemo } from 'react';
import { 
  Package, Eye, Calendar, Building2, Layers, CheckCircle2, 
  Clock, ArrowUpDown, ExternalLink, FileText, CheckCircle, 
  ShoppingBag, Truck, Info, X, Search, ShoppingCart
} from 'lucide-react';

export interface OutwardPOItemWiseViewProps {
  data: any[];
  materials?: any[];
  vendors?: any[];
  onViewPo: (po: any) => void;
  searchTerm?: string;
  filterVendor?: string;
  filterType?: string;
}

interface LinkedPoEntry {
  po: any;
  poId: string;
  poNumber: string;
  vendorName: string;
  vendorId?: string;
  poDate: string;
  orderedQty: number;
  unit: string;
  rate: number;
  amount: number;
  receivedQty: number;
  pendingQty: number;
  expectedDeliveryDate?: string;
  status: string;
}

interface AggregatedMaterial {
  id: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  matObj?: any;
  totalOrderedQty: number;
  totalReceivedQty: number;
  totalPendingQty: number;
  totalAmount: number;
  poCount: number;
  linkedPos: LinkedPoEntry[];
  fulfillmentRate: number;
}

export default function OutwardPOItemWiseView({
  data = [],
  materials = [],
  vendors = [],
  onViewPo,
  searchTerm = '',
  filterVendor = 'All',
  filterType = 'All'
}: OutwardPOItemWiseViewProps) {
  const [selectedMaterialForPreview, setSelectedMaterialForPreview] = useState<AggregatedMaterial | null>(null);
  const [scope, setScope] = useState<'in-po' | 'all'>('in-po');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Aggregate materials across all Outward POs
  const aggregatedMaterials: AggregatedMaterial[] = useMemo(() => {
    const itemMap = new Map<string, AggregatedMaterial>();

    // 1. Preload catalog materials if scope is 'all'
    if (scope === 'all' && Array.isArray(materials)) {
      materials.forEach((m) => {
        const matId = (m._id || m.id || '').toString();
        if (!matId) return;
        itemMap.set(matId, {
          id: matId,
          name: m.name || m.itemName || 'Material Item',
          description: m.descriptions || m.description || '',
          unit: m.unit || 'PCS',
          category: m.category || m.type || 'rm',
          matObj: m,
          totalOrderedQty: 0,
          totalReceivedQty: 0,
          totalPendingQty: 0,
          totalAmount: 0,
          poCount: 0,
          linkedPos: [],
          fulfillmentRate: 0,
        });
      });
    }

    // 2. Iterate through Outward POs
    (Array.isArray(data) ? data : []).forEach((po) => {
      if (po.status === 'Cancelled') return;

      const vendorName = po.vendorName || (typeof po.vendor === 'object' ? po.vendor?.name : '') || 'Supplier';
      const vendorId = (typeof po.vendor === 'object' ? (po.vendor?._id || po.vendor?.id) : po.vendor)?.toString();

      // Process items array
      if (Array.isArray(po.items) && po.items.length > 0) {
        po.items.forEach((it: any) => {
          const matObj = it.material && typeof it.material === 'object' ? it.material : null;
          const matId = matObj?._id?.toString() || (typeof it.material === 'string' && it.material ? it.material : null);
          const rawName = (it.materialName || matObj?.name || 'Material Item').trim();
          const key = matId || `name_${rawName.toLowerCase()}`;

          const desc = it.description || matObj?.descriptions || matObj?.description || '';
          const unit = it.unit || matObj?.unit || 'PCS';
          const cat = it.itemType || matObj?.category || matObj?.type || 'rm';
          const ordered = Number(it.quantity || 0);
          const received = Number(it.receivedQuantity || 0);
          const pending = it.pendingQuantity != null ? Number(it.pendingQuantity) : Math.max(0, ordered - received);
          const rate = Number(it.rate || 0);
          const amount = Number(it.amount || ordered * rate);

          const linkedPo: LinkedPoEntry = {
            po,
            poId: (po._id || po.poNumber)?.toString(),
            poNumber: po.poNumber || 'N/A',
            vendorName,
            vendorId,
            poDate: po.date || po.createdAt || '',
            orderedQty: ordered,
            unit,
            rate,
            amount,
            receivedQty: received,
            pendingQty: pending,
            expectedDeliveryDate: it.expectedDeliveryDate || po.expectedDeliveryDate,
            status: po.status || 'Released',
          };

          if (itemMap.has(key)) {
            const entry = itemMap.get(key)!;
            entry.totalOrderedQty += ordered;
            entry.totalReceivedQty += received;
            entry.totalPendingQty += pending;
            entry.totalAmount += amount;
            entry.poCount += 1;
            entry.linkedPos.push(linkedPo);
            if (!entry.description && desc) entry.description = desc;
          } else {
            itemMap.set(key, {
              id: key,
              name: rawName,
              description: desc,
              unit,
              category: cat,
              matObj,
              totalOrderedQty: ordered,
              totalReceivedQty: received,
              totalPendingQty: pending,
              totalAmount: amount,
              poCount: 1,
              linkedPos: [linkedPo],
              fulfillmentRate: 0,
            });
          }
        });
      } else if (po.materialName || po.material) {
        // Legacy single material PO
        const matObj = po.material && typeof po.material === 'object' ? po.material : null;
        const matId = matObj?._id?.toString() || (typeof po.material === 'string' && po.material ? po.material : null);
        const rawName = (po.materialName || matObj?.name || 'Material Item').trim();
        const key = matId || `name_${rawName.toLowerCase()}`;

        const desc = po.description || matObj?.descriptions || matObj?.description || '';
        const unit = po.unit || matObj?.unit || 'PCS';
        const cat = po.itemType || matObj?.category || 'rm';
        const ordered = Number(po.quantity || 0);
        const received = Number(po.receivedQuantity || 0);
        const pending = po.pendingQuantity != null ? Number(po.pendingQuantity) : Math.max(0, ordered - received);
        const rate = Number(po.rate || 0);
        const amount = Number(po.amount || po.totalAmount || ordered * rate);

        const linkedPo: LinkedPoEntry = {
          po,
          poId: (po._id || po.poNumber)?.toString(),
          poNumber: po.poNumber || 'N/A',
          vendorName,
          vendorId,
          poDate: po.date || po.createdAt || '',
          orderedQty: ordered,
          unit,
          rate,
          amount,
          receivedQty: received,
          pendingQty: pending,
          expectedDeliveryDate: po.expectedDeliveryDate,
          status: po.status || 'Released',
        };

        if (itemMap.has(key)) {
          const entry = itemMap.get(key)!;
          entry.totalOrderedQty += ordered;
          entry.totalReceivedQty += received;
          entry.totalPendingQty += pending;
          entry.totalAmount += amount;
          entry.poCount += 1;
          entry.linkedPos.push(linkedPo);
          if (!entry.description && desc) entry.description = desc;
        } else {
          itemMap.set(key, {
            id: key,
            name: rawName,
            description: desc,
            unit,
            category: cat,
            matObj,
            totalOrderedQty: ordered,
            totalReceivedQty: received,
            totalPendingQty: pending,
            totalAmount: amount,
            poCount: 1,
            linkedPos: [linkedPo],
            fulfillmentRate: 0,
          });
        }
      }
    });

    return Array.from(itemMap.values()).map((item) => {
      const rate = item.totalOrderedQty > 0 
        ? Math.min(100, Math.round((item.totalReceivedQty / item.totalOrderedQty) * 100)) 
        : 0;
      return { ...item, fulfillmentRate: rate };
    });
  }, [data, materials, scope]);

  // Filter materials by search term, vendor, material type, and fulfillment status
  const filteredMaterials = useMemo(() => {
    return aggregatedMaterials.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q) ||
        item.linkedPos.some(lp => 
          lp.poNumber.toLowerCase().includes(q) || 
          lp.vendorName.toLowerCase().includes(q)
        );

      if (!matchesSearch) return false;

      // Vendor Filter
      if (filterVendor !== 'All') {
        const hasVendor = item.linkedPos.some(lp => lp.vendorId === filterVendor);
        if (!hasVendor) return false;
      }

      // Material Type Filter (RM, BO, Consumable)
      if (filterType !== 'All') {
        const catLower = (item.category || '').toLowerCase();
        if (filterType === 'RM' && !catLower.includes('rm') && !catLower.includes('raw')) return false;
        if (filterType === 'BO' && !catLower.includes('bo') && !catLower.includes('bought')) return false;
        if (filterType === 'Consumable' && !catLower.includes('consumable')) return false;
      }

      // Fulfillment Status Filter
      if (statusFilter === 'pending') {
        if (item.totalPendingQty <= 0 || item.poCount === 0) return false;
      } else if (statusFilter === 'completed') {
        if (item.poCount === 0 || item.totalPendingQty > 0) return false;
      }

      return true;
    });
  }, [aggregatedMaterials, searchTerm, filterVendor, filterType, statusFilter]);

  const getCategoryBadge = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('bo') || c.includes('bought')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">Bought Out</span>;
    }
    if (c.includes('consumable')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Consumable</span>;
    }
    if (c.includes('component')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Component</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Raw Material</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 size={10} /> Completed</span>;
      case 'Partially Received':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><Truck size={10} /> Partial</span>;
      case 'Approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800"><CheckCircle size={10} /> Approved</span>;
      case 'Released':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><Clock size={10} /> Released</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><Clock size={10} /> {status || 'Released'}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Secondary Filter Row: Status Tabs & Scope */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All Materials ({aggregatedMaterials.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Pending Receipt
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'completed' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Fully Received
            </button>
          </div>
        </div>

        {/* Scope Toggle: Items in POs vs All Catalog */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setScope('in-po')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scope === 'in-po' ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            In Outward POs
          </button>
          <button
            onClick={() => setScope('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scope === 'all' ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All Catalog Items
          </button>
        </div>
      </div>

      {/* Normal Standard Materials Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Materials Found</h3>
            <p className="text-xs text-slate-500 mt-1">No materials match the current search, vendor, or type filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3.5 text-center w-12">#</th>
                    <th className="px-4 py-3.5">Material Name & Description</th>
                    <th className="px-4 py-3.5 text-center">Type</th>
                    <th className="px-4 py-3.5 text-center">Unit</th>
                    <th className="px-4 py-3.5 text-right">Total Ordered</th>
                    <th className="px-4 py-3.5 text-right">Received</th>
                    <th className="px-4 py-3.5 text-right">Pending</th>
                    <th className="px-4 py-3.5 text-center">In POs</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {filteredMaterials.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedMaterialForPreview(item)}
                      className="hover:bg-purple-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Material Name & Technical Description (Strict Workspace Standard) */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {item.name || "Unnamed Material"}
                        </div>
                        {item.description ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-1">
                            {item.description}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                            No technical description
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {getCategoryBadge(item.category)}
                      </td>

                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {item.unit}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                        {item.totalOrderedQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                        {item.totalReceivedQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
                        {item.totalPendingQty.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {item.poCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <ShoppingCart size={12} /> {item.poCount} {item.poCount === 1 ? 'PO' : 'POs'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0 POs</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {item.poCount === 0 ? (
                          <span className="text-[11px] text-slate-400">No Orders</span>
                        ) : item.totalPendingQty === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={10} /> Received
                          </span>
                        ) : item.totalReceivedQty > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Truck size={10} /> {item.fulfillmentRate}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            <Clock size={10} /> Pending
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMaterialForPreview(item);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Eye size={13} /> Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-slate-800">
              {filteredMaterials.map((item) => (
                <div
                  key={`mob-${item.id}`}
                  onClick={() => setSelectedMaterialForPreview(item)}
                  className="p-4 space-y-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {item.name || "Unnamed Material"}
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 italic line-clamp-2 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 shrink-0">
                      {item.poCount} PO{item.poCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Ordered</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.totalOrderedQty} {item.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-emerald-500">Received</div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.totalReceivedQty} {item.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-amber-500">Pending</div>
                      <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{item.totalPendingQty} {item.unit}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {item.totalPendingQty === 0 && item.poCount > 0 ? "Fully Received" : `${item.fulfillmentRate}% Received`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMaterialForPreview(item);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs"
                    >
                      <Eye size={12} /> View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Clickable Preview Modal: Shows All Details & Outward POs for Selected Material */}
      {selectedMaterialForPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                  <Package size={20} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedMaterialForPreview.name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-normal border border-purple-500/30">
                      {selectedMaterialForPreview.poCount} Outward PO{selectedMaterialForPreview.poCount !== 1 ? 's' : ''}
                    </span>
                    {getCategoryBadge(selectedMaterialForPreview.category)}
                  </h2>
                  {selectedMaterialForPreview.description ? (
                    <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-2">
                      {selectedMaterialForPreview.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-0.5">
                      No technical description
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMaterialForPreview(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Material Aggregate Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Ordered</div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                    {selectedMaterialForPreview.totalOrderedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedMaterialForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Received</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {selectedMaterialForPreview.totalReceivedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedMaterialForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Balance</div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {selectedMaterialForPreview.totalPendingQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">{selectedMaterialForPreview.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Total PO Value</div>
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                    ₹{selectedMaterialForPreview.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {selectedMaterialForPreview.poCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Receipt Progress</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMaterialForPreview.fulfillmentRate}% Received</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        selectedMaterialForPreview.fulfillmentRate === 100 
                          ? 'bg-emerald-500' 
                          : 'bg-gradient-to-r from-purple-500 to-amber-500'
                      }`}
                      style={{ width: `${selectedMaterialForPreview.fulfillmentRate}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Outward Purchase Orders Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <ShoppingCart size={16} className="text-purple-600 dark:text-purple-400" />
                    <span>Outward Purchase Orders containing this material ({selectedMaterialForPreview.linkedPos.length}):</span>
                  </h3>
                </div>

                {selectedMaterialForPreview.linkedPos.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-400">This material item is not currently part of any Outward Purchase Order.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3.5 py-3">Outward PO #</th>
                          <th className="px-3.5 py-3">Vendor / Supplier</th>
                          <th className="px-3.5 py-3 text-center">PO Date</th>
                          <th className="px-3.5 py-3 text-right">Ordered Qty</th>
                          <th className="px-3.5 py-3 text-right">Received</th>
                          <th className="px-3.5 py-3 text-right">Pending</th>
                          <th className="px-3.5 py-3 text-right">Rate</th>
                          <th className="px-3.5 py-3 text-right">Total Amount</th>
                          <th className="px-3.5 py-3 text-center">Expected Delivery</th>
                          <th className="px-3.5 py-3 text-center">Status</th>
                          <th className="px-3.5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {selectedMaterialForPreview.linkedPos.map((lp, idx) => (
                          <tr key={`${lp.poId}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-3.5 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                              {lp.poNumber}
                            </td>

                            <td className="px-3.5 py-3 font-bold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                                <Building2 size={12} className="text-purple-500 shrink-0" />
                                <span className="truncate">{lp.vendorName}</span>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 text-center font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {lp.poDate ? new Date(lp.poDate).toLocaleDateString('en-GB') : '-'}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {lp.orderedQty.toLocaleString()} {lp.unit}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {lp.receivedQty.toLocaleString()} {lp.unit}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                              {lp.pendingQty.toLocaleString()} {lp.unit}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              ₹{lp.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              ₹{lp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-3.5 py-3 text-center font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {lp.expectedDeliveryDate ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Calendar size={11} className="text-slate-400" />
                                  <span>{new Date(lp.expectedDeliveryDate).toLocaleDateString('en-GB')}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="px-3.5 py-3 text-center">
                              {getStatusBadge(lp.status)}
                            </td>

                            <td className="px-3.5 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onViewPo(lp.po);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-600 dark:hover:text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Eye size={12} /> View PO
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedMaterialForPreview(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
