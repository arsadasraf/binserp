"use client";

import React from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from '@/src/store/services/storeService';
import CategoryTable from '@/src/features/store/components/tables/CategoryTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useGetStoreDataQuery("category");
  const [deleteRecord] = useDeleteStoreRecordMutation();

  const handleEdit = (category: any) => {
    console.log("Edit category", category);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      try {
        await deleteRecord({ tab: "category", id }).unwrap();
      } catch (error) {
        console.error("Failed to delete category", error);
      }
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-500">Manage item categories</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          onClick={() => console.log("Create Category")}
        >
          + Add Category
        </button>
      </div>

      <div className="h-[calc(100vh-220px)]">
        <CategoryTable 
          data={categories} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>
    </div>
  );
}
