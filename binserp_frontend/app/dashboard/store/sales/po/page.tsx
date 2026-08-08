"use client";

import React, { useState } from 'react';
import { IncomingPOTable } from "../../components/IncomingPOTable";
import { IncomingPOForm } from "../../components/IncomingPOForm";
import { IncomingPODetailsModal } from "../../components/IncomingPODetailsModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Plus, ShoppingCart } from "lucide-react";
import {
  useCreateStoreRecordMutation,
  useUpdateStoreRecordMutation,
  useDeleteStoreRecordMutation,
  useGenerateSalesOrderFromPOMutation,
} from "@/src/store/services/storeService";

export default function SalesInwardPOPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: poList, customers, fgItems, priceLists, companyInfo, loading, refetch } = useStoreData("incoming-po", "vendor", token);

  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [updateStoreRecord] = useUpdateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();
  const [generateSalesOrder, { isLoading: isGenerating }] = useGenerateSalesOrderFromPOMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);
  const [viewingPO, setViewingPO] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) return <LoadingSpinner />;

  const handleGenerateOrder = async (id: string) => {
    try {
      await generateSalesOrder(id).unwrap();
      alert("Sales order generated successfully from Inward PO!");
      refetch();
    } catch (error: any) {
      console.error("Failed to generate sales order:", error);
      alert(error?.data?.message || error?.message || "Failed to generate sales order");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete Inward PO "${name}"?`)) {
      try {
        await deleteStoreRecord({ tab: "incoming-po", id }).unwrap();
        refetch();
      } catch (error: any) {
        console.error("Failed to delete PO:", error);
        alert(error?.data?.message || error?.message || "Failed to delete PO");
      }
    }
  };

  return (
    <div className="space-y-4">
      <IncomingPOTable
        pos={poList || []}
        customers={customers || []}
        onCreate={() => { setEditingPO(null); setShowModal(true); }}
        onEdit={(po) => { setEditingPO(po); setShowModal(true); }}
        onView={(po) => { setViewingPO(po); }}
        onDelete={handleDelete}
        onGenerateOrder={handleGenerateOrder}
        isGeneratingOrder={isGenerating}
      />

      {showModal && (
        <IncomingPOForm
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingPO(null); }}
          onCancel={() => { setShowModal(false); setEditingPO(null); }}
          onSubmit={async (formData) => {
            try {
              setIsSubmitting(true);
              if (editingPO) {
                await updateStoreRecord({ tab: "incoming-po", id: editingPO._id, body: formData }).unwrap();
              } else {
                await createStoreRecord({ tab: "incoming-po", body: formData }).unwrap();
              }
              setShowModal(false);
              setEditingPO(null);
              refetch();
            } catch (error: any) {
              console.error("Failed to save Inward PO:", error);
              alert(error?.data?.message || error?.message || "Failed to save Inward PO");
            } finally {
              setIsSubmitting(false);
            }
          }}
          initialData={editingPO}
          customers={customers || []}
          fgItems={fgItems || []}
          priceLists={priceLists || []}
          companyInfo={companyInfo}
          isSubmitting={isSubmitting}
        />
      )}

      {viewingPO && (
        <IncomingPODetailsModal
          isOpen={!!viewingPO}
          onClose={() => setViewingPO(null)}
          po={viewingPO}
          customers={customers || []}
          fgItems={fgItems || []}
          companyInfo={companyInfo}
          onGenerateOrder={handleGenerateOrder}
          isGeneratingOrder={isGenerating}
        />
      )}
    </div>
  );
}
