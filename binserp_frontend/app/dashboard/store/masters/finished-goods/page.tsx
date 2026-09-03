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

const extractErrorMessage = (error: any): string => {
  if (!error) return "Failed to save Finished Good. Please check required fields.";
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
  return "Failed to save Finished Good. Please check required fields.";
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

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
    const newStatus = isCurrentlyInactive ? 'Active' : 'Inactive';
    const newActive = isCurrentlyInactive;
    try {
      await updateRecord({
        tab: "fg-item",
        id: item._id,
        body: { status: newStatus, isActive: newActive }
      }).unwrap();
      setToast({ type: 'success', message: `Item status updated to ${newStatus}` });
    } catch (err: any) {
      console.error("Failed to update status", err);
      setToast({ type: 'error', message: `Failed to update status: ${extractErrorMessage(err)}` });
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
        if (target && (errMsg.toLowerCase().includes("stock") || errMsg.toLowerCase().includes("active") || errMsg.toLowerCase().includes("transaction") || errMsg.toLowerCase().includes("fulfill"))) {
          if (confirm(`${errMsg}\n\nWould you like to DEACTIVATE this item instead?`)) {
            handleToggleStatus(target);
          }
        } else {
          setToast({ type: 'error', message: `Error deleting FG Item: ${errMsg}` });
        }
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
