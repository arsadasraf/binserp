"use client";

import React, { useState } from 'react';
import { SalesOrderTable } from "../../components/SalesOrderTable";
import { SalesOrderForm } from "../../components/SalesOrderForm";
import { SalesOrderDetailsModal } from "../../components/SalesOrderDetailsModal";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import {
  useCreateStoreRecordMutation,
  useUpdateStoreRecordMutation,
  useDeleteStoreRecordMutation,
} from "@/src/store/services/storeService";

export default function SalesOrdersPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: orderList, customers, fgItems, priceLists, companyInfo, loading, refetch } = useStoreData("order", "vendor", token);

  const [createStoreRecord] = useCreateStoreRecordMutation();
  const [updateStoreRecord] = useUpdateStoreRecordMutation();
  const [deleteStoreRecord] = useDeleteStoreRecordMutation();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) return <LoadingSpinner />;

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this Sales Order?")) {
      try {
        await deleteStoreRecord({ tab: "order", id }).unwrap();
        refetch();
      } catch (error: any) {
        console.error("Failed to delete Sales Order:", error);
        alert(error?.data?.message || error?.message || "Failed to delete Sales Order");
      }
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      if (editingOrder?._id) {
        await updateStoreRecord({
          tab: "order",
          id: editingOrder._id,
          body: formData,
          isFormData: true,
        }).unwrap();
      } else {
        await createStoreRecord({
          tab: "order",
          body: formData,
          isFormData: true,
        }).unwrap();
      }

      setShowFormModal(false);
      setEditingOrder(null);
      refetch();
    } catch (error: any) {
      console.error("Failed to save Sales Order:", error);
      alert(error?.data?.message || error?.message || "Failed to save Sales Order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Table Component */}
      <SalesOrderTable
        orders={orderList || []}
        customers={customers || []}
        companyInfo={companyInfo}
        onCreate={() => {
          setEditingOrder(null);
          setShowFormModal(true);
        }}
        onEdit={(order) => {
          setEditingOrder(order);
          setShowFormModal(true);
        }}
        onView={(order) => {
          setViewingOrder(order);
        }}
        onDelete={handleDelete}
        onRefetch={refetch}
      />

      {/* Form Modal (Create / Edit) */}
      {showFormModal && (
        <SalesOrderForm
          isOpen={showFormModal}
          initialData={editingOrder}
          fgItems={fgItems || []}
          customers={customers || []}
          priceLists={priceLists || []}
          companyInfo={companyInfo}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowFormModal(false);
            setEditingOrder(null);
          }}
          onClose={() => {
            setShowFormModal(false);
            setEditingOrder(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Read-Only Informative Details Modal */}
      {viewingOrder && (
        <SalesOrderDetailsModal
          isOpen={!!viewingOrder}
          order={viewingOrder}
          companyInfo={companyInfo}
          customers={customers || []}
          onClose={() => setViewingOrder(null)}
          onEdit={() => {
            setEditingOrder(viewingOrder);
            setViewingOrder(null);
            setShowFormModal(true);
          }}
        />
      )}
    </div>
  );
}
