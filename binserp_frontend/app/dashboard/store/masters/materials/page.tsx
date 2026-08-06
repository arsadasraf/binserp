"use client";

import React from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from '@/src/store/services/storeService';
import MaterialTable from '@/src/features/store/components/tables/MaterialTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function MaterialsPage() {
  const { data: materials = [], isLoading } = useGetStoreDataQuery("rm-bo-item");
  const [deleteRecord] = useDeleteStoreRecordMutation();

  const handleEdit = (material: any) => {
    console.log("Edit material", material);
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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Materials (RM/BO)</h2>
          <p className="text-sm text-gray-500">Manage raw materials and bought-out items</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          onClick={() => console.log("Create Material")}
        >
          + Add Material
        </button>
      </div>

      <div className="h-[calc(100vh-220px)]">
        <MaterialTable 
          data={materials} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>
    </div>
  );
}
