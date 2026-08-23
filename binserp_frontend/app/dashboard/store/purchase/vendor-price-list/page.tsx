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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
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
            await deleteStoreRecord({ tab: "vendor-price-list", id }).unwrap();
            refetch();
          }
        }}
      />

      {/* Price List Modal */}
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
