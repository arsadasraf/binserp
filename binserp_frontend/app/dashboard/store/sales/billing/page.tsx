"use client";

import React, { useState } from 'react';
import BillingTable from "../../components/tables/BillingTable";
import BillingModal from "../../components/modals/BillingModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";
import Swal from "sweetalert2";

export default function SalesBillingPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: bills, loading, refetch, handleBillingSubmit, handleBillingUpdate, handleDelete, customers, fgItems, companyInfo } = useStoreData("billing", "customer", token);

  const [showModal, setShowModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <BillingTable
        data={bills || []}
        companyInfo={companyInfo}
        onAddBill={() => { setEditingBilling(null); setShowModal(true); }}
        addLabel="Create Invoice"
        onEdit={(b) => { setEditingBilling(b); setShowModal(true); }}
        onDelete={(id) => handleDelete(id)}
      />

      {showModal && (
        <BillingModal
          isOpen={showModal}
          loading={loading}
          customers={customers || []}
          fgItems={fgItems || []}
          inHouseItems={fgItems || []}
          onClose={() => { setShowModal(false); setEditingBilling(null); }}
          onSubmit={async (formData) => {
            try {
              if (editingBilling) {
                await handleBillingUpdate(editingBilling._id, formData);
              } else {
                await handleBillingSubmit(formData);
              }
              setShowModal(false);
              setEditingBilling(null);
              refetch();
            } catch (error: any) {
              console.error("Failed to save Tax Invoice:", error);
              const errorMsg = error?.data?.message || error?.response?.data?.message || error?.error || error?.message || (typeof error === 'string' ? error : "Failed to save Tax Invoice.");
              Swal.fire("Save Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg), "error");
            }
          }}
          initialData={editingBilling}
        />
      )}
    </div>
  );
}
