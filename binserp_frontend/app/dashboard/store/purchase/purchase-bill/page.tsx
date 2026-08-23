"use client";

import React, { useState } from 'react';
import BillingTable from "../../components/tables/BillingTable";
import BillingModal from "../../components/modals/BillingModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus } from "lucide-react";

export default function PurchaseBillPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: bills, loading, refetch, handleBillingSubmit, handleBillingUpdate, handleDelete, vendors, customers } = useStoreData("purchase-bill", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingBilling, setEditingBilling] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <BillingTable
        data={bills || []}
        onAddBill={() => { setEditingBilling(null); setShowModal(true); }}
        addLabel="Add Purchase Bill"
        onEdit={(b) => { setEditingBilling(b); setShowModal(true); }}
        onDelete={(id) => handleDelete(id)}
      />

      {showModal && (
        <BillingModal
          isOpen={showModal}
          loading={loading}
          customers={vendors || customers || []}
          onClose={() => { setShowModal(false); setEditingBilling(null); }}
          onSubmit={async (formData) => {
            if (editingBilling) {
              await handleBillingUpdate(editingBilling._id, formData);
            } else {
              await handleBillingSubmit(formData);
            }
            setShowModal(false);
            setEditingBilling(null);
            refetch();
          }}
          initialData={editingBilling}
        />
      )}
    </div>
  );
}
