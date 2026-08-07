"use client";

import React, { useState } from 'react';
import PriceListTable from "../../components/tables/PriceListTable";
import PriceListModal from "../../components/modals/PriceListModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import { useCreateStoreRecordMutation, useUpdateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";

export default function SalesPriceListPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { priceLists, fgItems, loading, refetch } = useStoreData("price-list", "vendor", token);
  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [updateStoreRecord] = useUpdateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Customer Price List</h1>
          <p className="text-xs text-gray-500">Manage customer item pricing and discount lists</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Price List
        </button>
      </div>

      <PriceListTable
        priceLists={priceLists || []}
        fgItems={fgItems || []}
        onEdit={(item) => { setEditingItem(item); setShowModal(true); }}
        onDelete={async (id) => {
          if (confirm("Are you sure you want to delete this price list?")) {
            await deleteStoreRecord({ tab: "price-list", id }).unwrap();
            refetch();
          }
        }}
      />

      {showModal && (
        <PriceListModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSubmit={async (formData) => {
            if (editingItem) {
              await updateStoreRecord({ tab: "price-list", id: editingItem._id, body: formData }).unwrap();
            } else {
              await createStoreRecord({ tab: "price-list", body: formData }).unwrap();
            }
            setShowModal(false);
            setEditingItem(null);
            refetch();
          }}
          initialData={editingItem}
        />
      )}
    </div>
  );
}
