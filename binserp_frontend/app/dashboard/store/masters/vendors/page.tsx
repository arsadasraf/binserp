"use client";

import React, { useState, useEffect } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import VendorTable from '@/src/features/store/components/tables/VendorTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const extractErrorMessage = (error: any, fallback = "Failed to save vendor."): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.data?.message) return error.data.message;
  if (error.data?.error) return error.data.error;
  if (typeof error.data === 'string') return error.data;
  if (error.error) return String(error.error);
  if (error.message) return error.message;
  try {
    const raw = JSON.stringify(error.data || error);
    if (raw && raw !== '{}') return raw;
  } catch {}
  return fallback;
};

export default function VendorsPage() {
  const { data: vendors = [], isLoading } = useGetStoreDataQuery("vendor");
  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({});
  
  // UI feedback states
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleEdit = (vendor: any) => {
    setEditingItem(vendor);
    const normalized = {
      ...vendor,
      billingAddress: vendor.billingAddress || vendor.address || "",
      billingCity: vendor.billingCity || vendor.city || "",
      billingState: vendor.billingState || vendor.state || "",
      billingPincode: vendor.billingPincode || vendor.pincode || "",
      billingDistrict: vendor.billingDistrict || vendor.district || "",
      billingCountry: vendor.billingCountry || vendor.country || "India",
      shippingAddress: vendor.shippingAddress || vendor.billingAddress || vendor.address || "",
      shippingCity: vendor.shippingCity || vendor.billingCity || vendor.city || "",
      shippingState: vendor.shippingState || vendor.billingState || vendor.state || "",
      shippingPincode: vendor.shippingPincode || vendor.billingPincode || vendor.pincode || "",
      shippingDistrict: vendor.shippingDistrict || vendor.billingDistrict || vendor.district || "",
      shippingCountry: vendor.shippingCountry || vendor.billingCountry || vendor.country || "India",
      address: vendor.address || vendor.billingAddress || "",
      city: vendor.city || vendor.billingCity || "",
      state: vendor.state || vendor.billingState || "",
      pincode: vendor.pincode || vendor.billingPincode || "",
    };
    setFormData(normalized);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: any) => {
    const isCurrentlyInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
    const newStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "vendor",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
      setToast({ type: 'success', message: `Vendor status updated to ${newStatus}` });
    } catch (err: any) {
      console.error("Failed to update vendor status", err);
      setToast({ type: 'error', message: `Failed to update vendor status: ${extractErrorMessage(err)}` });
    }
  };

  const handleDelete = async (id: string) => {
    const target = vendors.find((m: any) => m._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this vendor'}"?`)) {
      try {
        await deleteRecord({ tab: "vendor", id }).unwrap();
        setToast({ type: 'success', message: `Vendor "${target?.name || 'Item'}" deleted successfully.` });
      } catch (error: any) {
        const errMsg = extractErrorMessage(error, "Failed to delete vendor");
        if (target && (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction") || errMsg.toLowerCase().includes("po") || errMsg.toLowerCase().includes("grn"))) {
          if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this vendor instead?`)) {
            handleToggleStatus(target);
          }
        } else {
          setToast({ type: 'error', message: `Error deleting vendor: ${errMsg}` });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = (formData.name || '').toString().trim();
    if (!cleanName) {
      setFormError("Vendor Name is required.");
      return;
    }

    try {
      const payload = {
        ...formData,
        name: cleanName,
        vendorType: formData.vendorType || "Rm Vendor",
        address: formData.billingAddress || formData.address || "",
        city: formData.billingCity || formData.city || "",
        state: formData.billingState || formData.state || "",
        pincode: formData.billingPincode || formData.pincode || "",
      };
      if (editingItem) {
        await updateRecord({ tab: "vendor", id: editingItem._id, body: payload }).unwrap();
        setToast({ type: 'success', message: `Vendor "${cleanName}" updated successfully!` });
      } else {
        await createRecord({ tab: "vendor", body: payload }).unwrap();
        setToast({ type: 'success', message: `Vendor "${cleanName}" created successfully!` });
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
      setFormError(null);
    } catch (error) {
      const errMsg = extractErrorMessage(error, "Failed to save vendor.");
      console.warn("Save vendor notice:", errMsg);
      setFormError(errMsg);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 relative">
      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === 'success'
            ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            : 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="h-[calc(100dvh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <VendorTable
          data={vendors}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onView={(vendor) => setPreviewItem(vendor)}
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setFormError(null);
            setIsModalOpen(true);
          }}
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="vendor"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Edit / Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormError(null);
        }}
        title={editingItem ? "Edit Vendor" : "Add Vendor"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modal Error Banner */}
          {formError && (
            <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Unable to Save Vendor</div>
                  <div className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5 leading-relaxed">{formError}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 p-1 rounded-md transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <MasterForm
            formData={formData}
            setFormData={(data) => {
              if (formError) setFormError(null);
              setFormData(data);
            }}
            masterTab="vendor"
            existingItems={vendors}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setFormError(null);
              }}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-5 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isCreating || isUpdating ? "Saving..." : (editingItem ? "Update Vendor" : "Save Vendor")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
