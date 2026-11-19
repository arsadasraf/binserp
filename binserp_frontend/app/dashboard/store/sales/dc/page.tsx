"use client";

import React, { useState } from 'react';
import DCTable from "../../components/tables/DCTable";
import DCModal from "../../components/modals/DCModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

import Swal from "sweetalert2";

export default function SalesDCPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: dcList, loading, refetch, handleDCSubmit, handleDCUpdate, handleDelete, customers, fgItems, companyInfo } = useStoreData("dc", "customer", token);

  const [showModal, setShowModal] = useState(false);
  const [editingDC, setEditingDC] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <DCTable
        data={dcList || []}
        companyInfo={companyInfo}
        onCreateDC={() => { setEditingDC(null); setShowModal(true); }}
        onEdit={(dc) => { setEditingDC(dc); setShowModal(true); }}
        onDelete={(id) => handleDelete(id, true)}
      />

      {showModal && (
        <DCModal
          isOpen={showModal}
          isEditing={!!editingDC}
          loading={loading}
          customers={customers || []}
          inHouseItems={fgItems || []}
          fgItems={fgItems || []}
          companyInfo={companyInfo}
          onClose={() => { setShowModal(false); setEditingDC(null); }}
          onSubmit={async (formData) => {
            try {
              if (editingDC) {
                await handleDCUpdate(editingDC._id, formData);
              } else {
                await handleDCSubmit(formData);
              }
              setShowModal(false);
              setEditingDC(null);
              refetch();
              return { ok: true };
            } catch (error: any) {
              const rawMsg = error?.data?.message || error?.response?.data?.message || error?.error || error?.message || "Failed to save Delivery Challan. Please verify server connection.";
              const errorMsg = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
              console.warn("Delivery Challan validation/save error:", errorMsg);
              Swal.fire({
                icon: "error",
                title: "Cannot Save Delivery Challan",
                text: errorMsg,
                confirmButtonColor: "#4f46e5"
              });
              return { error: errorMsg };
            }
          }}
          initialData={editingDC}
        />
      )}
    </div>
  );
}
