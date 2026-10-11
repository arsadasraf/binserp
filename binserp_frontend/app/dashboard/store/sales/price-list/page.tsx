"use client";

import React, { useState } from 'react';
import PriceListTable from "../../components/tables/PriceListTable";
import PriceListModal from "../../components/modals/PriceListModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import { useCreateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";
import { showDestructiveConfirm, showSuccessToast, showErrorDialog } from "@/src/features/store/utils/storeDialogHelper";

export default function SalesPriceListPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { priceLists, fgItems, loading, refetch } = useStoreData("price-list", "vendor", token);
  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PriceListTable
        priceLists={priceLists || []}
        fgItems={fgItems || []}
        onAddPriceList={() => { setEditingItem(null); setShowModal(true); }}
        onEdit={(item) => { setEditingItem(item); setShowModal(true); }}
        onDelete={async (id) => {
          const confirmed = await showDestructiveConfirm({
            title: "Delete Price List Entry",
            text: "Are you sure you want to delete this price list entry? This action cannot be undone.",
            confirmButtonText: "Yes, Delete"
          });
          if (confirmed) {
            try {
              await deleteStoreRecord({ tab: "price-list", id }).unwrap();
              showSuccessToast("Price list entry deleted successfully");
              refetch();
            } catch (err: any) {
              await showErrorDialog("Delete Failed", err?.data?.message || err?.message || "Failed to delete price list entry");
            }
          }
        }}
      />

      {showModal && (
        <PriceListModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          fgItems={fgItems || []}
          priceLists={priceLists || []}
          onSubmit={async (formData) => {
            try {
              await createStoreRecord({ tab: "price-list", body: formData }).unwrap();
              showSuccessToast("Price List saved successfully");
              setShowModal(false);
              setEditingItem(null);
              refetch();
            } catch (err: any) {
              console.error("Failed to save Price List", err);
              await showErrorDialog("Save Error", err?.data?.message || err?.message || "Failed to save Price List");
            }
          }}
          initialData={editingItem}
        />
      )}
    </div>
  );
}
