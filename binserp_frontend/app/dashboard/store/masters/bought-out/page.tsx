"use client";

import React, { useState, useMemo } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import MaterialTable from '@/src/features/store/components/tables/MaterialTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function BoughtOutPage() {
  const { data: boughtOutItems = [], isLoading } = useGetStoreDataQuery("bought-out");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      ...item,
      itemType: 'Bought Out'
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: any) => {
    const isCurrentlyInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
    const newStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "bought-out",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
    } catch (err: any) {
      console.error("Failed to update status", err);
      alert(`Failed to update status: ${err?.data?.message || err?.message || 'Error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    const target = boughtOutItems.find((m: any) => m._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this Bought Out item'}"?`)) {
      try {
        await deleteRecord({ tab: "bought-out", id }).unwrap();
      } catch (error: any) {
        const errMsg = error?.data?.message || error?.message || "Failed to delete item";
        if (target && (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction"))) {
          if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this item instead?`)) {
            handleToggleStatus(target);
          }
        } else {
          alert(`Error deleting Bought Out Item: ${errMsg}`);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      const payload = {
        ...formData,
        itemType: 'Bought Out'
      };

      Object.keys(payload).forEach((key) => {
        if (key === 'photos' && Array.isArray(payload.photos)) {
          payload.photos.forEach((photo: any) => {
            if (photo instanceof File) {
              submitData.append('photos', photo);
            } else if (typeof photo === 'string') {
              submitData.append('photos', photo);
            }
          });
        } else if (payload[key as keyof StoreFormData] !== undefined && payload[key as keyof StoreFormData] !== null) {
          const val = payload[key as keyof StoreFormData];
          if (typeof val === 'object' && val !== null && '_id' in val) {
            submitData.append(key, (val as any)._id);
          } else {
            submitData.append(key, String(val));
          }
        }
      });

      if (editingItem) {
        await updateRecord({ tab: "bought-out", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
      } else {
        await createRecord({ tab: "bought-out", body: submitData, isFormData: true }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (error: any) {
      console.error("Failed to save Bought Out Item", error);
      const errMsg = error?.data?.message || error?.message || "Failed to save Bought Out Item. Please check all fields.";
      alert(`Error saving Bought Out Item: ${errMsg}`);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <MaterialTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({ itemType: 'Bought Out' });
            setIsModalOpen(true);
          }} 
          data={boughtOutItems} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onView={(item) => setPreviewItem(item)}
          masterTab="bought-out"
          itemTypeLabel="Bought Out"
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="bought-out"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Edit / Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Bought Out (BO) Item" : "Add Bought Out (BO) Item"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <MasterForm
            formData={formData}
            setFormData={setFormData}
            masterTab="rm-bo-item"
            categories={categories}
            locations={locations}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-4 py-2 text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {isCreating || isUpdating ? "Saving..." : "Save Bought Out Item"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
