"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import FinishedGoodsTable from '@/src/features/store/components/tables/FinishedGoodsTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
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
    if (confirm("Are you sure you want to delete this FG item?")) {
      try {
        await deleteRecord({ tab: "fg-item", id }).unwrap();
      } catch (error: any) {
        console.error("Failed to delete FG item", error);
        const errMsg = error?.data?.message || error?.message || "Failed to delete FG Item";
        alert(`Error deleting FG Item: ${errMsg}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'bom' && Array.isArray(formData.bom)) {
          const cleanedBOM = formData.bom.map((bItem: any) => ({
            ...bItem,
            item: typeof bItem.item === 'object' && bItem.item !== null ? bItem.item._id : bItem.item
          }));
          submitData.append('bom', JSON.stringify(cleanedBOM));
        } else if (key === 'photos' && Array.isArray(formData.photos)) {
          formData.photos.forEach((photo: any) => {
            if (photo instanceof File) {
              submitData.append('photos', photo);
            } else if (typeof photo === 'string') {
              submitData.append('photos', photo);
            }
          });
        } else if (formData[key as keyof StoreFormData] !== undefined && formData[key as keyof StoreFormData] !== null) {
          const val = formData[key as keyof StoreFormData];
          if (typeof val === 'object' && val !== null && '_id' in val) {
            submitData.append(key, (val as any)._id);
          } else {
            submitData.append(key, String(val));
          }
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
    } catch (error: any) {
      console.error("Failed to save FG item", error);
      const errMsg = error?.data?.message || error?.message || "Failed to save FG Item. Please check required fields.";
      alert(`Error saving FG Item: ${errMsg}`);
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
            setPhotos([]);
            setIsModalOpen(true);
          }} 
          data={finishedGoods} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit FG Item" : "Add FG Item"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <FGItemForm
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            locations={locations}
            customers={customers}
            materials={materials}
            fgItems={finishedGoods}
            photos={photos}
            setPhotos={setPhotos}
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
              {isCreating || isUpdating ? "Saving..." : "Save FG Item"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
