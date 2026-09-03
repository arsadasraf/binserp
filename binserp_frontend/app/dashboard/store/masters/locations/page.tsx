"use client";

import React, { useState, useEffect } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import LocationTable from '@/src/features/store/components/tables/LocationTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const extractErrorMessage = (error: any, fallback = "Failed to save location."): string => {
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

export default function LocationsPage() {
  const { data: locations = [], isLoading } = useGetStoreDataQuery("location");
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

  const handleEdit = (location: any) => {
    setEditingItem(location);
    setFormData(location);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const target = locations.find((l: any) => l._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this location'}"?`)) {
      try {
        await deleteRecord({ tab: "location", id }).unwrap();
        setPreviewItem(null);
        setToast({ type: 'success', message: `Location "${target?.name || 'Item'}" deleted successfully.` });
      } catch (error) {
        const errMsg = extractErrorMessage(error, "Failed to delete location");
        setToast({ type: 'error', message: errMsg });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = (formData.name || '').toString().trim();
    if (!cleanName) {
      setFormError("Location Name is required.");
      return;
    }

    try {
      const payload = { ...formData, name: cleanName };
      if (editingItem) {
        await updateRecord({ tab: "location", id: editingItem._id, body: payload }).unwrap();
        setToast({ type: 'success', message: `Location "${cleanName}" updated successfully!` });
      } else {
        await createRecord({ tab: "location", body: payload }).unwrap();
        setToast({ type: 'success', message: `Location "${cleanName}" created successfully!` });
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
      setFormError(null);
    } catch (error) {
      const errMsg = extractErrorMessage(error, "Failed to save location.");
      console.warn("Save location notice:", errMsg);
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
        <LocationTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setFormError(null);
            setIsModalOpen(true);
          }} 
          data={locations} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onView={(location) => setPreviewItem(location)}
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="location"
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
        title={editingItem ? "Edit Location" : "Add Location"}
        maxWidth="5xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modal Error Banner */}
          {formError && (
            <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Unable to Save Location</div>
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
            masterTab="location"
            existingItems={locations}
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
              {isCreating || isUpdating ? "Saving..." : (editingItem ? "Update Location" : "Save Location")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
