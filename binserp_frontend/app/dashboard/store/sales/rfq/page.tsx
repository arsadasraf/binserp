"use client";

import React, { useState } from 'react';
import { IncomingRFQTable } from "../../components/IncomingRFQTable";
import { IncomingRFQForm } from "../../components/IncomingRFQForm";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import { useCreateStoreRecordMutation, useUpdateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";

export default function SalesRFQPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: rfqList, fgItems, loading, refetch } = useStoreData("incoming-rfq", "vendor", token);
  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [updateStoreRecord] = useUpdateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingRFQ, setEditingRFQ] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Incoming RFQ</h1>
          <p className="text-xs text-gray-500">Manage incoming requests for quotations from customers</p>
        </div>
        <button
          onClick={() => { setEditingRFQ(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create RFQ
        </button>
      </div>

      <IncomingRFQTable
        rfqs={rfqList || []}
        fgItems={fgItems || []}
        onEdit={(rfq) => { setEditingRFQ(rfq); setShowModal(true); }}
        onDelete={async (id) => {
          if (confirm("Are you sure you want to delete this RFQ?")) {
            await deleteStoreRecord({ tab: "incoming-rfq", id }).unwrap();
            refetch();
          }
        }}
      />

      {showModal && (
        <IncomingRFQForm
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingRFQ(null); }}
          onSubmit={async (formData) => {
            if (editingRFQ) {
              await updateStoreRecord({ tab: "incoming-rfq", id: editingRFQ._id, body: formData }).unwrap();
            } else {
              await createStoreRecord({ tab: "incoming-rfq", body: formData }).unwrap();
            }
            setShowModal(false);
            setEditingRFQ(null);
            refetch();
          }}
          initialData={editingRFQ}
        />
      )}
    </div>
  );
}
