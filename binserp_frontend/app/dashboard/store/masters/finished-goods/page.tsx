"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import FinishedGoodsTable from '@/src/features/store/components/tables/FinishedGoodsTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import FGItemForm from '@/src/features/store/components/forms/FGItemForm';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function FinishedGoodsPage() {
  const { data: finishedGoods = [], isLoading } = useGetStoreDataQuery("fg-item");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  const { data: customers = [] } = useGetStoreDataQuery("customer");
  const { data: materials = [] } = useGetStoreDataQuery("rm-bo-item");

  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});
  const [photos, setPhotos] = useState<File[]>([]);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setPhotos([]);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteRecord({ tab: "fg-item", id }).unwrap();
      } catch (error) {
        console.error("Failed to delete item", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'bom') {
          submitData.append('bom', JSON.stringify(formData.bom));
        } else if (formData[key as keyof StoreFormData] !== undefined && formData[key as keyof StoreFormData] !== null) {
          submitData.append(key, String(formData[key as keyof StoreFormData]));
        }
      });
      photos.forEach(photo => submitData.append('photos', photo));

      if (editingItem) {
        await updateRecord({ tab: "fg-item", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
      } else {
        await createRecord({ tab: "fg-item", body: submitData, isFormData: true }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setPhotos([]);
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to save finished good", error);
      alert("Failed to save finished good");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-160px)]">
        <FinishedGoodsTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setIsModalOpen(true);
          }} 
          data={finishedGoods} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>

      <FGItemForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        locations={locations}
        customers={customers}
        materials={materials}
        fgItems={finishedGoods}
        photos={photos}
        setPhotos={setPhotos}
        loading={isCreating || isUpdating}
        isEditing={!!editingItem}
      />
    </div>
  );
}
