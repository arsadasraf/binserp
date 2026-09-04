"use client";

import React, { useState, useEffect } from 'react';
import { useGetStoreDataQuery, useDeleteStoreRecordMutation, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import FinishedGoodsTable from '@/src/features/store/components/tables/FinishedGoodsTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Modal from '@/src/components/Modal';
import FGItemForm from '@/src/features/store/components/forms/FGItemForm';
import MasterDetailPreviewModal from '@/src/features/store/components/modals/MasterDetailPreviewModal';
import { StoreFormData } from '@/src/features/store/types/store.types';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const extractErrorMessage = (error: any, fallback = "Failed to save Finished Good. Please check required fields."): string => {
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

export default function FinishedGoodsPage() {
  const { data: finishedGoods = [], isLoading } = useGetStoreDataQuery("fg-item");
  const { data: rawMaterials = [] } = useGetStoreDataQuery("raw-material");
  const { data: boughtOuts = [] } = useGetStoreDataQuery("bought-out");
  const { data: categories = [] } = useGetStoreDataQuery("category");
  const { data: locations = [] } = useGetStoreDataQuery("location");
  const { data: customers = [] } = useGetStoreDataQuery("customer");

  const [deleteRecord] = useDeleteStoreRecordMutation();
  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateStoreRecordMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [formData, setFormData] = useState<StoreFormData>({ type: 'Component', unit: 'Nos' });
  const [photos, setPhotos] = useState<File[]>([]);
  
  // UI feedback states
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rowNotice, setRowNotice] = useState<{ itemId: string; message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!rowNotice) return;
    const timer = setTimeout(() => setRowNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [rowNotice]);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      ...item,
      type: item.type || 'Component',
      unit: item.unit || 'Nos'
    });
    setPhotos([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: any) => {
    const isCurrentlyInactive = item.isActive === false || item.status === 'Inactive' || item.status === 'Deactivated';
    const newStatus = isCurrentlyInactive ? 'Active' : 'Deactivated';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "fg-item",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
      const successMsg = `FG Item "${item.name || 'Item'}" is now ${newStatus}.`;
      setRowNotice({ itemId: item._id, message: successMsg, type: 'success' });
      setToast({ type: 'success', message: successMsg });
    } catch (err: any) {
      const errMsg = extractErrorMessage(err, "Failed to update status");
      console.warn("Status toggle prevented:", errMsg);
      setRowNotice({ itemId: item._id, message: errMsg, type: 'error' });
      setToast({ type: 'error', message: errMsg });
    }
  };

  const handleDelete = async (id: string) => {
    const target = finishedGoods.find((m: any) => m._id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this FG item'}"?`)) {
      try {
        await deleteRecord({ tab: "fg-item", id }).unwrap();
        setToast({ type: 'success', message: `"${target?.name || 'Item'}" deleted successfully.` });
      } catch (error: any) {
        const errMsg = extractErrorMessage(error);
        if (target) {
          setRowNotice({ itemId: id, message: errMsg, type: 'error' });
          if (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction") || errMsg.toLowerCase().includes("fulfill")) {
            if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this item instead?`)) {
              handleToggleStatus(target);
            }
          }
        }
        setToast({ type: 'error', message: `Error deleting FG Item: ${errMsg}` });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = (formData.name || '').toString().trim();
    if (!cleanName) {
      setFormError("Item Name is required.");
      return;
    }

    // Guard against duplicate items in BOM
    if (Array.isArray(formData.bom) && formData.bom.length > 1) {
      const seen = new Set<string>();
      for (const b of (formData.bom as any[])) {
        const itemId = typeof b.item === 'object' && b.item !== null ? (b.item._id || b.item.id) : b.item;
        if (itemId) {
          const key = `${b.itemType || 'RawMaterial'}:${String(itemId)}`;
          if (seen.has(key)) {
            setFormError(`Cannot save BOM: "${b.itemName || 'Material'}" is added multiple times. Please click "Merge Qty" or remove the duplicate row.`);
            return;
          }
          seen.add(key);
        }
      }
    }

    try {
      const submitData = new FormData();

      // Core FG Item fields
      submitData.append('name', cleanName);
      if (formData.code && String(formData.code).trim()) {
        submitData.append('code', String(formData.code).trim());
      }
      submitData.append('type', formData.type || 'Component');
      submitData.append('unit', formData.unit || 'Nos');
      submitData.append('description', formData.description || '');
      submitData.append('revisionNumber', (formData.revisionNumber || '').toString().trim());
      submitData.append('reorderLevel', String(formData.reorderLevel ?? 0));

      // Handle location cleanly
      const locId = typeof formData.location === 'object' && formData.location !== null 
        ? formData.location._id 
        : formData.location;
      if (locId && String(locId).trim() && String(locId) !== 'Select Location') {
        submitData.append('location', String(locId).trim());
      }

      // Handle BOM cleanly
      if (Array.isArray(formData.bom)) {
        const cleanedBOM = formData.bom.map((bItem: any) => {
          const itemId = typeof bItem.item === 'object' && bItem.item !== null ? bItem.item._id : bItem.item;
          return {
            itemType: bItem.itemType || 'RawMaterial',
            item: itemId,
            itemName: bItem.itemName || '',
            quantity: Number(bItem.quantity) || 1,
            unit: bItem.unit || 'Nos'
          };
        }).filter((b: any) => b.item && b.itemName);
        submitData.append('bom', JSON.stringify(cleanedBOM));
      }

      // Handle photos cleanly
      if (Array.isArray(formData.photos)) {
        formData.photos.forEach((photo: any) => {
          if (photo instanceof File) {
            submitData.append('photos', photo);
          } else if (typeof photo === 'string') {
            submitData.append('photos', photo);
          }
        });
      }
      photos.forEach(photo => submitData.append('photos', photo));

      if (editingItem) {
        await updateRecord({ tab: "fg-item", id: editingItem._id, body: submitData, isFormData: true }).unwrap();
        setToast({ type: 'success', message: `"${cleanName}" updated successfully!` });
      } else {
        await createRecord({ tab: "fg-item", body: submitData, isFormData: true }).unwrap();
        setToast({ type: 'success', message: `"${cleanName}" created successfully!` });
      }
      setIsModalOpen(false);
      setFormData({ type: 'Component', unit: 'Nos' });
      setPhotos([]);
      setEditingItem(null);
      setFormError(null);
    } catch (error: any) {
      const errMsg = extractErrorMessage(error);
      console.warn("Save FG Item validation notice:", errMsg);
      setFormError(errMsg);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 relative">
      {/* Centered Error / Alert Modal */}
      {toast && toast.type === 'error' && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setToast(null)}
        >
          <div 
            className="relative max-w-md w-full p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Action Blocked
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed select-text">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setToast(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Center Success Notification Pill */}
      {toast && toast.type === 'success' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border backdrop-blur-md bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="h-[calc(100dvh-230px)] md:h-[calc(100vh-220px)] min-h-[420px]">
        <FinishedGoodsTable
          onAdd={() => {
            setEditingItem(null);
            setFormData({ type: 'Component', unit: 'Nos' });
            setPhotos([]);
            setFormError(null);
            setIsModalOpen(true);
          }} 
          data={finishedGoods} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onView={(item) => setPreviewItem(item)}
          rowNotice={rowNotice}
          onClearRowNotice={() => setRowNotice(null)}
        />
      </div>

      <MasterDetailPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        masterTab="fg-items"
        onEdit={(item) => handleEdit(item)}
        onDelete={(id) => handleDelete(id)}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormError(null);
        }}
        title={editingItem ? "Edit FG Item" : "Add FG Item"}
        maxWidth="7xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modal Error Banner */}
          {formError && (
            <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Unable to Save Finished Good</div>
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

          <FGItemForm
            formData={formData}
            setFormData={(data) => {
              if (formError) setFormError(null);
              setFormData(data);
            }}
            categories={categories}
            locations={locations}
            customers={customers}
            rawMaterials={rawMaterials}
            boughtOuts={boughtOuts}
            fgItems={finishedGoods}
            photos={photos}
            setPhotos={setPhotos}
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
              {isCreating || isUpdating ? "Saving..." : (editingItem ? "Update FG Item" : "Save FG Item")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
