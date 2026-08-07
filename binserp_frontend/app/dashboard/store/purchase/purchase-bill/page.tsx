"use client";

import React, { useState } from 'react';
import BillingTable from "../../components/tables/BillingTable";
import BillingModal from "../../components/modals/BillingModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function PurchaseBillPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: bills, loading, refetch, handleBillingSubmit, handleBillingUpdate, handleDelete } = useStoreData("purchase-bill", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Purchase Bills</h1>
          <p className="text-xs text-gray-500">Manage vendor purchase bills and invoices</p>
        </div>
        <button
          onClick={() => { setEditingBilling(null); setShowModal(true); }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Purchase Bill
        </button>
      </div>

      <BillingTable
        data={bills || []}
        onEdit={(b) => { setEditingBilling(b); setShowModal(true); }}
        onDelete={(id) => handleDelete("purchase-bill", id)}
      />

      {showModal && (
        <BillingModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingBilling(null); }}
          onSubmit={async (formData) => {
            if (editingBilling) {
              await handleBillingUpdate(editingBilling._id, formData);
            } else {
              await handleBillingSubmit(formData);
            }
            setShowModal(false);
            setEditingBilling(null);
            refetch();
          }}
          initialData={editingBilling}
        />
      )}
    </div>
  );
}
