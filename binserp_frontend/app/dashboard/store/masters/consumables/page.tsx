"use client";

import React, { useState, useEffect } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import ConsumableTable from '@/src/features/store/components/tables/ConsumableTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import MasterForm from '@/src/features/store/components/forms/MasterForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const extractErrorMessage = (error: any, fallback = "Failed to save Consumable Item."): string => {
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

export default function ConsumablesPage() {
  const { data: consumables = [], isLoading } = useGetStoreDataQuery("consumable-item");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  
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

  const handleEdit = (consumable: any) => {
    setEditingItem(consumable);
    setFormData(consumable);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: any) => {
    const isCurrentlyInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
    const newStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "consumable-item",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
      setToast({ type: 'success', message: `Consumable Item status updated to ${newStatus}` });
    } catch (err: any) {
      console.error("Failed to update status", err);
      setToast({ type: 'error', message: `Failed to update status: ${extractErrorMessage(err)}` });
    }
  };

  const handleDelete = async (id: string) => {
    const target = consumables.find((m: any) => m._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this consumable item'}"?`)) {
      try {
        await deleteRecord({ tab: "consumable-item", id }).unwrap();
        setToast({ type: 'success', message: `Consumable "${target?.name || 'Item'}" deleted successfully.` });
      } catch (error: any) {
        const errMsg = extractErrorMessage(error, "Failed to delete item");
        if (target && (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction"))) {
          if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this item instead?`)) {
            handleToggleStatus(target);
          }
        } else {
          setToast({ type: 'error', message: `Error deleting Consumable Item: ${errMsg}` });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = (formData.name || '').toString().trim();
    if (!cleanName) {
      setFormError("Consumable Item Name is required.");
      return;
    }

    try {
      const submitData = new FormData();
      const payload = {
        ...formData,
        name: cleanName
      };

      Object.keys(payload).forEach((key) => {
        if (key === 'photos' && Array.isArray(payload.photos)) {
          payload.photos.forEach((photo: any) => {
            if (photo instanceof File) {
              submitData.append('photos', photo);
            } else if (typeof photo === 'string' && photo.trim()) {
              submitData.append('photos', photo.trim());
            }
          });
        } else if ((payload as any)[key] !== undefined && (payload as any)[key] !== null) {
          const val = (payload as any)[key];
          if (typeof val === 'object' && val !== null && '_id' in val) {
            if ((val as any)._id) submitData.append(key, String((val as any)._id));
          } else if (typeof val === 'string') {
            if (val.trim()) submitData.append(key, val.trim());
          } else {
            submitData.append(key, String(val));
          }
        }
      });

      if (editingItem) {
        await updateRecord({ tab: "consumable-item", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
        setToast({ type: 'success', message: `Consumable Item "${cleanName}" updated successfully!` });
      } else {
        await createRecord({ tab: "consumable-item", body: submitData, isFormData: true }).unwrap();
        setToast({ type: 'success', message: `Consumable Item "${cleanName}" created successfully!` });
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
      setFormError(null);
    } catch (error: any) {
      const errMsg = extractErrorMessage(error, "Failed to save Consumable Item.");
      console.warn("Save Consumable Item notice:", errMsg);
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
        <ConsumableTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({});
            setFormError(null);
            setIsModalOpen(true);
          }} 
          data={consumables} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onView={(item) => setPreviewItem(item)}
        />
      </div>

      {/* View / Informative Preview & PDF Modal */}
      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="consumable-item"
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
        title={editingItem ? "Edit Consumable Item" : "Add Consumable Item"}
        maxWidth="6xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modal Error Banner */}
          {formError && (
            <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Unable to Save Consumable Item</div>
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
            masterTab="consumable-item"
            categories={categories}
            locations={locations}
            existingItems={consumables}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setFormError(null);
              }}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-5 py-2 text-xs sm:text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isCreating || isUpdating ? "Saving..." : (editingItem ? "Update Consumable Item" : "Save Consumable Item")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
