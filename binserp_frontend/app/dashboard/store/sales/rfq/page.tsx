"use client";

import React, { useState } from 'react';
import { IncomingRFQTable } from "../../components/IncomingRFQTable";
import { IncomingRFQForm } from "../../components/IncomingRFQForm";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useCreateStoreRecordMutation, useUpdateStoreRecordMutation, useDeleteStoreRecordMutation } from "@/src/store/services/storeService";

export default function SalesRFQPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: rfqList, fgItems, customers, priceLists, loading, refetch } = useStoreData("incoming-rfq", "vendor", token);
  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [updateStoreRecord] = useUpdateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingRFQ, setEditingRFQ] = useState<any>(null);
  const [viewingRFQ, setViewingRFQ] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <IncomingRFQTable
        rfqs={rfqList || []}
        fgItems={fgItems || []}
        onCreate={() => { setEditingRFQ(null); setShowModal(true); }}
        onEdit={(rfq) => { setEditingRFQ(rfq); setShowModal(true); }}
        onView={(rfq) => { setViewingRFQ(rfq); }}
        onDelete={async (id) => {
          if (confirm("Are you sure you want to delete this Inward RFQ?")) {
            try {
              await deleteStoreRecord({ tab: "incoming-rfq", id }).unwrap();
              alert("Inward RFQ deleted successfully!");
              refetch();
            } catch (error: any) {
              console.error("Failed to delete RFQ:", error);
              alert(error?.data?.message || "Failed to delete Inward RFQ");
            }
          }
        }}
      />

      {/* Edit or Create Modal */}
      {showModal && (
        <IncomingRFQForm
          isOpen={showModal}
          isPreview={false}
          onClose={() => { setShowModal(false); setEditingRFQ(null); }}
          onCancel={() => { setShowModal(false); setEditingRFQ(null); }}
          fgItems={fgItems || []}
          customers={customers || []}
          priceLists={priceLists || []}
          onSubmit={async (formData) => {
            try {
              if (editingRFQ) {
                await updateStoreRecord({ tab: "incoming-rfq", id: editingRFQ._id, body: formData }).unwrap();
                alert("Inward RFQ updated successfully!");
              } else {
                await createStoreRecord({ tab: "incoming-rfq", body: formData }).unwrap();
                alert("Inward RFQ created successfully!");
              }
              setShowModal(false);
              setEditingRFQ(null);
              refetch();
            } catch (error: any) {
              console.error("Failed to save RFQ:", error);
              alert(error?.data?.message || error?.message || "Failed to save Inward RFQ. Please check all required fields.");
            }
          }}
          initialData={editingRFQ}
        />
      )}

      {/* Read-Only Preview Modal */}
      {viewingRFQ && (
        <IncomingRFQForm
          isOpen={!!viewingRFQ}
          isPreview={true}
          onClose={() => setViewingRFQ(null)}
          onCancel={() => setViewingRFQ(null)}
          fgItems={fgItems || []}
          customers={customers || []}
          priceLists={priceLists || []}
          initialData={viewingRFQ}
          onSubmit={() => setViewingRFQ(null)}
        />
      )}
    </div>
  );
}
