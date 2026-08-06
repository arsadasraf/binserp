"use client";

import React from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation } from '@/src/store/services/storeService';
import CustomerTable from '@/src/features/store/components/tables/CustomerTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useGetStoreDataQuery("customer");
  const [deleteRecord] = useDeleteStoreRecordMutation();

  const handleEdit = (customer: any) => {
    console.log("Edit customer", customer);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      try {
        await deleteRecord({ tab: "customer", id }).unwrap();
      } catch (error) {
        console.error("Failed to delete customer", error);
      }
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500">Manage your customers</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          onClick={() => console.log("Create Customer")}
        >
          + Add Customer
        </button>
      </div>

      <div className="h-[calc(100vh-220px)]">
        <CustomerTable 
          data={customers} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>
    </div>
  );
}
