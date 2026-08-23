"use client";

import React, { useState, useMemo } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import MaterialTable from '@/src/features/store/components/tables/MaterialTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function RawMaterialsPage() {
  const { data: rawMaterials = [], isLoading } = useGetStoreDataQuery("raw-material");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});

  const handleEdit = (material: any) => {
    setEditingItem(material);
    setFormData({
      ...material,
      itemType: 'Raw Material'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this Raw Material?")) {
      try {
        await deleteRecord({ tab: "raw-material", id }).unwrap();
      } catch (error: any) {
        console.error("Failed to delete Raw Material", error);
        const errMsg = error?.data?.message || error?.message || "Failed to delete item";
        alert(`Error deleting Raw Material: ${errMsg}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      const payload = {
        ...formData,
        itemType: 'Raw Material'
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
        await updateRecord({ tab: "raw-material", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
      } else {
        await createRecord({ tab: "raw-material", body: submitData, isFormData: true }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (error: any) {
      console.error("Failed to save Raw Material", error);
      const errMsg = error?.data?.message || error?.message || "Failed to save Raw Material. Please check all fields.";
      alert(`Error saving Raw Material: ${errMsg}`);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <MaterialTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({ itemType: 'Raw Material' });
            setIsModalOpen(true);
          }} 
          data={rawMaterials} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onView={(item) => setPreviewItem(item)}
          masterTab="raw-material"
          itemTypeLabel="Raw Material"
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="raw-material"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Edit / Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Raw Material (RM)" : "Add Raw Material (RM)"}
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
              className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreating || isUpdating ? "Saving..." : "Save Raw Material"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
