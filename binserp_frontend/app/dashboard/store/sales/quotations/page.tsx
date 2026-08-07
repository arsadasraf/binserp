"use client";

import React, { useState } from 'react';
import QuotationTable from "../../components/tables/QuotationTable";
import QuotationModal from "../../components/modals/QuotationModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function SalesQuotationsPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { quotations, loading, refetch, handleQuotationSubmit, handleQuotationUpdate, handleDelete } = useStoreData("quotation", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Quotations</h1>
          <p className="text-xs text-gray-500">Create and manage customer quotations</p>
        </div>
        <button
          onClick={() => { setEditingQuotation(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Quotation
        </button>
      </div>

      <QuotationTable
        data={quotations || []}
        onEdit={(q) => { setEditingQuotation(q); setShowModal(true); }}
        onDelete={(id) => handleDelete("quotation", id)}
      />

      {showModal && (
        <QuotationModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingQuotation(null); }}
          onSubmit={async (formData) => {
            if (editingQuotation) {
              await handleQuotationUpdate(editingQuotation._id, formData);
            } else {
              await handleQuotationSubmit(formData);
            }
            setShowModal(false);
            setEditingQuotation(null);
            refetch();
          }}
          initialData={editingQuotation}
        />
      )}
    </div>
  );
}
