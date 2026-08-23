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
    rawMaterials?: any[]; // Raw materials for BOM
    boughtOuts?: any[]; // Bought out items for BOM
    materials?: any[]; // Fallback materials
    fgItems?: any[]; // Other FG Items for BOM
    photos: File[];
    setPhotos: (photos: File[]) => void;
}

export default function FGItemForm({
    formData,
    setFormData,
    locations = [],
    rawMaterials = [],
    boughtOuts = [],
    materials = [],
    fgItems = [],
    photos,
    setPhotos
}: FGItemFormProps) {
    // Merge fallback materials if rawMaterials / boughtOuts are empty
    const effectiveRM = (rawMaterials && rawMaterials.length > 0) ? rawMaterials : materials.filter((m: any) => (m.itemType || '').toLowerCase().includes('raw') || (m.category?.name || '').toLowerCase().includes('raw') || !m.itemType);
    const effectiveBO = (boughtOuts && boughtOuts.length > 0) ? boughtOuts : materials.filter((m: any) => (m.itemType || '').toLowerCase().includes('bought') || (m.category?.name || '').toLowerCase().includes('bought'));

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
            bom: [...(prev.bom || []), { itemType: 'RawMaterial', item: '', itemName: '', quantity: 1, unit: 'Nos' }]
        }));
    };

    const handleBOMTypeChange = (idx: number, newType: 'RawMaterial' | 'BoughtOut' | 'FGItem') => {
        const newBOM = [...(formData.bom || [])];
        newBOM[idx] = {
            ...newBOM[idx],
            itemType: newType,
            item: '',
            itemName: '',
            unit: 'Nos'
        };
        setFormData((prev: any) => ({ ...prev, bom: newBOM }));
    };

    const updateBOMItem = (idx: number, field: string, value: any) => {
        const newBOM = [...(formData.bom || [])];
        newBOM[idx] = { ...newBOM[idx], [field]: value };
        
        if (field === 'item') {
            const type = newBOM[idx].itemType || 'RawMaterial';
            let foundName = '';
            let foundUnit = 'Nos';
            
            if (type === 'RawMaterial' || type === 'Material') {
                const mat = effectiveRM.find((m: any) => (m._id || m.id) === value);
                if (mat) {
                    foundName = mat.name || mat.materialName || '';
                    foundUnit = mat.unit || mat.category?.unit || 'Nos';
                }
            } else if (type === 'BoughtOut') {
                const bo = effectiveBO.find((b: any) => (b._id || b.id) === value);
                if (bo) {
                    foundName = bo.name || bo.materialName || '';
                    foundUnit = bo.unit || bo.category?.unit || 'Nos';
                }
            } else if (type === 'FGItem') {
                const fg = fgItems.find((f: any) => (f._id || f.id) === value);
                if (fg) {
                    foundName = fg.name || '';
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

            {/* Bill of Materials (BOM) Section */}
            <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    {renderSectionHeader("Bill of Materials (BOM)", "bg-amber-500")}
                    <button
                        type="button"
                        onClick={addBOMItem}
                        className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-3.5 py-2 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shadow-xs cursor-pointer"
                    >
                        <Plus size={15} /> Add BOM Item
                    </button>
                </div>

                <div className="space-y-3.5">
                    {(formData.bom || []).map((item: any, idx: number) => {
                        const currentType = item.itemType || 'RawMaterial';

                        // Options based on selected 3-way type
                        let optionsForThisType: any[] = [];
                        if (currentType === 'RawMaterial' || currentType === 'Material') {
                            optionsForThisType = effectiveRM.map((m: any) => ({
                                value: (m._id || m.id)?.toString(),
                                label: `${m.name || m.materialName || ''} ${m.code ? `(${m.code})` : ''}`.trim()
                            })).filter(o => o.value);
                        } else if (currentType === 'BoughtOut') {
                            optionsForThisType = effectiveBO.map((b: any) => ({
                                value: (b._id || b.id)?.toString(),
                                label: `${b.name || b.materialName || ''} ${b.code ? `(${b.code})` : ''}`.trim()
                            })).filter(o => o.value);
                        } else if (currentType === 'FGItem') {
                            optionsForThisType = fgItems
                                .filter((f: any) => (f._id || f.id)?.toString() !== formData._id?.toString())
                                .map((f: any) => ({
                                    value: (f._id || f.id)?.toString(),
                                    label: `${f.name || ''} ${f.code ? `(${f.code})` : ''} [${f.type || 'Sub Assembly'}]`.trim()
                                })).filter(o => o.value);
                        }

                        return (
                            <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
                                
                                {/* 3-Way BOM Classification Switcher + Remove Button */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                                    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => handleBOMTypeChange(idx, 'RawMaterial')}
                                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                currentType === 'RawMaterial' || currentType === 'Material'
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                                            }`}
                                        >
                                            Raw Material (RM)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBOMTypeChange(idx, 'BoughtOut')}
                                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                currentType === 'BoughtOut'
                                                    ? 'bg-amber-600 text-white shadow-xs'
                                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                                            }`}
                                        >
                                            Bought Out (BO)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBOMTypeChange(idx, 'FGItem')}
                                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                currentType === 'FGItem'
                                                    ? 'bg-purple-600 text-white shadow-xs'
                                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                                            }`}
                                        >
                                            FG / Sub-Assembly
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => removeBOMItem(idx)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                        title="Delete BOM Item"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Inputs Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    <div className="md:col-span-8">
                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                            {currentType === 'RawMaterial' || currentType === 'Material'
                                                ? 'Select Raw Material *'
                                                : currentType === 'BoughtOut'
                                                ? 'Select Bought Out Item *'
                                                : 'Select Sub-Assembly / FG Item *'}
                                        </label>
                                        <SearchableSelect 
                                            options={optionsForThisType}
                                            value={typeof item.item === 'object' ? (item.item?._id || item.item?.id) : (item.item || '')}
                                            onChange={(val: any) => updateBOMItem(idx, 'item', val)}
                                            placeholder={`Choose ${currentType === 'FGItem' ? 'Sub-Assembly FG' : currentType === 'BoughtOut' ? 'Bought Out Item' : 'Raw Material'}...`}
                                        />
                                    </div>

                                    <div className="md:col-span-4 flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                Qty Required *
                                            </label>
                                            <input
                                                type="number"
                                                min="0.001"
                                                step="any"
                                                placeholder="Qty"
                                                value={item.quantity || ''}
                                                onChange={e => updateBOMItem(idx, 'quantity', parseFloat(e.target.value))}
                                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-gray-900 dark:text-white"
                                                required
                                            />
                                        </div>

                                        <div className="w-20">
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                Unit
                                            </label>
                                            <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-300 text-center">
                                                {item.unit || 'Nos'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {(!formData.bom || formData.bom.length === 0) && (
                        <div className="text-center py-6 bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl">
                            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">No BOM items added.</p>
                            <p className="text-xs text-gray-400 mt-1">Add raw materials, bought out components, or sub-assemblies to build the multi-level BOM structure.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Photos & PDFs Attachment */}
            <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                {renderSectionHeader("Photos & Attachments", "bg-pink-500")}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Photos & PDFs (Max 5)
                    </label>
                    <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={handlePhotoChange}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {((photos && photos.length > 0) || (formData.photos && formData.photos.length > 0)) && (
                        <div className="flex flex-wrap gap-3 mt-3">
                            {photos.map((photo, idx) => {
                                const isPdf = photo.type === 'application/pdf';
                                const fileUrl = URL.createObjectURL(photo);
                                return (
                                    <div
                                        key={idx}
                                        className="relative group w-20 h-20 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shadow-sm"
                                    >
                                        {isPdf ? (
                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-2 text-center text-red-600 hover:underline">
                                                <span className="text-xs font-bold">PDF</span>
                                                <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate max-w-[60px]">Preview</span>
                                            </a>
                                        ) : (
                                            <a href={fileUrl} target="_blank" rel="noreferrer" className="w-full h-full">
                                                <img src={fileUrl} alt="preview" className="w-full h-full object-cover" />
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow cursor-pointer"
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
                                        className="relative group w-20 h-20 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shadow-sm"
                                    >
                                        {isPdf ? (
                                            <a href={photo} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-2 text-center text-red-600 hover:underline">
                                                <span className="text-xs font-bold">PDF</span>
                                                <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate max-w-[60px]">Preview</span>
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
        </div>
    );
}
