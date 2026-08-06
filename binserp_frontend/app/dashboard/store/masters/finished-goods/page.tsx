"use client";

import React from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from '@/src/store/services/storeService';
import FinishedGoodsTable from '@/src/features/store/components/tables/FinishedGoodsTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function FinishedGoodsPage() {
  const { data: finishedGoods = [], isLoading } = useGetStoreDataQuery("fg-item");
  const [deleteRecord] = useDeleteStoreRecordMutation();

  const handleEdit = (item: any) => {
    console.log("Edit fg", item);
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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Finished Goods</h2>
          <p className="text-sm text-gray-500">Manage finished goods items</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          onClick={() => console.log("Create FG Item")}
        >
          + Add Finished Good
        </button>
      </div>

      <div className="h-[calc(100vh-220px)]">
        <FinishedGoodsTable 
          data={finishedGoods} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>
    </div>
  );
}
