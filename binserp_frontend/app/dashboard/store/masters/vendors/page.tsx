"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import VendorTable from '@/src/features/store/components/tables/VendorTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function VendorsPage() {
  const { data: vendors = [], isLoading } = useGetStoreDataQuery("vendor");
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});

  const handleEdit = (vendor: any) => {
    setEditingItem(vendor);
    setFormData(vendor);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      try {
        await deleteRecord({ tab: "vendor", id }).unwrap();
      } catch (error) {
        console.error("Failed to delete vendor", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateRecord({ tab: "vendor", id: editingItem._id, body: formData }).unwrap();
      } else {
        await createRecord({ tab: "vendor", body: formData }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to save vendor", error);
      alert("Failed to save vendor");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <VendorTable
          data={vendors}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={(vendor) => setPreviewItem(vendor)}
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setIsModalOpen(true);
          }}
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="vendor"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Edit / Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Vendor" : "Add Vendor"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <MasterForm
            formData={formData}
            setFormData={setFormData}
            masterTab="vendor"
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
              {isCreating || isUpdating ? "Saving..." : "Save Vendor"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
