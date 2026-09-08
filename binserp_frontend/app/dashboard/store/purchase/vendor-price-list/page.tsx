"use client";

import React, { useState } from 'react';
import VendorPriceListTable from "../../components/tables/VendorPriceListTable";
import VendorPriceListModal from "../../components/modals/VendorPriceListModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus, Tag } from "lucide-react";
import { useCreateStoreRecordMutation, useUpdateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";

export default function PurchaseVendorPriceListPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const {
    vendorPriceLists,
    rawMaterials,
    boughtOuts,
    consumables,
    materials,
    loading,
    refetch,
    vendors
  } = useStoreData("vendor-price-list", "vendor", token);

  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [updateStoreRecord] = useUpdateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Visual Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs border animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:opacity-80 cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Segmented Table with 3-Way Category Filtering */}
      <VendorPriceListTable
        vendorPriceLists={vendorPriceLists || []}
        rawMaterials={rawMaterials || []}
        boughtOuts={boughtOuts || []}
        consumables={consumables || []}
        materials={materials || []}
        onAddPriceSheet={() => { setEditingItem(null); setShowModal(true); }}
        onEdit={(item) => { setEditingItem(item); setShowModal(true); }}
        onDelete={async (id) => {
          if (confirm("Are you sure you want to delete this vendor price list configuration?")) {
            try {
              await deleteStoreRecord({ tab: "vendor-price-list", id }).unwrap();
              showFeedback('success', 'Price configuration deleted successfully.');
              refetch();
            } catch (err: any) {
              const errorMsg = err?.data?.message || err?.message || 'Failed to delete price configuration.';
              showFeedback('error', errorMsg);
            }
          }
        }}
      />

      {/* Price List Modal */}
      {showModal && (
        <VendorPriceListModal
          isOpen={showModal}
          materials={materials || []}
          rawMaterials={rawMaterials || []}
          boughtOuts={boughtOuts || []}
          consumables={consumables || []}
          vendors={vendors || []}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSubmit={async (formData) => {
            try {
              if (editingItem && editingItem._id) {
                await updateStoreRecord({ tab: "vendor-price-list", id: editingItem._id, body: formData }).unwrap();
              } else {
                await createStoreRecord({ tab: "vendor-price-list", body: formData }).unwrap();
              }
              setShowModal(false);
              setEditingItem(null);
              showFeedback('success', 'Price list configuration saved successfully!');
              refetch();
            } catch (err) {
              // Re-throw so the modal catches it, displays the error message, and does NOT close silently
              throw err;
            }
          }}
          initialData={editingItem}
        />
      )}
    </div>
  );
}
