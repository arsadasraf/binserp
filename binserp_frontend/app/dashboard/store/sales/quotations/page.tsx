"use client";

import React, { useState } from 'react';
import QuotationTable from "../../components/tables/QuotationTable";
import QuotationModal from "../../components/modals/QuotationModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";

export default function SalesQuotationsPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { quotations, fgItems, customers, priceLists, companyInfo, loading, refetch, handleQuotationSubmit, handleQuotationUpdate, handleDelete } = useStoreData("quotation", "vendor", token);

  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);
  const [viewingQuotation, setViewingQuotation] = useState<any>(null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <QuotationTable
        data={quotations || []}
        companyInfo={companyInfo}
        onCreate={() => { setEditingQuotation(null); setShowModal(true); }}
        onEdit={(q) => { setEditingQuotation(q); setShowModal(true); }}
        onView={(q) => { setViewingQuotation(q); }}
        onDelete={async (id) => {
          if (confirm("Are you sure you want to delete this Outward Quotation?")) {
            await handleDelete("quotation", id);
            refetch();
          }
        }}
      />

      {/* Edit or Create Modal */}
      {showModal && (
        <QuotationModal
          isOpen={showModal}
          isPreview={false}
          onClose={() => { setShowModal(false); setEditingQuotation(null); }}
          components={fgItems || []}
          customers={customers || []}
          priceLists={priceLists || []}
          companyInfo={companyInfo}
          onSubmit={async (formData) => {
            try {
              if (editingQuotation) {
                await handleQuotationUpdate(editingQuotation._id, formData);
                alert("Outward Quotation updated successfully!");
              } else {
                await handleQuotationSubmit(formData);
                alert("Outward Quotation created successfully!");
              }
              setShowModal(false);
              setEditingQuotation(null);
              refetch();
            } catch (error: any) {
              console.error("Failed to save Quotation:", error);
              const errMsg = error?.data?.message || error?.message || "Failed to save Outward Quotation";
              alert(errMsg);
            }
          }}
          initialData={editingQuotation}
        />
      )}

      {/* Read-Only Preview Modal */}
      {viewingQuotation && (
        <QuotationModal
          isOpen={!!viewingQuotation}
          isPreview={true}
          onClose={() => setViewingQuotation(null)}
          components={fgItems || []}
          customers={customers || []}
          priceLists={priceLists || []}
          companyInfo={companyInfo}
          initialData={viewingQuotation}
          onSubmit={() => setViewingQuotation(null)}
        />
      )}
    </div>
  );
}
