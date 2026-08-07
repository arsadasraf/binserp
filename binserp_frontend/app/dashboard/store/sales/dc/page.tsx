"use client";

import React, { useState } from 'react';
import DCTable from "../../components/tables/DCTable";
import DCModal from "../../components/modals/DCModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function SalesDCPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: dcList, loading, refetch, handleDCSubmit, handleDCUpdate, handleDelete } = useStoreData("dc", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingDC, setEditingDC] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Delivery Challans (DC)</h1>
          <p className="text-xs text-gray-500">Manage dispatch and delivery challans</p>
        </div>
        <button
          onClick={() => { setEditingDC(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create DC
        </button>
      </div>

      <DCTable
        data={dcList || []}
        onEdit={(dc) => { setEditingDC(dc); setShowModal(true); }}
        onDelete={(id) => handleDelete("dc", id)}
      />

      {showModal && (
        <DCModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingDC(null); }}
          onSubmit={async (formData) => {
            if (editingDC) {
              await handleDCUpdate(editingDC._id, formData);
            } else {
              await handleDCSubmit(formData);
            }
            setShowModal(false);
            setEditingDC(null);
            refetch();
          }}
          initialData={editingDC}
        />
      )}
    </div>
  );
}
