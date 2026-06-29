import React, { useState, useEffect } from 'react';
import { Customer, Category, Location } from '../../types/store.types';
import { Package, X, Plus, Trash2 } from 'lucide-react';

interface FGItemFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    formData: any;
    setFormData: (data: any) => void;
    customers: Customer[];
    categories: Category[];
    locations: Location[];
    loading?: boolean;
    isEditing?: boolean;
    materials: any[]; // Materials for BOM
    fgItems: any[]; // Other FG Items for BOM
    photos: File[];
    setPhotos: (photos: File[]) => void;
}

export default function FGItemForm({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    customers,
    categories,
    locations,
    loading,
    isEditing,
    materials,
    fgItems,
    photos,
    setPhotos
}: FGItemFormProps) {
    if (!isOpen) return null;

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setPhotos(Array.from(e.target.files));
        }
    };

    const removePhoto = (idx: number) => {
        setPhotos(photos.filter((_, i) => i !== idx));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleTypeChange = (type: string) => {
        setFormData((prev: any) => ({ ...prev, type }));
    };

    const addBOMItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            bom: [...(prev.bom || []), { itemType: 'Material', item: '', itemName: '', quantity: 1, unit: 'Nos' }]
        }));
    };

    const updateBOMItem = (idx: number, field: string, value: any) => {
        const newBOM = [...(formData.bom || [])];
        newBOM[idx] = { ...newBOM[idx], [field]: value };
        
        // Auto-fill name if item changes
        if (field === 'item') {
            const type = newBOM[idx].itemType;
            let foundName = '';
            let foundUnit = 'Nos';
            if (type === 'Material') {
                const mat = materials.find(m => m._id === value);
                if (mat) {
                    foundName = mat.name;
                    foundUnit = mat.category?.unit || 'Nos';
                }
            } else if (type === 'FGItem') {
                const fg = fgItems.find(f => f._id === value);
                if (fg) {
                    foundName = fg.name;
                    foundUnit = fg.unit || 'Nos';
                }
            }
            newBOM[idx].itemName = foundName;
            newBOM[idx].unit = foundUnit;
        }

        setFormData((prev: any) => ({ ...prev, bom: newBOM }));
    };

    const removeBOMItem = (idx: number) => {
        const newBOM = (formData.bom || []).filter((_: any, i: number) => i !== idx);
        setFormData((prev: any) => ({ ...prev, bom: newBOM }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl overflow-hidden flex flex-col max-h-[90vh] h-[90vh]">
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-5 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            {isEditing ? 'Edit FG Item' : 'Create FG Item'}
                        </h2>
                        <p className="text-violet-100 text-xs mt-1">
                            Manage Finished Goods and its BOM structure
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    <form id="fg-item-form" onSubmit={onSubmit} className="flex flex-col gap-5">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Item Type <span className="text-red-500">*</span></label>
                                <select name="type" value={formData.type || ''} onChange={handleChange} required className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none">
                                    <option value="" disabled>Select Item Type</option>
                                    <option value="Assembly">Assembly</option>
                                    <option value="Sub Assembly">Sub Assembly</option>
                                    <option value="Component">Component</option>
                                </select>
                            </div>

                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Item Name <span className="text-red-500">*</span></label>
                                <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 transition-all outline-none" placeholder="Item Name" />
                            </div>
                            
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                                <input type="text" name="description" value={formData.description || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 transition-all outline-none" placeholder="Description..." />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Revision Number</label>
                                <input type="text" name="revisionNumber" value={formData.revisionNumber || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 transition-all outline-none" placeholder="e.g. Rev 1.0" />
                            </div>
                             <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Photos & PDFs (Upload to S3)</label>
                                <input type="file" multiple accept="image/*,application/pdf" onChange={handlePhotoChange} className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100" />
                                {photos && photos.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {photos.map((photo, idx) => {
                                            const isPdf = photo.type === 'application/pdf';
                                            return (
                                            <div 
                                                key={idx} 
                                                className="relative group w-12 h-12 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer hover:border-violet-400 transition-colors"
                                                onClick={() => window.open(URL.createObjectURL(photo), '_blank')}
                                                title="Click to preview"
                                            >
                                                {isPdf ? (
                                                    <span className="text-xs font-bold text-red-500">PDF</span>
                                                ) : (
                                                    <img src={URL.createObjectURL(photo)} alt="preview" className="w-full h-full object-cover" />
                                                )}
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { e.stopPropagation(); removePhoto(idx); }} 
                                                    className="absolute top-1 right-1 bg-red-500 text-white flex items-center justify-center p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                                                    title="Remove"
                                                >
                                                    <X size={10} />
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
                                    <div className="w-1 h-4 bg-violet-600 rounded-full"></div> Store Settings
                                </h3>
                                
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Location</label>
                                    <select name="location" value={formData.location || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none">
                                        <option value="">Select Location</option>
                                        {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Unit <span className="text-red-500">*</span></label>
                                    <input type="text" name="unit" value={formData.unit || 'Nos'} onChange={handleChange} required className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-100" />

                        {/* BOM Section */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-orange-500 rounded-full"></div> Bill of Materials (BOM)
                                </h3>
                                <button type="button" onClick={addBOMItem} className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1.5 rounded hover:bg-orange-100 transition-colors">
                                    <Plus size={14} /> Add BOM Item
                                </button>
                            </div>

                            <div className="space-y-3">
                                {(formData.bom || []).map((item: any, idx: number) => (
                                    <div key={idx} className="flex gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <select value={item.itemType || ''} onChange={e => updateBOMItem(idx, 'itemType', e.target.value)} className="w-1/4 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded outline-none">
                                            <option value="Material">RM / BO (Material)</option>
                                            <option value="FGItem">FG Item</option>
                                        </select>
                                        <select value={item.item || ''} onChange={e => updateBOMItem(idx, 'item', e.target.value)} className="w-2/4 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded outline-none" required>
                                            <option value="">Select Item...</option>
                                            {item.itemType === 'Material' ? (
                                                materials.map(m => <option key={m._id} value={m._id}>{m.name} {m.code ? `(${m.code})` : ''}</option>)
                                            ) : (
                                                fgItems.filter(f => f._id !== formData._id).map(f => <option key={f._id} value={f._id}>{f.name} ({f.type})</option>)
                                            )}
                                        </select>
                                        <input type="number" min="0.001" step="any" placeholder="Qty" value={item.quantity || ''} onChange={e => updateBOMItem(idx, 'quantity', parseFloat(e.target.value))} className="w-1/4 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded outline-none" required />
                                        <span className="text-xs text-gray-500 w-16 truncate">{item.unit || 'Nos'}</span>
                                        <button type="button" onClick={() => removeBOMItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {(!formData.bom || formData.bom.length === 0) && (
                                    <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                                        <p className="text-sm text-gray-500">No BOM items added.</p>
                                        <p className="text-xs text-gray-400 mt-1">Add raw materials or other FG components.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all" disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" form="fg-item-form" disabled={loading} className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:shadow-lg hover:shadow-violet-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Saving...' : 'Save FG Item'}
                    </button>
                </div>
            </div>
        </div>
    );
}
