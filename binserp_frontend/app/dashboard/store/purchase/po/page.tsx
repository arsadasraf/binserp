"use client";

import React, { useState } from 'react';
import POTable from "@/src/features/store/components/tables/POTable";
import POModal from "../../components/modals/POModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function PurchasePOPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: poList, vendors, materials, fgItems, vendorPriceLists, companyInfo, loading, refetch, handlePOSubmit, handlePOUpdate, handleDelete } = useStoreData("po", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <POTable
        data={poList || []}
        vendors={vendors || []}
        companyInfo={companyInfo}
        onCreatePO={() => { setEditingPO(null); setShowModal(true); }}
        onEdit={(po) => { setEditingPO(po); setShowModal(true); }}
        onDelete={(id) => handleDelete(id)}
      />

      {showModal && (
        <POModal
          isOpen={showModal}
          loading={loading}
          onClose={() => { setShowModal(false); setEditingPO(null); }}
          vendors={vendors || []}
          materials={materials || []}
          inHouseItems={fgItems || []}
          priceLists={vendorPriceLists || []}
          onSubmit={async (formData) => {
            if (editingPO) {
              await handlePOUpdate(editingPO._id, formData);
            } else {
              await handlePOSubmit(formData);
            }
            setShowModal(false);
            setEditingPO(null);
            refetch();
          }}
          initialData={editingPO}
          isEditing={Boolean(editingPO)}
        />
      )}
    </div>
  );
}
