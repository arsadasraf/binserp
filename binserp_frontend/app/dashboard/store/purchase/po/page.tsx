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
    <div className="w-full h-full flex-1 flex flex-col min-h-0">
      <POTable
        data={poList || []}
        vendors={vendors || []}
        materials={materials || []}
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
