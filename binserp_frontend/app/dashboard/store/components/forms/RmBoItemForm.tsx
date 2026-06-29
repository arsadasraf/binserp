import React, { useState, useEffect } from 'react';
import { Customer, Category, Location } from '../../types/store.types';
import { Package, X } from 'lucide-react';

interface RmBoItemFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    formData: any;
    setFormData: (data: any) => void;
    categories: Category[];
    locations: Location[];
    loading?: boolean;
    isEditing?: boolean;
}

export default function RmBoItemForm({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    categories,
    locations,
    loading,
    isEditing
}: RmBoItemFormProps) {
    if (!isOpen) return null;

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const currentPhotos = formData.photos || [];
            if (currentPhotos.length + newFiles.length > 2) {
                alert("You can only upload up to 2 photos.");
                return;
            }
            setFormData({ ...formData, photos: [...currentPhotos, ...newFiles].slice(0, 2) });
        }
    };

    const removePhoto = (idx: number) => {
        const currentPhotos = formData.photos || [];
        setFormData({ ...formData, photos: currentPhotos.filter((_: any, i: number) => i !== idx) });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const categoryId = e.target.value;
        const selectedCategory = categories.find(cat => cat._id === categoryId);
        setFormData((prev: any) => ({
            ...prev,
            categoryId,
            unit: selectedCategory?.unit || '',
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            {isEditing ? 'Edit RM/BO Item' : 'Create RM/BO Item'}
                        </h2>
                        <p className="text-blue-100 text-xs mt-1">
                            Manage Raw Materials and Bought Out Items
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    <form id="rm-bo-item-form" onSubmit={onSubmit} className="flex flex-col gap-5">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Item Name <span className="text-red-500">*</span></label>
                                <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="Item Name" />
                            </div>
                            
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                                <input type="text" name="descriptions" value={formData.descriptions || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="Description..." />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Minimum Stock</label>
                                <input type="number" name="minimumStock" value={formData.minimumStock || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="0" />
                            </div>
                             <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Photos (Upload S3, Max 2)</label>
                                <input type="file" multiple accept="image/*" onChange={handlePhotoChange} className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                {formData.photos && formData.photos.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.photos.map((photo: any, idx: number) => {
                                            const photoUrl = typeof photo === 'string' ? photo : URL.createObjectURL(photo);
                                            return (
                                            <div key={idx} className="relative group w-12 h-12 rounded-md border border-gray-200 overflow-hidden">
                                                <img src={photoUrl} alt="preview" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => removePhoto(idx)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-indigo-600 rounded-full"></div> Store Settings
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
                                    <select name="categoryId" value={formData.categoryId || ''} onChange={handleCategoryChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Location</label>
                                    <select name="locationId" value={formData.locationId || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">Select Location</option>
                                        {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Unit</label>
                                    <input type="text" name="unit" value={formData.unit || ''} readOnly className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-500 outline-none cursor-not-allowed" placeholder="Auto-filled" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all" disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" form="rm-bo-item-form" disabled={loading} className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Saving...' : 'Save RM/BO Item'}
                    </button>
                </div>
            </div>
        </div>
    );
}
