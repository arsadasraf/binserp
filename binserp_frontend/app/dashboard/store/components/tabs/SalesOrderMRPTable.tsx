"use client";

import React, { useState } from 'react';
import { useGetStoreMRPsQuery } from "@/src/store/services/storeService";
import { Package, Search, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function SalesOrderMRPTable() {
  const { data: mrps = [], isLoading } = useGetStoreMRPsQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredMRPs = mrps.filter((mrp: any) => 
    mrp.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mrp.salesOrder?.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="text-blue-500" />
            Material Requirements (Sales Orders)
          </h2>
          <p className="text-sm text-gray-500 mt-1">View RM/BO items required for specific sales orders.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search Order No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        {filteredMRPs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No material requirements found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-10"></th>
                  <th className="px-6 py-4">Sales Order No.</th>
                  <th className="px-6 py-4">Target Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Items Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredMRPs.map((mrp: any) => (
                  <React.Fragment key={mrp._id}>
                    <tr 
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(mrp._id)}
                    >
                      <td className="px-6 py-4 text-gray-400">
                        {expandedRows[mrp._id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {mrp.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {mrp.targetDate ? new Date(mrp.targetDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          mrp.status === 'Completed' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {mrp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-600 dark:text-gray-400">
                        {mrp.items?.length || 0}
                      </td>
                    </tr>
                    
                    {/* Expanded Items Section */}
                    {expandedRows[mrp._id] && (
                      <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                        <td colSpan={5} className="p-0 border-b border-gray-100 dark:border-gray-800">
                          <div className="px-16 py-6 space-y-4">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Required RM/BO Items</h4>
                            {(!mrp.items || mrp.items.length === 0) ? (
                              <p className="text-sm text-gray-500">No raw materials required for this order.</p>
                            ) : (
                              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500">
                                    <tr>
                                      <th className="px-4 py-3">Item Name</th>
                                      <th className="px-4 py-3 text-right">Required Qty</th>
                                      <th className="px-4 py-3 text-right">Stock Available</th>
                                      <th className="px-4 py-3 text-right">Shortage</th>
                                      <th className="px-4 py-3 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                                    {mrp.items.map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                          {item.materialName}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                                          {item.requiredQuantity}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                                          {item.stockAvailable}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                          <span className={item.shortage > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                                            {item.shortage}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {item.shortage > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-medium">
                                              <AlertCircle size={12} /> Pending
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium">
                                              <CheckCircle size={12} /> Fulfilled
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
