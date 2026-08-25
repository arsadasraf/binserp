"use client";

import React, { useState } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import CustomerTable from '@/src/features/store/components/tables/CustomerTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useGetStoreDataQuery("customer");
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});

  const handleEdit = (customer: any) => {
    setEditingItem(customer);
    const normalized = {
      ...customer,
      billingAddress: customer.billingAddress || customer.address || "",
      billingCity: customer.billingCity || customer.city || "",
      billingState: customer.billingState || customer.state || "",
      billingPincode: customer.billingPincode || customer.pincode || "",
      billingDistrict: customer.billingDistrict || customer.district || "",
      billingCountry: customer.billingCountry || customer.country || "India",
      shippingAddress: customer.shippingAddress || customer.billingAddress || customer.address || "",
      shippingCity: customer.shippingCity || customer.billingCity || customer.city || "",
      shippingState: customer.shippingState || customer.billingState || customer.state || "",
      shippingPincode: customer.shippingPincode || customer.billingPincode || customer.pincode || "",
      shippingDistrict: customer.shippingDistrict || customer.billingDistrict || customer.district || "",
      shippingCountry: customer.shippingCountry || customer.billingCountry || customer.country || "India",
      address: customer.address || customer.billingAddress || "",
      city: customer.city || customer.billingCity || "",
      state: customer.state || customer.billingState || "",
      pincode: customer.pincode || customer.billingPincode || "",
    };
    setFormData(normalized);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: any) => {
    const isCurrentlyInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
    const newStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "customer",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
    } catch (err: any) {
      console.error("Failed to update customer status", err);
      alert(`Failed to update customer status: ${err?.data?.message || err?.message || 'Error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    const target = customers.find((m: any) => m._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this customer'}"?`)) {
      try {
        await deleteRecord({ tab: "customer", id }).unwrap();
      } catch (error: any) {
        const errMsg = error?.data?.message || error?.message || "Failed to delete customer";
        if (target && (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction") || errMsg.toLowerCase().includes("order") || errMsg.toLowerCase().includes("dc") || errMsg.toLowerCase().includes("invoice"))) {
          if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this customer instead?`)) {
            handleToggleStatus(target);
          }
        } else {
          alert(`Error deleting customer: ${errMsg}`);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        address: formData.billingAddress || formData.address || "",
        city: formData.billingCity || formData.city || "",
        state: formData.billingState || formData.state || "",
        pincode: formData.billingPincode || formData.pincode || "",
      };
      if (editingItem) {
        await updateRecord({ tab: "customer", id: editingItem._id, body: payload }).unwrap();
      } else {
        await createRecord({ tab: "customer", body: payload }).unwrap();
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to save customer", error);
      alert("Failed to save customer");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <CustomerTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setIsModalOpen(true);
          }} 
          data={customers} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onView={(customer) => setPreviewItem(customer)}
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="customer"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Edit / Add Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Customer" : "Add Customer"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <MasterForm
            formData={formData}
            setFormData={setFormData}
            masterTab="customer"
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
              {isCreating || isUpdating ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
