"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from '@/src/store/services/storeService';
import VendorTable from '@/src/features/store/components/tables/VendorTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function VendorsPage() {
  const { data: vendors = [], isLoading } = useGetStoreDataQuery("vendor");
  const [deleteRecord] = useDeleteStoreRecordMutation();

  const handleEdit = (vendor: any) => {
    // We will implement form editing in the next step
    console.log("Edit vendor", vendor);
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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Vendors</h2>
          <p className="text-sm text-gray-500">Manage your supplier network</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          onClick={() => console.log("Create Vendor")}
        >
          + Add Vendor
        </button>
      </div>

      <div className="h-[calc(100vh-220px)]">
        <VendorTable 
          data={vendors} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>
    </div>
  );
}
