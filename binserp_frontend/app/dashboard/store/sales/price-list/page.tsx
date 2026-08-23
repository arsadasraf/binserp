"use client";

import React, { useState } from 'react';
import PriceListTable from "../../components/tables/PriceListTable";
import PriceListModal from "../../components/modals/PriceListModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import { useCreateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";

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
          if (confirm("Are you sure you want to delete this price list entry?")) {
            await deleteStoreRecord({ tab: "price-list", id }).unwrap();
            refetch();
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
              setShowModal(false);
              setEditingItem(null);
              refetch();
            } catch (err: any) {
              console.error("Failed to save Price List", err);
              alert(err?.data?.message || err?.message || "Failed to save Price List");
            }
          }}
          initialData={editingItem}
        />
      )}
    </div>
  );
}
