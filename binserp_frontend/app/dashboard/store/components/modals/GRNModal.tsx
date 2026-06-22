/**
 * GRNModal Component - Enhanced Version
 * 
 * Modal dialog for creating/editing Goods Receipt Notes (GRN).
 * Features:
 * - Auto-generated GRN number based on date and time
 * - Supplier selection with searchable dropdown (or Customer for InHouse)
 * - Multiple material entries support
 * - Auto-filled unit and category from selected material
 * - Location selection from master data
 * - Improved UI/UX with clear visual hierarchy
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Camera } from 'lucide-react';
import { GRNModalProps, Material } from '../../types/store.types';

interface MaterialEntry {
    material: string;
    materialName: string;
    quantity: number;
    unit: string;
    category: string;
    locationId: string;
    rate: number;  // Price per unit
}

export default function GRNModal({
    isOpen,
    onClose,
    onSubmit,
    materials,
    vendors,
    customers = [], // Default to empty array
    locations,
    loading,
    initialData,
    isEditing = false,
    type = 'bo', // Default to 'bo'
}: GRNModalProps) {
    const safeMaterials = Array.isArray(materials) ? materials : [];
    const safeVendors = Array.isArray(vendors) ? vendors : [];
    const safeCustomers = Array.isArray(customers) ? customers : [];

    // Form state
    const [grnNumber, setGrnNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplier, setSupplier] = useState('');
    const [customer, setCustomer] = useState(''); // New state for customer
    const [poReference, setPoReference] = useState('');
    const [qcRequired, setQcRequired] = useState(false); // New state for QC Check
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]); // New state for existing URLs
    const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([{
        material: '',
        materialName: '',
        quantity: 0,
        unit: '',
        category: '',
        locationId: '',
        rate: 0,
    }]);

    // Refs for file inputs
    const cameraInputRef = React.useRef<HTMLInputElement>(null);
    const galleryInputRef = React.useRef<HTMLInputElement>(null);

    /**
     * Generates GRN number based on current date and time
     * Format: GRN/YYYYMMDD-HHMMSS
     */
    const generateGRNNumber = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `GRN/${year}${month}${day}-${hours}${minutes}${seconds}`;
    };

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (isEditing && initialData) {
                setGrnNumber(initialData.grnNumber || '');
                setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
                setSupplier(initialData.supplier || '');
                setCustomer(initialData.customerId || ''); // Assuming customerId in initialData
                setPoReference(initialData.poReference || '');
                setExistingPhotos(initialData.photos || []); // Load existing photos
                // Note: PDF and photos from server are URLs, not files

                // Populate material entries from items array if available
                if (Array.isArray(initialData.items) && initialData.items.length > 0) {
                    const entries = initialData.items.map((item: any) => ({
                        material: item.material?._id || item.material || '', // SAFE ACCESS
                        materialName: item.materialName || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        category: item.category || '',
                        locationId: item.locationId || '',
                        rate: item.rate || 0,  // FIXED: Populate rate
                    }));
                    setMaterialEntries(entries);
                } else {
                    // Fallback to single material format
                    setMaterialEntries([{
                        material: initialData.material || '',
                        materialName: initialData.materialName || '',
                        quantity: initialData.quantity || 0,
                        unit: initialData.unit || '',
                        category: initialData.category || '',
                        locationId: initialData.locationId || '',
                        rate: initialData.rate || 0,  // FIXED: Populate rate
                    }]);
                    setQcRequired(initialData.qcRequired || false); // Load QC status if editing
                }
            } else {
                setGrnNumber(generateGRNNumber());
                setDate(new Date().toISOString().split('T')[0]);
                setSupplier('');
                setCustomer('');
                setPoReference('');
                setQcRequired(false); // Reset QC status
                setPdfFile(null);
                setPhotoFiles([]);
                setExistingPhotos([]);
                setMaterialEntries([{
                    material: '',
                    materialName: '',
                    quantity: 0,
                    unit: '',
                    category: '',
                    locationId: '',
                    rate: 0,
                }]);
            }
        }
    }, [isOpen, isEditing, initialData]);

    /**
     * Handles material selection for a specific entry
     * Auto-fills unit, category, and location from selected material
     */
    const handleMaterialChange = (index: number, materialId: string) => {
        const selectedMaterial = safeMaterials.find(item => item._id === materialId);
        // For InHouse (components), mapped properties might differ slightly, but assuming consistent 'unit' and 'category' if available
        // If materials are components, adapt as needed.

        // Check if selectedMaterial is a Component (InHouse) or Material (BO)
        // Ideally types should verify this, but for now we assume dynamic access
        const isComponent = type === 'inhouse';

        const newEntries = [...materialEntries];
        newEntries[index] = {
            ...newEntries[index],
            material: materialId,
            materialName: selectedMaterial?.name || (selectedMaterial as any)?.componentName || '',
            unit: isComponent ? 'Nos' : (getCategoryUnit(selectedMaterial) || ''), // Default unit for components is often Nos
            category: isComponent ? 'InHouse' : (getCategoryName(selectedMaterial) || ''),
            // Auto-fill location from material if available
            locationId: getLocationId(selectedMaterial) || newEntries[index].locationId,
        };
        setMaterialEntries(newEntries);
    };

    /**
     * Helper function to get category unit from material
     */
    const getCategoryUnit = (material: Material | undefined): string => {
        if (!material) return '';
        if (typeof material.categoryId === 'object' && material.categoryId?.unit) {
            return material.categoryId.unit;
        }
        return material.category?.unit || '';
    };

    /**
     * Helper function to get category name from material
     */
    const getCategoryName = (material: Material | undefined): string => {
        if (!material) return '';
        if (typeof material.categoryId === 'object' && material.categoryId?.name) {
            return material.categoryId.name;
        }
        return material.category?.name || '';
    };

    /**
     * Helper function to get location ID from material
     */
    const getLocationId = (material: Material | undefined): string => {
        if (!material) return '';
        // Handle InHouse component location if needed, otherwise standard logic
        if (typeof material.locationId === 'object' && material.locationId?._id) {
            return material.locationId._id;
        }
        if (typeof material.locationId === 'string') {
            return material.locationId;
        }
        return material.location?._id || '';
    };

    /**
     * Updates a field in a specific material entry
     */
    const updateEntry = (index: number, field: keyof MaterialEntry, value: any) => {
        const newEntries = [...materialEntries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setMaterialEntries(newEntries);
    };

    /**
     * Adds a new material entry
     */
    const addMaterialEntry = () => {
        setMaterialEntries([...materialEntries, {
            material: '',
            materialName: '',
            quantity: 0,
            unit: '',
            category: '',
            locationId: '',
            rate: 0,
        }]);
    };

    /**
     * Removes a material entry
     */
    const removeMaterialEntry = (index: number) => {
        if (materialEntries.length > 1) {
            setMaterialEntries(materialEntries.filter((_, i) => i !== index));
        }
    };

    /**
     * Handles form submission
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare items array with all material entries
        const items = materialEntries.map(entry => ({
            material: entry.material,
            fgItem: entry.material,
            materialName: entry.materialName,
            quantity: entry.quantity,
            unit: entry.unit,
            locationId: entry.locationId,
            rate: entry.rate,
        }));

        // Create FormData for file uploads
        const formData = new FormData();
        formData.append('grnNumber', grnNumber);
        formData.append('date', date);
        formData.append('type', type); // Add type
        formData.append('qcRequired', String(qcRequired)); // Send boolean as string if needed, backend body-parser usually handles booleans if JSON, but safe as string/boolean


        if (type === 'bo') {
            formData.append('supplier', supplier);
            if (poReference) formData.append('poReference', poReference);
            // Add PDF if selected
            if (pdfFile) {
                formData.append('pdf', pdfFile);
            }
            // Add photos if selected
            photoFiles.forEach((photo) => {
                formData.append('photos', photo);
            });
            // Add existing photos to keep
            if (isEditing) {
                formData.append('existingPhotos', JSON.stringify(existingPhotos));
            }
        } else {
            // InHouse explicitly does NOT send customer, poReference, pdf, photos
        }



        // Add items as JSON string, relevant for both BO and InHouse
        formData.append('items', JSON.stringify(items));

        // For backward compatibility (if backend expects flat fields for single item)
        // Assuming backend handles 'items' array primarily now, or we might need to adjust based on backend logic
        formData.append('material', materialEntries[0]?.material || '');
        formData.append('materialName', materialEntries[0]?.materialName || '');
        formData.append('quantity', String(materialEntries[0]?.quantity || 0));
        formData.append('unit', materialEntries[0]?.unit || '');
        formData.append('locationId', materialEntries[0]?.locationId || '');
        formData.append('category', materialEntries[0]?.category || '');
        if (type === 'bo') {
            formData.append('rate', String(materialEntries[0]?.rate || 0));
        }

        onSubmit(formData as any);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[105]" onClick={onClose} />

            {/* Modal content */}
            <div className="fixed inset-0 flex items-center justify-center z-[110] p-2 sm:p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                    {/* Modal header */}
                    <div className={`flex items-center justify-between p-4 border-b ${type === 'inhouse' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600'}`}>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {isEditing ? 'Edit GRN' : `Create ${type === 'inhouse' ? 'InHouse' : ''} GRN`}
                            </h2>
                            <p className="text-indigo-100 text-xs mt-0.5">
                                {type === 'inhouse' ? 'Receive InHouse components' : 'Add materials received from supplier'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors text-white"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal body - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <form id="grn-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* GRN Details Section - Compact */}
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <div className={`w-1 h-4 ${type === 'inhouse' ? 'bg-purple-600' : 'bg-indigo-600'} rounded`}></div>
                                    GRN Details
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* GRN Number */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            GRN Number
                                        </label>
                                        <input
                                            type="text"
                                            value={grnNumber}
                                            readOnly
                                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-mono text-xs cursor-not-allowed"
                                        />
                                    </div>



                                    {/* Date */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    {/* QC Required Checkbox */}
                                    {/* QC Required Checkbox */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Quality Control
                                        </label>
                                        <div className="flex items-center h-[30px]"> {/* Match rough height of inputs */}
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={qcRequired}
                                                    onChange={(e) => setQcRequired(e.target.checked)}
                                                    className={`w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500`}
                                                />
                                                <span className="text-xs font-medium text-gray-700">Required</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Supplier - BO Only */}
                                    {type === 'bo' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Supplier <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                required
                                                value={supplier}
                                                onChange={(e) => setSupplier(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                            >
                                                <option value="">Select Supplier</option>
                                                {safeVendors.map((vendor) => (
                                                    <option key={vendor._id} value={vendor._id}>
                                                        {vendor.name} {vendor.code ? `(${vendor.code})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* PO Reference - BO Only */}
                                    {type === 'bo' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                PO Reference
                                            </label>
                                            <input
                                                type="text"
                                                value={poReference}
                                                onChange={(e) => setPoReference(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                                placeholder="Enter PO No."
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Photos Section - BO Only */}
                            {type === 'bo' && (
                                <div className="mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Photos <span className="text-gray-400 font-normal">(Goods, Invoice, etc.)</span>
                                    </label>

                                    <div className="flex flex-col gap-4">
                                        {/* Small Action Icons */}
                                        <div className="flex items-center gap-4">
                                            {/* Camera Button */}
                                            <div
                                                onClick={() => cameraInputRef.current?.click()}
                                                className="cursor-pointer group flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-xl hover:bg-indigo-50 hover:border-indigo-500 transition-all shadow-sm active:scale-95 touch-manipulation"
                                            >
                                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                                    <Camera className="w-5 h-5" />
                                                </div>
                                                <span className="text-sm text-gray-700 font-semibold">Camera</span>
                                                <input
                                                    ref={cameraInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    capture="environment" // Rear camera
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 0) {
                                                            const newFiles = Array.from(e.target.files);
                                                            setPhotoFiles(prev => [...prev, ...newFiles]);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>

                                            {/* Gallery Button */}
                                            <div
                                                onClick={() => galleryInputRef.current?.click()}
                                                className="cursor-pointer group flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-xl hover:bg-green-50 hover:border-green-500 transition-all shadow-sm active:scale-95 touch-manipulation"
                                            >
                                                <div className="p-2 bg-green-50 rounded-lg text-green-600 group-hover:bg-green-100 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <span className="text-sm text-gray-700 font-semibold">Gallery</span>
                                                <input
                                                    ref={galleryInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 0) {
                                                            const newFiles = Array.from(e.target.files);
                                                            setPhotoFiles(prev => [...prev, ...newFiles]);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Preview Row */}
                                        <div className="flex flex-wrap gap-3">
                                            {/* New Photo Previews */}
                                            {photoFiles.map((file, index) => (
                                                <div key={`new-${index}`} className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden group shadow-sm bg-white">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt={`New ${index}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setPhotoFiles(files => files.filter((_, i) => i !== index))}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Remove photo"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}

                                            {/* Existing Server Photos */}
                                            {existingPhotos.map((url, index) => (
                                                <div key={`server-${index}`} className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden shrink-0 shadow-sm bg-gray-50 group">
                                                    <img
                                                        src={url}
                                                        alt={`Server Photo ${index}`}
                                                        className="w-full h-full object-cover opacity-90"
                                                    />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] py-0.5 text-center">
                                                        Saved
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExistingPhotos(prev => prev.filter((_, i) => i !== index))}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Remove saved photo"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Materials Section */}
                            {/* Materials Section */}
                            <div className={`bg-white rounded-xl border-2 ${type === 'inhouse' ? 'border-purple-100' : 'border-indigo-100'}`}>
                                <div className={`p-3 border-b rounded-t-xl flex items-center justify-between ${type === 'inhouse' ? 'border-purple-100 bg-purple-50' : 'border-indigo-100 bg-indigo-50'}`}>
                                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <div className={`w-1 h-4 ${type === 'inhouse' ? 'bg-purple-600' : 'bg-indigo-600'} rounded`}></div>
                                        {type === 'inhouse' ? 'Items Received' : 'Material Entries'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={addMaterialEntry}
                                        className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm ${type === 'inhouse' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                        title="Add Item"
                                    >
                                        <Plus size={14} /> Add Item
                                    </button>
                                </div>

                                {/* Desktop View: Table Layout */}
                                <div className="hidden md:block overflow-x-auto p-2">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-gray-500">
                                                <th className="px-2 py-2 w-10">#</th>
                                                <th className="px-2 py-2 w-1/3">{type === 'inhouse' ? 'Component/Item' : 'Material'} <span className="text-red-500">*</span></th>
                                                <th className="px-2 py-2 w-24">Qty <span className="text-red-500">*</span></th>
                                                <th className="px-2 py-2 w-20">Unit</th>
                                                {type === 'bo' && <th className="px-2 py-2 w-28">Rate (₹)</th>}
                                                <th className="px-2 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {materialEntries.map((entry, index) => (
                                                <tr key={`desktop-${index}`} className="group hover:bg-gray-50 transition-colors">
                                                    <td className="px-2 py-2 text-gray-400 font-medium">{index + 1}</td>
                                                    <td className="px-2 py-2">
                                                        <select
                                                            required
                                                            value={entry.material}
                                                            onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                                        >
                                                            <option value="">Select {type === 'inhouse' ? 'Item' : 'Material'}</option>
                                                            {safeMaterials.map((item) => (
                                                                <option key={item._id} value={item._id}>
                                                                    {type === 'inhouse'
                                                                        ? `${(item as any).componentName || item.name} ${(item as any).description ? `(${(item as any).description})` : ''}`
                                                                        : `${item.name || (item as any).componentName} ${(item.code || (item as any).componentCode) ? `(${item.code || (item as any).componentCode})` : ''}`
                                                                    }
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            required
                                                            min="0"
                                                            step="0.01"
                                                            value={entry.quantity || ''}
                                                            onChange={(e) => updateEntry(index, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2 text-gray-500">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={entry.unit || '-'}
                                                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 cursor-not-allowed"
                                                        />
                                                    </td>
                                                    {type === 'bo' && (
                                                        <td className="px-2 py-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={entry.rate || ''}
                                                                onChange={(e) => updateEntry(index, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                                                placeholder="0.00"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {/* Add button only on last row */}
                                                            {index === materialEntries.length - 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={addMaterialEntry}
                                                                    className={`p-1.5 text-white rounded transition-colors shadow-sm ${type === 'inhouse' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                                                    title="Add New Item"
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                            )}

                                                            {/* Delete button */}
                                                            {materialEntries.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeMaterialEntry(index)}
                                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Remove"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile View: Card Layout */}
                                <div className="md:hidden p-4 space-y-4">
                                    {materialEntries.map((entry, index) => (
                                        <div key={`mobile-${index}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200 relative">
                                            {/* Entry number badge */}
                                            <div className={`absolute -top-3 -left-3 w-6 h-6 text-white rounded-full flex items-center justify-center font-bold text-xs ${type === 'inhouse' ? 'bg-purple-600' : 'bg-indigo-600'}`}>
                                                {index + 1}
                                            </div>

                                            {/* Action buttons (Top Right) */}
                                            <div className="absolute -top-3 -right-3 flex items-center gap-1">
                                                {/* Add button only on last card */}
                                                {index === materialEntries.length - 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={addMaterialEntry}
                                                        className={`w-6 h-6 text-white rounded-full flex items-center justify-center hover:opacity-90 transition-colors shadow-sm ${type === 'inhouse' ? 'bg-purple-600' : 'bg-indigo-600'}`}
                                                        title="Add New Item"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                )}

                                                {/* Delete button */}
                                                {materialEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMaterialEntry(index)}
                                                        className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-3 mt-1">
                                                {/* Material */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        {type === 'inhouse' ? 'Component/Item' : 'Material'} <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        required
                                                        value={entry.material}
                                                        onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                                    >
                                                        <option value="">Select {type === 'inhouse' ? 'Item' : 'Material'}</option>
                                                        {safeMaterials.map((item) => (
                                                            <option key={item._id} value={item._id}>
                                                                {type === 'inhouse'
                                                                    ? `${(item as any).componentName || item.name} ${(item as any).description ? `(${(item as any).description})` : ''}`
                                                                    : `${item.name || (item as any).componentName} ${(item.code || (item as any).componentCode) ? `(${item.code || (item as any).componentCode})` : ''}`
                                                                }
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    {/* Quantity */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Quantity <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            required
                                                            min="0"
                                                            step="0.01"
                                                            value={entry.quantity || ''}
                                                            onChange={(e) => updateEntry(index, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                                            placeholder="0"
                                                        />
                                                    </div>

                                                    {/* Unit (ReadOnly) */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Unit
                                                        </label>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={entry.unit || ''}
                                                            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 text-sm"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Rate/Price - BO Only */}
                                                {type === 'bo' && (
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Rate (Optional)
                                                        </label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={entry.rate || ''}
                                                                onChange={(e) => updateEntry(index, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {materialEntries.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            No items added. Click "Add Item" to start.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Modal footer - Fixed at bottom */}
                    <div className="p-6 border-t bg-gray-50">
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                form="grn-form"
                                disabled={loading}
                                className={`flex-1 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl ${type === 'inhouse' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'}`}
                            >
                                {loading ? 'Saving...' : isEditing ? 'Update GRN' : 'Create GRN'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 bg-white text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors border-2 border-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div >
            </div >
        </>
    );
}
