"use client";

import React from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from '@/src/store/services/storeService';
import LocationTable from '@/src/features/store/components/tables/LocationTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function LocationsPage() {
  const { data: locations = [], isLoading } = useGetStoreDataQuery("location");
  const [deleteRecord] = useDeleteStoreRecordMutation();

  const handleEdit = (location: any) => {
    console.log("Edit location", location);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this location?")) {
      try {
        await deleteRecord({ tab: "location", id }).unwrap();
      } catch (error) {
        console.error("Failed to delete location", error);
      }
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Locations</h2>
          <p className="text-sm text-gray-500">Manage warehouse locations and racks</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          onClick={() => console.log("Create Location")}
        >
          + Add Location
        </button>
      </div>

      <div className="h-[calc(100vh-220px)]">
        <LocationTable 
          data={locations} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>
    </div>
  );
}
