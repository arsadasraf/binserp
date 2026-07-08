"use client";

import React, { useState } from 'react';
import { useGetStoreMRPsQuery } from "@/src/store/services/storeService";
import { Search, Calendar, User, Factory, Clock } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function StoreMRPTab() {
  const { data: mrps = [], isLoading } = useGetStoreMRPsQuery();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = mrps.filter((m: any) =>
    m.storeOrder?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.fgItem?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
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

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Source Order</th>
                <th className="px-6 py-4">Item Required</th>
                <th className="px-6 py-4 text-center">Required Qty</th>
                <th className="px-6 py-4">Timeline</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 flex flex-col items-center justify-center">
                    <Factory className="w-12 h-12 text-gray-300 mb-3" />
                    <p>No MRP requirements generated yet.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((m: any) => (
                  <tr key={m._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {m.storeOrder?.orderNumber || "Manual Requirement"}
                      </div>
                      {m.storeOrder?.customerName && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <User size={12} />
                          {m.storeOrder.customerName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{m.fgItem?.name}</div>
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
                          <span className="font-medium">Due:</span> 
                          {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "N/A"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-gray-400" />
                          <span className="font-medium">Created:</span> 
                          {new Date(m.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`w-fit px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        m.status === 'Sent to Production' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {m.status}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
