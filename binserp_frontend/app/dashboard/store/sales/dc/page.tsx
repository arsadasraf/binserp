"use client";

import React, { useState } from 'react';
import DCTable from "../../components/tables/DCTable";
import DCModal from "../../components/modals/DCModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

import Swal from "sweetalert2";

export default function SalesDCPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: dcList, loading, refetch, handleDCSubmit, handleDCUpdate, handleDelete, customers, fgItems } = useStoreData("dc", "customer", token);

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
        onDelete={(id) => handleDelete(id)}
      />

      {showModal && (
        <DCModal
          isOpen={showModal}
          loading={loading}
          customers={customers || []}
          inHouseItems={fgItems || []}
          fgItems={fgItems || []}
          onClose={() => { setShowModal(false); setEditingDC(null); }}
          onSubmit={async (formData) => {
            try {
              if (editingDC) {
                await handleDCUpdate(editingDC._id, formData);
              } else {
                await handleDCSubmit(formData);
              }
              setShowModal(false);
              setEditingDC(null);
              refetch();
            } catch (error: any) {
              console.error("Failed to save DC:", error);
              const errorMsg = error?.data?.message || error?.error || error?.message || "Failed to save Delivery Challan. Please verify server connection.";
              Swal.fire("Save Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg), "error");
            }
          }}
          initialData={editingDC}
        />
      )}
    </div>
  );
}
