import React from 'react';
import { Category, Location } from "@/src/features/store/types/store.types";
import { X, Plus, Trash2 } from 'lucide-react';
import SearchableSelect from '../SearchableSelect';

interface FGItemFormProps {
    formData: any;
    setFormData: (data: any) => void;
    categories?: Category[];
    locations?: Location[];
    customers?: any[];
    materials: any[]; // Materials for BOM
    fgItems: any[]; // Other FG Items for BOM
    photos: File[];
    setPhotos: (photos: File[]) => void;
}

export default function FGItemForm({
    formData,
    setFormData,
    locations = [],
    materials = [],
    fgItems = [],
    photos,
    setPhotos
}: FGItemFormProps) {
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

    const addBOMItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            bom: [...(prev.bom || []), { itemType: 'Material', item: '', itemName: '', quantity: 1, unit: 'Nos' }]
        }));
    };

    const updateBOMItem = (idx: number, field: string, value: any) => {
        const newBOM = [...(formData.bom || [])];
        newBOM[idx] = { ...newBOM[idx], [field]: value };
        
        if (field === 'item') {
            const type = newBOM[idx].itemType;
            let foundName = '';
            let foundUnit = 'Nos';
            if (type === 'Material') {
                const mat = materials.find(m => m._id === value);
                if (mat) {
                    foundName = mat.name;
                    foundUnit = mat.unit || mat.category?.unit || 'Nos';
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

    const renderSectionHeader = (title: string, colorClass: string = "bg-indigo-600") => (
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className={`w-1 h-4 ${colorClass} rounded`}></div>
            {title}
        </h3>
    );

    return (
        <div className="space-y-5">
            {/* Basic Details Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                {renderSectionHeader("Basic Details")}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Item Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="type"
                            value={formData.type || ''}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="" disabled>Select Item Type</option>
                            <option value="Assembly">Assembly</option>
                            <option value="Sub Assembly">Sub Assembly</option>
                            <option value="Component">Component</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Item Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name || ''}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter Item Name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Revision Number
                        </label>
                        <input
                            type="text"
                            name="revisionNumber"
                            value={formData.revisionNumber || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g. Rev 1.0"
                        />
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description / Technical Specifications
                        </label>
                        <textarea
                            name="description"
                            rows={2}
                            value={formData.description || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            placeholder="Enter technical specifications, application notes, or drawing details"
                        />
                    </div>
                </div>
            </div>

            {/* Store & Location Settings */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                {renderSectionHeader("Store & Location Settings", "bg-purple-600")}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <SearchableSelect
                            options={(locations || []).map(l => ({ value: l._id, label: l.name || '' }))}
                            value={typeof formData.location === 'object' ? formData.location?._id : formData.location || ''}
                            onChange={(val: any) => setFormData((prev: any) => ({ ...prev, location: val }))}
                            placeholder="Select Location"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="unit"
                            value={formData.unit || 'Nos'}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g. Nos, Set"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reorder Level / Min Stock
                        </label>
                        <input
                            type="number"
                            name="reorderLevel"
                            value={formData.reorderLevel !== undefined ? formData.reorderLevel : ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g. 10"
                        />
                    </div>
                </div>
            </div>

            {/* Photos & PDFs Attachment */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                {renderSectionHeader("Photos & Attachments", "bg-pink-500")}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Photos & PDFs (Max 5)
                    </label>
                    <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={handlePhotoChange}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {((photos && photos.length > 0) || (formData.photos && formData.photos.length > 0)) && (
                        <div className="flex flex-wrap gap-3 mt-3">
                            {photos.map((photo, idx) => {
                                const isPdf = photo.type === 'application/pdf';
                                const fileUrl = URL.createObjectURL(photo);
                                return (
                                    <div
                                        key={idx}
                                        className="relative group w-20 h-20 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shadow-sm"
                                    >
                                        {isPdf ? (
                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-2 text-center text-red-600 hover:underline">
                                                <span className="text-xs font-bold">PDF</span>
                                                <span className="text-[10px] text-gray-500 truncate max-w-[60px]">Preview</span>
                                            </a>
                                        ) : (
                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="w-full h-full">
                                                <img src={fileUrl} alt="preview" className="w-full h-full object-cover" />
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow"
                                            title="Remove"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                            {(!photos || photos.length === 0) && Array.isArray(formData.photos) && formData.photos.map((photo: string, idx: number) => {
                                const isPdf = typeof photo === 'string' && photo.toLowerCase().includes('.pdf');
                                return (
                                    <div
                                        key={`existing-${idx}`}
                                        className="relative group w-20 h-20 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shadow-sm"
                                    >
                                        {isPdf ? (
                                            <a href={photo} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-2 text-center text-red-600 hover:underline">
                                                <span className="text-xs font-bold">PDF</span>
                                                <span className="text-[10px] text-gray-500 truncate max-w-[60px]">Preview</span>
                                            </a>
                                        ) : (
                                            <a href={photo} target="_blank" rel="noreferrer" className="w-full h-full">
                                                <img src={photo} alt="attachment" className="w-full h-full object-cover" />
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bill of Materials (BOM) Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    {renderSectionHeader("Bill of Materials (BOM)", "bg-amber-500")}
                    <button
                        type="button"
                        onClick={addBOMItem}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors shadow-sm"
                    >
                        <Plus size={14} /> Add BOM Item
                    </button>
                </div>

                <div className="space-y-3">
                    {(formData.bom || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <select
                                value={item.itemType || ''}
                                onChange={e => updateBOMItem(idx, 'itemType', e.target.value)}
                                className="w-full md:w-1/4 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="Material">RM / BO (Material)</option>
                                <option value="FGItem">FG Item</option>
                            </select>
                            
                            <div className="w-full md:w-2/4">
                                <SearchableSelect 
                                    options={item.itemType === 'Material' ? 
                                        (materials || []).map(m => ({ value: m._id, label: `${m.name || ''} ${m.code ? `(${m.code})` : ''}` })) : 
                                        (fgItems || []).filter(f => f._id !== formData._id).map(f => ({ value: f._id, label: `${f.name || ''} (${f.type || ''})` }))
                                    }
                                    value={typeof item.item === 'object' ? item.item?._id : item.item || ''}
                                    onChange={(val: any) => updateBOMItem(idx, 'item', val)}
                                    placeholder="Select Item..."
                                />
                            </div>

                            <div className="w-1/2 md:w-1/4 flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    placeholder="Qty"
                                    value={item.quantity || ''}
                                    onChange={e => updateBOMItem(idx, 'quantity', parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                    required
                                />
                                <span className="text-xs font-medium text-gray-500 min-w-[35px]">{item.unit || 'Nos'}</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => removeBOMItem(idx)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 ml-auto"
                                title="Delete BOM Item"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {(!formData.bom || formData.bom.length === 0) && (
                        <div className="text-center py-6 bg-white border border-dashed border-gray-300 rounded-lg">
                            <p className="text-sm font-medium text-gray-500">No BOM items added.</p>
                            <p className="text-xs text-gray-400 mt-1">Add raw materials or other FG components to build the assembly structure.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
