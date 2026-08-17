"use client";

import React, { useState } from 'react';
import BillingTable from "../../components/tables/BillingTable";
import BillingModal from "../../components/modals/BillingModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import Swal from "sweetalert2";

export default function SalesBillingPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: bills, loading, refetch, handleBillingSubmit, handleBillingUpdate, handleDelete, customers, fgItems, companyInfo } = useStoreData("billing", "customer", token);

  const [showModal, setShowModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invoice</h1>
          <p className="text-xs text-gray-500">Manage sales billing and tax invoices</p>
        </div>
        <button
          onClick={() => { setEditingBilling(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Invoice
        </button>
      </div>

      <BillingTable
        data={bills || []}
        companyInfo={companyInfo}
        onEdit={(b) => { setEditingBilling(b); setShowModal(true); }}
        onDelete={(id) => handleDelete(id)}
      />

      {showModal && (
        <BillingModal
          isOpen={showModal}
          loading={loading}
          customers={customers || []}
          fgItems={fgItems || []}
          inHouseItems={fgItems || []}
          onClose={() => { setShowModal(false); setEditingBilling(null); }}
          onSubmit={async (formData) => {
            try {
              if (editingBilling) {
                await handleBillingUpdate(editingBilling._id, formData);
              } else {
                await handleBillingSubmit(formData);
              }
              setShowModal(false);
              setEditingBilling(null);
              refetch();
            } catch (error: any) {
              console.error("Failed to save Tax Invoice:", error);
              const errorMsg = error?.data?.message || error?.response?.data?.message || error?.error || error?.message || (typeof error === 'string' ? error : "Failed to save Tax Invoice.");
              Swal.fire("Save Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg), "error");
            }
          }}
          initialData={editingBilling}
        />
      )}
    </div>
  );
}
