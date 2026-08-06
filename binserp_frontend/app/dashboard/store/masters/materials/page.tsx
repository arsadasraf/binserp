"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import MaterialTable from '@/src/features/store/components/tables/MaterialTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import RmBoItemForm from '@/src/features/store/components/forms/RmBoItemForm';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function MaterialsPage() {
  const { data: materials = [], isLoading } = useGetStoreDataQuery("rm-bo-item");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});

  const handleEdit = (material: any) => {
    setEditingItem(material);
    setFormData(material);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this material?")) {
      try {
        await deleteRecord({ tab: "rm-bo-item", id }).unwrap();
      } catch (error) {
        console.error("Failed to delete material", error);
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
            }
          });
        } else if (formData[key as keyof StoreFormData] !== undefined && formData[key as keyof StoreFormData] !== null) {
          submitData.append(key, String(formData[key as keyof StoreFormData]));
        }
      });

      if (editingItem) {
        await updateRecord({ tab: "rm-bo-item", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
      } else {
        await createRecord({ tab: "rm-bo-item", body: submitData, isFormData: true }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to save material", error);
      alert("Failed to save material");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-160px)]">
        <MaterialTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setIsModalOpen(true);
          }} 
          data={materials} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>

      <RmBoItemForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        locations={locations}
        loading={isCreating || isUpdating}
        isEditing={!!editingItem}
      />
    </div>
  );
}
