"use client";

import React, { useState } from 'react';
import VendorPriceListTable from "../../components/tables/VendorPriceListTable";
import VendorPriceListModal from "../../components/modals/VendorPriceListModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import { useCreateStoreRecordMutation, useUpdateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";

export default function PurchaseVendorPriceListPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { vendorPriceLists, materials, loading, refetch, vendors } = useStoreData("vendor-price-list", "vendor", token);
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">RM/BO Price List</h1>
          <p className="text-xs text-gray-500 font-medium">Master price list for Raw Materials & Bought-Out items across vendors</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setShowModal(true); }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add RM/BO Price Sheet
        </button>
      </div>

      <VendorPriceListTable
        vendorPriceLists={vendorPriceLists || []}
        materials={materials || []}
        onEdit={(item) => { setEditingItem(item); setShowModal(true); }}
        onDelete={async (id) => {
          if (confirm("Are you sure you want to delete this vendor price list?")) {
            await deleteStoreRecord({ tab: "vendor-price-list", id }).unwrap();
            refetch();
          }
        }}
      />

      {showModal && (
        <VendorPriceListModal
          isOpen={showModal}
          materials={materials || []}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSubmit={async (formData) => {
            if (editingItem && editingItem._id) {
              await updateStoreRecord({ tab: "vendor-price-list", id: editingItem._id, body: formData }).unwrap();
            } else {
              await createStoreRecord({ tab: "vendor-price-list", body: formData }).unwrap();
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
