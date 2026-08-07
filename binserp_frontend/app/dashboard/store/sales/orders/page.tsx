"use client";

import React, { useState } from 'react';
import POTable from "../../components/tables/POTable";
import POModal from "../../components/modals/POModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function SalesOrdersPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: poList, vendors, customers, materials, fgItems, loading, refetch, handlePOSubmit, handlePOUpdate, handleDelete } = useStoreData("order-entry", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sales Orders</h1>
          <p className="text-xs text-gray-500">Manage customer purchase orders and sales entries</p>
        </div>
        <button
          onClick={() => { setEditingPO(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Order
        </button>
      </div>

      <POTable
        data={poList || []}
        onEdit={(po) => { setEditingPO(po); setShowModal(true); }}
        onDelete={(id) => handleDelete("order-entry", id)}
      />

      {showModal && (
        <POModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingPO(null); }}
          vendors={vendors?.length ? vendors : (customers || [])}
          materials={materials || []}
          inHouseItems={fgItems || []}
          onSubmit={async (formData) => {
            if (editingPO) {
              await handlePOUpdate(editingPO._id, formData);
            } else {
              await handlePOSubmit(formData);
            }
            setShowModal(false);
            setEditingPO(null);
            refetch();
          }}
          initialData={editingPO}
        />
      )}
    </div>
  );
}
