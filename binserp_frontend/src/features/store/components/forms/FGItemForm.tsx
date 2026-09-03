import React from 'react';
import { Category, Location } from "@/src/features/store/types/store.types";
import { X, Plus, Trash2, Box, Layers, ShoppingBag, Paperclip, FileText, Upload, AlertTriangle } from 'lucide-react';
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
    const effectiveRM = (rawMaterials && rawMaterials.length > 0) 
        ? rawMaterials 
        : materials.filter((m: any) => (m.itemType || '').toLowerCase().includes('raw') || (m.category?.name || '').toLowerCase().includes('raw') || !m.itemType);
        
    const effectiveBO = (boughtOuts && boughtOuts.length > 0) 
        ? boughtOuts 
        : materials.filter((m: any) => (m.itemType || '').toLowerCase().includes('bought') || (m.category?.name || '').toLowerCase().includes('bought'));

    // Check for duplicate name & revision
    const currentName = (formData.name || '').trim().toLowerCase();
    const currentRev = (formData.revisionNumber || '').trim().toLowerCase();
    const currentId = formData._id || formData.id;

    const duplicateFG = React.useMemo(() => {
        if (!currentName) return null;
        return (fgItems || []).find((item: any) => {
            const itemId = item._id || item.id;
            if (currentId && itemId === currentId) return false;
            const itemName = (item.name || '').trim().toLowerCase();
            const itemRev = (item.revisionNumber || '').trim().toLowerCase();
            return itemName === currentName && itemRev === currentRev;
        });
    }, [fgItems, currentName, currentRev, currentId]);

    const hasSameNameDifferentRev = React.useMemo(() => {
        if (!currentName || duplicateFG) return false;
        return (fgItems || []).some((item: any) => {
            const itemId = item._id || item.id;
            if (currentId && itemId === currentId) return false;
            const itemName = (item.name || '').trim().toLowerCase();
            const itemRev = (item.revisionNumber || '').trim().toLowerCase();
            return itemName === currentName && itemRev !== currentRev;
        });
    }, [fgItems, currentName, currentRev, currentId, duplicateFG]);

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

    // Helper to track duplicate BOM items by compound key (itemType:itemId)
    const duplicateInfo = React.useMemo(() => {
        const map = new Map<string, number[]>();
        (formData.bom || []).forEach((b: any, idx: number) => {
            const itemId = typeof b.item === 'object' && b.item !== null ? (b.item._id || b.item.id) : b.item;
            if (itemId) {
                const key = `${b.itemType || 'RawMaterial'}:${String(itemId)}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(idx);
            }
        });
        return map;
    }, [formData.bom]);

    const mergeDuplicateBOMItem = (sourceIdx: number, targetIdx: number) => {
        const newBOM = [...(formData.bom || [])];
        const sourceQty = Number(newBOM[sourceIdx]?.quantity) || 0;
        const targetQty = Number(newBOM[targetIdx]?.quantity) || 0;
        newBOM[targetIdx] = {
            ...newBOM[targetIdx],
            quantity: Number((targetQty + sourceQty).toFixed(4))
        };
        // Remove source duplicate row
        const filtered = newBOM.filter((_: any, i: number) => i !== sourceIdx);
        setFormData((prev: any) => ({ ...prev, bom: filtered }));
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
            itemDescription: '',
            itemClassification: '',
            itemRevision: '',
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
            let foundDesc = '';
            let foundClassification = '';
            let foundRevision = '';
            
            if (type === 'RawMaterial' || type === 'Material') {
                const mat = effectiveRM.find((m: any) => (m._id || m.id) === value);
                if (mat) {
                    foundName = mat.name || mat.materialName || '';
                    foundDesc = mat.descriptions || mat.description || '';
                    foundUnit = mat.unit || mat.category?.unit || 'Nos';
                }
            } else if (type === 'BoughtOut') {
                const bo = effectiveBO.find((b: any) => (b._id || b.id) === value);
                if (bo) {
                    foundName = bo.name || bo.materialName || '';
                    foundDesc = bo.descriptions || bo.description || '';
                    foundUnit = bo.unit || bo.category?.unit || 'Nos';
                }
            } else if (type === 'FGItem') {
                const fg = fgItems.find((f: any) => (f._id || f.id) === value);
                if (fg) {
                    foundName = fg.name || '';
                    foundDesc = fg.description || fg.descriptions || '';
                    foundUnit = fg.unit || 'Nos';
                    foundClassification = fg.type || 'Component';
                    foundRevision = fg.revisionNumber || '';
                }
            }
            newBOM[idx].itemName = foundName;
            newBOM[idx].itemDescription = foundDesc;
            newBOM[idx].itemClassification = foundClassification;
            newBOM[idx].itemRevision = foundRevision;
            newBOM[idx].unit = foundUnit;
        }

        setFormData((prev: any) => ({ ...prev, bom: newBOM }));
    };

    const removeBOMItem = (idx: number) => {
        const newBOM = (formData.bom || []).filter((_: any, i: number) => i !== idx);
        setFormData((prev: any) => ({ ...prev, bom: newBOM }));
    };

    // Construct options with Name and Description ONLY, plus badges for FG Items (Type & Revision)
    const getOptionsForType = (currentType: string, currentLineIdx?: number) => {
        if (currentType === 'RawMaterial' || currentType === 'Material') {
            return effectiveRM.map((m: any) => {
                const val = (m._id || m.id)?.toString();
                const name = (m.name || m.materialName || '').trim();
                const desc = (m.descriptions || m.description || '').trim();
                const alreadyLine = (formData.bom || []).findIndex((b: any, i: number) => 
                    i !== currentLineIdx && 
                    (b.itemType === 'RawMaterial' || b.itemType === 'Material') && 
                    (typeof b.item === 'object' ? b.item?._id : b.item)?.toString() === val
                );
                return {
                    value: val,
                    label: desc ? `${name} — ${desc}` : name,
                    description: desc || undefined,
                    hint: alreadyLine >= 0 ? `Line #${alreadyLine + 1}` : undefined
                };
            }).filter(o => o.value);
        } else if (currentType === 'BoughtOut') {
            return effectiveBO.map((b: any) => {
                const val = (b._id || b.id)?.toString();
                const name = (b.name || b.materialName || '').trim();
                const desc = (b.descriptions || b.description || '').trim();
                const alreadyLine = (formData.bom || []).findIndex((b: any, i: number) => 
                    i !== currentLineIdx && 
                    b.itemType === 'BoughtOut' && 
                    (typeof b.item === 'object' ? b.item?._id : b.item)?.toString() === val
                );
                return {
                    value: val,
                    label: desc ? `${name} — ${desc}` : name,
                    description: desc || undefined,
                    hint: alreadyLine >= 0 ? `Line #${alreadyLine + 1}` : undefined
                };
            }).filter(o => o.value);
        } else if (currentType === 'FGItem') {
            return fgItems
                .filter((f: any) => (f._id || f.id)?.toString() !== formData._id?.toString())
                .map((f: any) => {
                    const val = (f._id || f.id)?.toString();
                    const name = (f.name || '').trim();
                    const desc = (f.description || f.descriptions || '').trim();
                    const type = f.type || 'Component';
                    const rev = f.revisionNumber ? `Rev: ${f.revisionNumber}` : 'No Rev';
                    const alreadyLine = (formData.bom || []).findIndex((b: any, i: number) => 
                        i !== currentLineIdx && 
                        b.itemType === 'FGItem' && 
                        (typeof b.item === 'object' ? b.item?._id : b.item)?.toString() === val
                    );
                    return {
                        value: val,
                        label: name,
                        description: desc || undefined,
                        badge: type,
                        subBadge: rev,
                        hint: alreadyLine >= 0 ? `Line #${alreadyLine + 1}` : undefined
                    };
                }).filter(o => o.value);
        }
        return [];
    };

    // Helper to get description for selected BOM item
    const getSelectedItemDescription = (bItem: any) => {
        if (bItem.itemDescription) return bItem.itemDescription;
        const itemId = typeof bItem.item === 'object' && bItem.item !== null ? (bItem.item._id || bItem.item.id) : bItem.item;
        if (!itemId) return '';

        const type = bItem.itemType || 'RawMaterial';
        if (type === 'RawMaterial' || type === 'Material') {
            const found = effectiveRM.find((m: any) => (m._id || m.id)?.toString() === itemId.toString());
            if (found) return found.descriptions || found.description || '';
        } else if (type === 'BoughtOut') {
            const found = effectiveBO.find((b: any) => (b._id || b.id)?.toString() === itemId.toString());
            if (found) return found.descriptions || found.description || '';
        } else if (type === 'FGItem') {
            const found = fgItems.find((f: any) => (f._id || f.id)?.toString() === itemId.toString());
            if (found) return found.description || found.descriptions || '';
        }
        if (typeof bItem.item === 'object' && bItem.item !== null) {
            return bItem.item.descriptions || bItem.item.description || '';
        }
        return '';
    };

    // Helper to get classification type for selected BOM item (if FG)
    const getSelectedItemClassification = (bItem: any) => {
        if (bItem.itemClassification) return bItem.itemClassification;
        const itemId = typeof bItem.item === 'object' && bItem.item !== null ? (bItem.item._id || bItem.item.id) : bItem.item;
        if (!itemId) return '';
        const found = fgItems.find((f: any) => (f._id || f.id)?.toString() === itemId.toString());
        return found?.type || '';
    };

    // Helper to get revision number for selected BOM item (if FG)
    const getSelectedItemRevision = (bItem: any) => {
        if (bItem.itemRevision !== undefined && bItem.itemRevision !== null && bItem.itemRevision !== '') return bItem.itemRevision;
        const itemId = typeof bItem.item === 'object' && bItem.item !== null ? (bItem.item._id || bItem.item.id) : bItem.item;
        if (!itemId) return '';
        const found = fgItems.find((f: any) => (f._id || f.id)?.toString() === itemId.toString());
        return found?.revisionNumber || '';
    };

    // Helper to get display label for selected BOM item (Name + Description, NO code)
    const getSelectedItemDisplayLabel = (bItem: any) => {
        const itemId = typeof bItem.item === 'object' && bItem.item !== null ? (bItem.item._id || bItem.item.id) : bItem.item;
        const currentType = bItem.itemType || 'RawMaterial';
        const options = getOptionsForType(currentType);
        const match = options.find(o => o.value === (itemId?.toString() || ''));
        if (match) return match.label;
        
        const name = bItem.itemName || (typeof bItem.item === 'object' ? bItem.item?.name : '');
        const desc = getSelectedItemDescription(bItem);
        if (name && desc) return `${name} — ${desc}`;
        return name || '';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: FG Item Details & Settings (5 cols on desktop) */}
            <div className="lg:col-span-5 space-y-4">
                {/* Basic Details Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800 text-sm font-bold text-gray-900 dark:text-white">
                        <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                        <span>Item Details</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Classification <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="type"
                                value={formData.type || 'Component'}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 dark:text-white"
                            >
                                <option value="Component">Component</option>
                                <option value="Sub Assembly">Sub Assembly</option>
                                <option value="Assembly">Assembly</option>
                            </select>
                        </div>

                        <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Revision
                            </label>
                            <input
                                type="text"
                                name="revisionNumber"
                                value={formData.revisionNumber || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 dark:text-white"
                                placeholder="e.g. Rev 1.0"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Item Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name || ''}
                                onChange={handleChange}
                                required
                                className={`w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border rounded-lg focus:ring-2 outline-none text-gray-900 dark:text-white ${
                                    duplicateFG 
                                        ? 'border-rose-400 focus:ring-rose-400 dark:border-rose-600' 
                                        : 'border-gray-300 dark:border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                                placeholder="Enter finished good item name"
                            />
                            {duplicateFG && (
                                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50">
                                    <span className="font-semibold shrink-0">Duplicate:</span>
                                    <span>An FG Item with this name and revision {formData.revisionNumber ? `("${formData.revisionNumber}")` : '(empty revision)'} already exists. Specify a new revision number (e.g. Rev 2.0) to create a new version.</span>
                                </div>
                            )}
                            {hasSameNameDifferentRev && (
                                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                                    <span className="font-semibold shrink-0">New Revision:</span>
                                    <span>An FG item named &ldquo;{formData.name}&rdquo; exists. Saving with revision &ldquo;{formData.revisionNumber || 'empty'}&rdquo; will create a new version of it.</span>
                                </div>
                            )}
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Description
                            </label>
                            <textarea
                                name="description"
                                rows={2}
                                value={formData.description || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 dark:text-white resize-none"
                                placeholder="Specifications, dimensions, or technical notes..."
                            />
                        </div>
                    </div>
                </div>

                {/* Storage & Inventory Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800 text-sm font-bold text-gray-900 dark:text-white">
                        <div className="w-1.5 h-4 bg-purple-600 rounded-full" />
                        <span>Storage & Inventory</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Storage Location
                            </label>
                            <SearchableSelect
                                options={(locations || []).map(l => ({ value: l._id, label: l.name || '' }))}
                                value={typeof formData.location === 'object' ? formData.location?._id : formData.location || ''}
                                onChange={(val: any) => setFormData((prev: any) => ({ ...prev, location: val }))}
                                placeholder="Select Location"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Unit <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="unit"
                                value={formData.unit || 'Nos'}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 dark:text-white"
                                placeholder="Nos"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Reorder Level
                            </label>
                            <input
                                type="number"
                                name="reorderLevel"
                                value={formData.reorderLevel !== undefined ? formData.reorderLevel : ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 dark:text-white"
                                placeholder="Min stock"
                            />
                        </div>
                    </div>
                </div>

                {/* Attachments & Drawings Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800 text-sm font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-pink-500 rounded-full" />
                            <span>Drawings & Photos</span>
                        </div>
                        <span className="text-[11px] font-normal text-gray-400">PDF / Images</span>
                    </div>

                    <div>
                        <label className="relative flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl cursor-pointer bg-gray-50/50 dark:bg-slate-800/30 transition-colors">
                            <Upload size={16} className="text-gray-400" />
                            <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Choose files to attach</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*,application/pdf"
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                        </label>

                        {((photos && photos.length > 0) || (formData.photos && formData.photos.length > 0)) && (
                            <div className="flex flex-wrap gap-2.5 mt-3">
                                {photos.map((photo, idx) => {
                                    const isPdf = photo.type === 'application/pdf';
                                    const fileUrl = URL.createObjectURL(photo);
                                    return (
                                        <div
                                            key={`new-photo-${idx}`}
                                            className="relative group w-14 h-14 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-xs"
                                        >
                                            {isPdf ? (
                                                <a href={fileUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-1 text-center text-red-600 hover:underline">
                                                    <FileText size={16} />
                                                    <span className="text-[9px] font-bold">PDF</span>
                                                </a>
                                            ) : (
                                                <a href={fileUrl} target="_blank" rel="noreferrer" className="w-full h-full">
                                                    <img src={fileUrl} alt="preview" className="w-full h-full object-cover" />
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                                                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow cursor-pointer"
                                                title="Remove"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    );
                                })}

                                {(!photos || photos.length === 0) && Array.isArray(formData.photos) && formData.photos.map((photo: string, idx: number) => {
                                    const isPdf = typeof photo === 'string' && photo.toLowerCase().includes('.pdf');
                                    return (
                                        <div
                                            key={`existing-photo-${idx}`}
                                            className="relative group w-14 h-14 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-xs"
                                        >
                                            {isPdf ? (
                                                <a href={photo} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-1 text-center text-red-600 hover:underline">
                                                    <FileText size={16} />
                                                    <span className="text-[9px] font-bold">PDF</span>
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

            {/* Right Column: Bill of Materials (BOM) Workbench (7 cols on desktop) */}
            <div className="lg:col-span-7 space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-slate-800 shadow-xs">
                    {/* BOM Header */}
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                Bill of Materials (BOM)
                            </h3>
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                {(formData.bom || []).length} items
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={addBOMItem}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>Add Material</span>
                        </button>
                    </div>

                    {/* BOM Items List */}
                    <div className="space-y-3">
                        {(formData.bom || []).map((item: any, idx: number) => {
                            const currentType = item.itemType || 'RawMaterial';
                            const optionsForThisType = getOptionsForType(currentType, idx);
                            const selectedDisplayLabel = getSelectedItemDisplayLabel(item);
                            const selectedDesc = getSelectedItemDescription(item);
                            const rawItemId = typeof item.item === 'object' && item.item !== null ? (item.item?._id || item.item?.id) : item.item;
                            
                            // Check if duplicate of an earlier line
                            const itemKey = rawItemId ? `${currentType}:${String(rawItemId)}` : '';
                            const lineIndices = itemKey ? duplicateInfo.get(itemKey) || [] : [];
                            const isDuplicate = lineIndices.length > 1 && lineIndices[0] !== idx;
                            const earlierLineIdx = isDuplicate ? lineIndices[0] : null;

                            const selectedClassification = getSelectedItemClassification(item);
                            const selectedRevision = getSelectedItemRevision(item);

                            return (
                                <div
                                    key={idx}
                                    className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                                        isDuplicate
                                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20'
                                            : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/80 hover:border-indigo-200 dark:hover:border-indigo-800'
                                    }`}
                                >
                                    {/* Top Row: Type Selector Pills + Row Index + Delete Button */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                                                #{idx + 1}
                                            </span>
                                            {/* Type Pills */}
                                            <div className="inline-flex p-0.5 bg-gray-200/80 dark:bg-slate-700/60 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => handleBOMTypeChange(idx, 'RawMaterial')}
                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                        currentType === 'RawMaterial' || currentType === 'Material'
                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                            : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                                                    }`}
                                                >
                                                    RM
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleBOMTypeChange(idx, 'BoughtOut')}
                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                        currentType === 'BoughtOut'
                                                            ? 'bg-amber-600 text-white shadow-xs'
                                                            : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                                                    }`}
                                                >
                                                    BO
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleBOMTypeChange(idx, 'FGItem')}
                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                        currentType === 'FGItem'
                                                            ? 'bg-purple-600 text-white shadow-xs'
                                                            : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                                                    }`}
                                                >
                                                    FG / Sub-Assy
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeBOMItem(idx)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Delete Material"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>

                                    {/* Duplicate Item Warning Banner with 1-Click Merge Action */}
                                    {isDuplicate && earlierLineIdx !== null && (
                                        <div className="flex items-center justify-between gap-2 p-2.5 bg-amber-100/80 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-100 animate-in fade-in duration-200">
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                                <span>Duplicate item! Already in <strong>Line #{earlierLineIdx + 1}</strong>.</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => mergeDuplicateBOMItem(idx, earlierLineIdx)}
                                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                            >
                                                Merge Qty with #{earlierLineIdx + 1}
                                            </button>
                                        </div>
                                    )}

                                    {/* Inputs: Material Searchable Select + Qty + Unit */}
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                        <div className="sm:col-span-8">
                                            <SearchableSelect
                                                options={optionsForThisType}
                                                value={typeof item.item === 'object' && item.item !== null ? (item.item?._id || item.item?.id) : (item.item || '')}
                                                displayLabel={selectedDisplayLabel}
                                                onChange={(val: any) => updateBOMItem(idx, 'item', val)}
                                                placeholder={`Select ${currentType === 'FGItem' ? 'Sub-Assembly / FG' : currentType === 'BoughtOut' ? 'Bought Out Item' : 'Raw Material'}...`}
                                            />
                                        </div>

                                        <div className="sm:col-span-4 flex items-center gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    placeholder="Qty"
                                                    value={item.quantity || ''}
                                                    onChange={e => updateBOMItem(idx, 'quantity', parseFloat(e.target.value))}
                                                    className="w-full px-2.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-gray-900 dark:text-white"
                                                    required
                                                />
                                            </div>

                                            <div className="w-16 shrink-0 px-2 py-2 bg-gray-200/70 dark:bg-slate-700/60 rounded-lg text-xs font-bold text-gray-700 dark:text-slate-300 text-center truncate">
                                                {item.unit || 'Nos'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* If FG Item: Rich Classification Badges (Type & Revision) */}
                                    {currentType === 'FGItem' && rawItemId && (
                                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                            {selectedClassification && (
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                                    selectedClassification === 'Assembly'
                                                        ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                        : selectedClassification === 'Sub Assembly'
                                                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                        : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                                }`}>
                                                    Type: {selectedClassification}
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                {selectedRevision ? `Rev: ${selectedRevision}` : 'No Rev'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Inline Description Preview if available */}
                                    {selectedDesc && (
                                        <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate px-1 flex items-center gap-1.5">
                                            <span className="font-semibold text-gray-700 dark:text-slate-300 shrink-0">Desc:</span>
                                            <span className="truncate">{selectedDesc}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Bottom Add Button so user does not need to scroll to top */}
                        {(formData.bom || []).length > 0 && (
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={addBOMItem}
                                    className="w-full py-2.5 px-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
                                >
                                    <Plus size={15} className="group-hover:scale-110 transition-transform" />
                                    <span>Add Another BOM Item</span>
                                </button>
                            </div>
                        )}

                        {(!formData.bom || formData.bom.length === 0) && (
                            <div className="text-center py-10 bg-gray-50/50 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl space-y-2">
                                <Box className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto" />
                                <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                                    No BOM items added
                                </p>
                                <button
                                    type="button"
                                    onClick={addBOMItem}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                >
                                    <Plus size={13} />
                                    <span>Add First Item</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
