"use client";

import React, { useState } from 'react';
import { 
  useGetStoreMRPsQuery, 
  useGetRMPlansQuery,
  usePlanRMRequirementMutation,
  usePlanProductionRequirementMutation,
  useUpdateRMPlanPOMutation,
  usePlanSingleRMRequirementMutation,
  useGetStoreDataQuery
} from "@/src/store/services/storeService";
import { Search, Calendar, User, Factory, Clock, Package, ShoppingCart, Loader2, Eye, X } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

type SubTab = "mrp-queue" | "rm-plan" | "production-plan";

export default function StoreMRPTab() {
  const { data: mrps = [], isLoading: loadingMRPs, refetch: refetchMRPs } = useGetStoreMRPsQuery();
  const { data: rmPlans = [], isLoading: loadingRMPlans, refetch: refetchRMPlans } = useGetRMPlansQuery();
  const { data: storeData } = useGetStoreDataQuery('vendor');
  const vendors = storeData?.data || [];
  
  const { data: inventoryData } = useGetStoreDataQuery('inventory');
  const inventories = inventoryData?.data || [];

  const [planRM] = usePlanRMRequirementMutation();
  const [planSingleRM] = usePlanSingleRMRequirementMutation();
  const [planProduction] = usePlanProductionRequirementMutation();
  const [updatePO] = useUpdateRMPlanPOMutation();

  const [currentTab, setCurrentTab] = useState<SubTab>("mrp-queue");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // Track ID for loading state
  const [previewItem, setPreviewItem] = useState<any>(null); // State for preview modal

  // State for PO update modal
  const [poModal, setPoModal] = useState<{ isOpen: boolean; planId: string; vendor: string; poQty: number | ''; poRef: string }>({
    isOpen: false,
    planId: '',
    vendor: '',
    poQty: '',
    poRef: ''
  });

  const handlePlanRM = async (id: string) => {
    setIsSubmitting(id);
    try {
      const res = await planRM(id).unwrap();
      alert(res.message);
      refetchMRPs();
      refetchRMPlans();
    } catch (err: any) {
      alert(err.data?.message || "Failed to explode BOM for RM Plan");
    } finally {
      setIsSubmitting(null);
    }
  };

  const handlePlanProduction = async (id: string) => {
    setIsSubmitting(id);
    try {
      const res = await planProduction(id).unwrap();
      alert(res.message);
      refetchMRPs();
    } catch (err: any) {
      alert(err.data?.message || "Failed to move to Production Plan");
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleUpdatePO = async () => {
    if (!poModal.vendor || !poModal.poQty || !poModal.poRef) {
      alert("Please fill all fields.");
      return;
    }
    try {
      await updatePO({ 
        id: poModal.planId, 
        vendor: poModal.vendor, 
        poQuantity: Number(poModal.poQty), 
        poReference: poModal.poRef 
      }).unwrap();
      alert("PO Details updated successfully!");
      setPoModal(prev => ({ ...prev, isOpen: false }));
      refetchRMPlans();
    } catch (err: any) {
      alert(err.data?.message || "Failed to update PO details");
    }
  };

  const handlePlanSingleRM = async (mrpId: string, itemId: string, requiredQuantity: number) => {
    setIsSubmitting(itemId);
    try {
      await planSingleRM({ id: mrpId, itemId, requiredQuantity }).unwrap();
      refetchMRPs();
      refetchRMPlans();
    } catch (err: any) {
      alert(err.data?.message || "Failed to push item to RM Plan");
    } finally {
      setIsSubmitting(null);
    }
  };

  if (loadingMRPs || loadingRMPlans) return <LoadingSpinner />;

  // Filter logic based on tabs
  // MRP Queue shows ALL requirements now, Production Planning shows only Production Planned
  const productionMRPs = mrps.filter((m: any) => m.status === "Production Planned");

  const filterBySearch = (arr: any[]) => arr.filter((item: any) => 
    item.storeOrder?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.fgItem?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.rmBoItem?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
        <button
          onClick={() => setCurrentTab("mrp-queue")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${currentTab === "mrp-queue"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
        >
          <Factory size={16} /> MRP Queue
        </button>
        <button
          onClick={() => setCurrentTab("rm-plan")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${currentTab === "rm-plan"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
        >
          <Package size={16} /> RM/BO Planning
        </button>
        <button
          onClick={() => setCurrentTab("production-plan")}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${currentTab === "production-plan"
            ? "bg-indigo-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
        >
          <Factory size={16} /> Production Planning
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Order No or Item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        
        {/* MRP Queue & Production Planning views share similar structure */}
        {(currentTab === "mrp-queue" || currentTab === "production-plan") && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Source Order</th>
                  <th className="px-6 py-4">FG Item</th>
                  <th className="px-6 py-4 text-center">Required Qty</th>
                  <th className="px-6 py-4">Timeline</th>
                  {currentTab === "mrp-queue" && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filterBySearch(currentTab === "mrp-queue" ? mrps : productionMRPs).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No requirements found in this queue.
                    </td>
                  </tr>
                ) : (
                  filterBySearch(currentTab === "mrp-queue" ? mrps : productionMRPs).map((m: any) => (
                    <tr 
                      key={m._id} 
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setPreviewItem(m)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {m.storeOrder?.orderNumber || "Manual Requirement"}
                        </div>
                        {m.storeOrder?.customerName && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <User size={12} /> {m.storeOrder.customerName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          {m.fgItem?.name}
                        </div>
                        <div className="text-xs text-gray-500">{m.fgItem?.code}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-lg text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                          {m.requiredQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="font-medium">Due:</span> {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "N/A"}
                          </div>
                        </div>
                      </td>
                      {currentTab === "mrp-queue" && (
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {m.status === "RM Planned" || m.status === "Production Planned" ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              m.status === "RM Planned" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-indigo-100 text-indigo-700 border-indigo-200"
                            }`}>
                              {m.status}
                            </span>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePlanRM(m._id); }}
                                disabled={isSubmitting === m._id}
                                className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSubmitting === m._id ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                                Plan All RM
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePlanProduction(m._id); }}
                                disabled={isSubmitting === m._id}
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSubmitting === m._id ? <Loader2 size={14} className="animate-spin" /> : <Factory size={14} />}
                                Production Planning
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* RM Planning View */}
        {currentTab === "rm-plan" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">RM/BO Item</th>
                  <th className="px-6 py-4 text-center">Required Qty</th>
                  <th className="px-6 py-4">Timeline</th>
                  <th className="px-6 py-4">PO Details</th>
                  <th className="px-6 py-4 text-right">Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filterBySearch(rmPlans).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No RM/BO planning requirements found.
                    </td>
                  </tr>
                ) : (
                  filterBySearch(rmPlans).map((p: any) => (
                    <tr key={p._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{p.rmBoItem?.name}</div>
                        <div className="text-xs text-gray-500">{p.rmBoItem?.code}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-lg text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                          {p.requiredQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="font-medium">Due:</span> {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {p.status === "PO Created" ? (
                          <div className="text-xs space-y-1">
                            <div><span className="font-medium text-gray-500">Vendor:</span> {p.vendor?.vendorName}</div>
                            <div><span className="font-medium text-gray-500">PO Ref:</span> {p.poReference}</div>
                            <div><span className="font-medium text-gray-500">Qty:</span> {p.poQuantity}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not Assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === "Pending" ? (
                           <button
                             onClick={() => setPoModal({ isOpen: true, planId: p._id, vendor: '', poQty: p.requiredQuantity, poRef: '' })}
                             className="px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-end gap-1 ml-auto"
                           >
                             <ShoppingCart size={14} /> Add PO Details
                           </button>
                        ) : (
                           <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200">
                             PO Created
                           </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PO Details Modal */}
      {poModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <ShoppingCart className="text-green-500" /> Enter PO Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select
                  value={poModal.vendor}
                  onChange={(e) => setPoModal(prev => ({ ...prev, vendor: e.target.value }))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select Vendor...</option>
                  {vendors.map((v: any) => (
                    <option key={v._id} value={v._id}>{v.vendorName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. PO-2023-001"
                  value={poModal.poRef}
                  onChange={(e) => setPoModal(prev => ({ ...prev, poRef: e.target.value }))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Quantity</label>
                <input
                  type="number"
                  value={poModal.poQty}
                  onChange={(e) => setPoModal(prev => ({ ...prev, poQty: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setPoModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePO}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="text-indigo-500" /> BOM Preview: {previewItem.fgItem?.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Required Quantity: <span className="font-bold text-indigo-600">{previewItem.requiredQuantity}</span> units
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-3">Component / Material</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">BOM Qty</th>
                        <th className="px-4 py-3 text-right">Total Req Qty</th>
                        <th className="px-4 py-3 text-right">Avail Stock</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {previewItem.fgItem?.bom?.map((b: any, idx: number) => {
                        const totalQty = b.quantity * previewItem.requiredQuantity;
                        const isMaterial = b.itemType === "Material";
                        
                        // Find closing stock if material
                        let availableStock = 0;
                        if (isMaterial) {
                          const invItem = inventories.find((inv: any) => inv.material?._id === (b.item?._id || b.item) || inv.material === (b.item?._id || b.item));
                          if (invItem) availableStock = invItem.closingStock;
                        }

                        // Check if already planned
                        const isPlanned = rmPlans.some((p: any) => p.sourceMRP?._id === previewItem._id && (p.rmBoItem?._id === (b.item?._id || b.item) || p.rmBoItem === (b.item?._id || b.item)));

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {b.item?.name || b.itemName || "Unknown"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                isMaterial ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-purple-100 text-purple-700 border border-purple-200"
                              }`}>
                                {b.itemType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {b.quantity}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-indigo-600">
                              {totalQty}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">
                              {isMaterial ? availableStock : "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isMaterial ? (
                                isPlanned ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-semibold">Planned</span>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePlanSingleRM(previewItem._id, b.item?._id || b.item, totalQty); }}
                                    disabled={isSubmitting === (b.item?._id || b.item)}
                                    className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 ml-auto"
                                  >
                                    {isSubmitting === (b.item?._id || b.item) ? <Loader2 size={12} className="animate-spin" /> : "Move to RM Plan"}
                                  </button>
                                )
                              ) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(!previewItem.fgItem?.bom || previewItem.fgItem?.bom?.length === 0) && (
                    <div className="p-8 text-center text-gray-500">
                      No components found in the BOM for this item.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
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
