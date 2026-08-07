"use client";

import React, { useState } from 'react';
import POTable from "../../components/tables/POTable";
import POModal from "../../components/modals/POModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function PurchasePOPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: poList, vendors, materials, fgItems, loading, refetch, handlePOSubmit, handlePOUpdate, handleDelete } = useStoreData("po", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Purchase Orders (PO)</h1>
          <p className="text-xs text-gray-500">Manage vendor purchase orders and procurement</p>
        </div>
        <button
          onClick={() => { setEditingPO(null); setShowModal(true); }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create PO
        </button>
      </div>

      <POTable
        data={poList || []}
        onEdit={(po) => { setEditingPO(po); setShowModal(true); }}
        onDelete={(id) => handleDelete("po", id)}
      />

      {showModal && (
        <POModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingPO(null); }}
          vendors={vendors || []}
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
