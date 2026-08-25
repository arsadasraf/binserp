"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import ConsumableTable from '@/src/features/store/components/tables/ConsumableTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function ConsumablesPage() {
  const { data: consumables = [], isLoading } = useGetStoreDataQuery("consumable-item");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});

  const handleEdit = (consumable: any) => {
    setEditingItem(consumable);
    setFormData(consumable);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: any) => {
    const isCurrentlyInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
    const newStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "consumable-item",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
    } catch (err: any) {
      console.error("Failed to update status", err);
      alert(`Failed to update status: ${err?.data?.message || err?.message || 'Error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    const target = consumables.find((m: any) => m._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this consumable item'}"?`)) {
      try {
        await deleteRecord({ tab: "consumable-item", id }).unwrap();
      } catch (error: any) {
        const errMsg = error?.data?.message || error?.message || "Failed to delete item";
        if (target && (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction"))) {
          if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this item instead?`)) {
            handleToggleStatus(target);
          }
        } else {
          alert(`Error deleting Consumable Item: ${errMsg}`);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'photos' && Array.isArray(formData.photos)) {
          formData.photos.forEach((photo: any) => {
            if (photo instanceof File) {
              submitData.append('photos', photo);
            } else if (typeof photo === 'string' && photo.trim()) {
              submitData.append('photos', photo.trim());
            }
          });
        } else if (formData[key as keyof StoreFormData] !== undefined && formData[key as keyof StoreFormData] !== null) {
          const val = formData[key as keyof StoreFormData];
          if (typeof val === 'object' && val !== null && '_id' in val) {
            if ((val as any)._id) submitData.append(key, String((val as any)._id));
          } else if (typeof val === 'string') {
            if (val.trim()) submitData.append(key, val.trim());
          } else {
            submitData.append(key, String(val));
          }
        }
      });

      if (editingItem) {
        await updateRecord({ tab: "consumable-item", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
      } else {
        await createRecord({ tab: "consumable-item", body: submitData, isFormData: true }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (error: any) {
      console.error("Failed to save Consumable Item", error);
      const errMsg = error?.data?.message || error?.error || error?.message || "Failed to save Consumable Item. Please check all required fields.";
      alert(`Error saving Consumable Item: ${errMsg}`);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <ConsumableTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setIsModalOpen(true);
          }} 
          data={consumables} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onView={(item) => setPreviewItem(item)}
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="consumable-item"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Edit / Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Consumable Item" : "Add Consumable Item"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <MasterForm
            formData={formData}
            setFormData={setFormData}
            masterTab="consumable-item"
            categories={categories}
            locations={locations}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-4 py-2 text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {isCreating || isUpdating ? "Saving..." : "Save Consumable Item"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
