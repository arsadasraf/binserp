import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Camera, File, ArrowRight, ScanLine } from 'lucide-react';
import {
  useGetMaterialsQuery,
  useGetComponentsQuery,
  useGetMachinesQuery,
  useGetProcessesQuery,
  useCreateComponentMutation,
  useUpdateComponentMutation,
} from "@/src/store/services/ppcService";

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (msg: string) => void;
    initialLinkType?: "Assembly" | "SubAssembly" | "Component";
    initialData?: any;
}

type BomSourceType = "Store-Bo" | "Assembly" | "SubAssembly" | "Component";

export default function ProductForm({ isOpen, onClose, onSuccess, initialLinkType = "Assembly", initialData }: ProductFormProps) {
    // Unified Routing State
    const [routing, setRouting] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        componentName: "",
        componentCode: "",
        description: "",
        type: initialLinkType,
        unit: "Nos",
    });

    // Master Data from RTK Query
    const { data: materials = [] } = useGetMaterialsQuery(undefined, { skip: !isOpen });
    const { data: components = [] } = useGetComponentsQuery(undefined, { skip: !isOpen });
    const { data: machines = [] } = useGetMachinesQuery(undefined, { skip: !isOpen });
    const { data: processes = [] } = useGetProcessesQuery(undefined, { skip: !isOpen });

    const [createComponent] = useCreateComponentMutation();
    const [updateComponent] = useUpdateComponentMutation();

    // Top-level Photos
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const routingFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (initialData && initialData.photos && Array.isArray(initialData.photos)) {
                setExistingPhotos(initialData.photos);
            } else {
                setExistingPhotos([]);
            }
            setPhotoFiles([]);

            if (initialData) populateForm(initialData);
            else resetForm();
        }
    }, [isOpen, initialData]);

    const resetForm = () => {
        setFormData({
            componentName: "",
            componentCode: "",
            description: "",
            type: initialLinkType,
            unit: "Nos",
        });
        setRouting([]);
        setError("");
    };

    const populateForm = (data: any) => {
        setFormData({
            componentName: data.componentName || "",
            componentCode: data.componentCode || "",
            description: data.description || "",
            type: data.type || initialLinkType,
            unit: data.unit || "Nos",
        });

        // Map Routing with Nested Data
        if (data.routing && data.routing.length > 0) {
            setRouting(data.routing.map((r: any) => ({
                ...r,
                machine: r.machine?._id || r.machine || "",
                process: r.process?._id || r.process || "",
                processName: r.processName || "",
                description: r.description || "",
                standardTime: r.standardTime || 0,
                qcRequired: r.qcRequired || false,
                isOutsourced: r.isOutsourced || false,
                photos: r.photos || [], // Existing URLs
                photoFiles: [], // Reset new files
                requiredItems: r.requiredItems ? r.requiredItems.map((ri: any) => {
                    // map requiredItems back to UI structure
                    let sourceType: BomSourceType = "Store-Bo";
                    if (ri.itemModel === "Material") sourceType = "Store-Bo";
                    else {
                        const type = ri.item?.type;
                        if (type === "Assembly") sourceType = "Assembly";
                        else if (type === "SubAssembly") sourceType = "SubAssembly";
                        else sourceType = "Component";
                    }
                    return {
                        ...ri,
                        sourceType,
                        item: ri.item?._id || ri.item || "",
                        quantity: ri.quantity || 1,
                        unit: ri.unit || "Nos",
                        searchTerm: ri.item?.name || ri.item?.materialName || ri.item?.componentName || ""
                    };
                }) : []
            })));
        } else {
            // If legacy data has BOM but no routing items, maybe we should migrate? 
            // For now, start empty if no routing.
            setRouting([]);
        }
    };



    // --- Type Handlers ---
    const handleTypeChange = (type: "Assembly" | "SubAssembly" | "Component") => {
        setFormData({ ...formData, type });
    };

    // --- Photo Handlers ---
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setPhotoFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removePhoto = (index: number, isExisting: boolean) => {
        if (isExisting) {
            setExistingPhotos(existingPhotos.filter((_, i) => i !== index));
        } else {
            setPhotoFiles(photoFiles.filter((_, i) => i !== index));
        }
    };

    // --- Routing Handlers ---
    const addRoutingRow = () => {
        setRouting([...routing, {
            machine: "", process: "", processName: "", standardTime: 0, qcRequired: false, isOutsourced: false,
            requiredItems: [], photos: [], photoFiles: []
        }]);
    };

    const removeRoutingRow = (index: number) => {
        const newRouting = [...routing];
        newRouting.splice(index, 1);
        setRouting(newRouting);
    };

    const updateRoutingRow = (index: number, field: string, value: any) => {
        const newRouting = [...routing];
        newRouting[index] = { ...newRouting[index], [field]: value };
        setRouting(newRouting);
    };

    // Routing: Required Items Handlers
    const addRoutingItem = (routingIndex: number) => {
        const newRouting = [...routing];
        newRouting[routingIndex].requiredItems.push({ item: "", sourceType: "Store-Bo", quantity: 1, unit: "Nos", searchTerm: "" });
        setRouting(newRouting);
    };

    const removeRoutingItem = (routingIndex: number, itemIndex: number) => {
        const newRouting = [...routing];
        newRouting[routingIndex].requiredItems.splice(itemIndex, 1);
        setRouting(newRouting);
    };

    const updateRoutingItem = (routingIndex: number, itemIndex: number, field: string, value: any) => {
        const newRouting = [...routing];
        const itemRow = newRouting[routingIndex].requiredItems[itemIndex];

        const updatedRow = { ...itemRow, [field]: value };

        // Logic for Item Selection updates (replicated from old BOM logic)
        if (field === "sourceType") {
            updatedRow.item = "";
            updatedRow.unit = "Nos";
            updatedRow.searchTerm = "";
        }
        if (field === "item") {
            let collection = materials;
            if (updatedRow.sourceType === "Store-Bo") collection = materials;
            else if (updatedRow.sourceType === "Assembly") collection = components.filter(c => c.type === "Assembly");
            else if (updatedRow.sourceType === "SubAssembly") collection = components.filter(c => c.type === "SubAssembly");
            else collection = components.filter(c => c.type === "Component");

            const selected = collection.find(i => i._id === value);
            if (selected) {
                updatedRow.unit = selected.unit || "Nos";
                updatedRow.searchTerm = selected.name || selected.materialName || selected.componentName;
            }
        }

        newRouting[routingIndex].requiredItems[itemIndex] = updatedRow;
        setRouting(newRouting);
    };

    // Routing: Photo Handlers
    const handleRoutingPhotoChange = (routingIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const newRouting = [...routing];
            if (!newRouting[routingIndex].photoFiles) newRouting[routingIndex].photoFiles = [];
            newRouting[routingIndex].photoFiles.push(...newFiles);
            setRouting(newRouting);
        }
    };

    const removeRoutingPhoto = (routingIndex: number, photoIndex: number, isExisting: boolean) => {
        const newRouting = [...routing];
        if (isExisting) {
            newRouting[routingIndex].photos = newRouting[routingIndex].photos.filter((_: any, i: number) => i !== photoIndex);
        } else {
            newRouting[routingIndex].photoFiles = newRouting[routingIndex].photoFiles.filter((_: any, i: number) => i !== photoIndex);
        }
        setRouting(newRouting);
    };

    // --- Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const dataToSend = new FormData();
            dataToSend.append("componentName", formData.componentName);
            dataToSend.append("componentCode", formData.componentCode || "");
            dataToSend.append("description", formData.description || "");
            dataToSend.append("unit", formData.unit || "Nos");
            dataToSend.append("type", formData.type);

            photoFiles.forEach((file) => dataToSend.append("photos", file));
            if (initialData) dataToSend.append("existingPhotos", JSON.stringify(existingPhotos));

            const routingPayload = routing.map((r) => {
                const payload: any = {
                    processName: r.processName,
                    standardTime: Number(r.standardTime),
                    qcRequired: r.qcRequired,
                    isOutsourced: r.isOutsourced,
                    description: r.description || "",
                    existingPhotos: r.photos || []
                };
                if (r.process) payload.process = r.process;
                if (r.machine) payload.machine = r.machine;
                if (r.requiredItems) {
                    payload.requiredItems = r.requiredItems.map((ri: any) => ({
                        item: ri.item,
                        itemModel: ri.sourceType === "Store-Bo" ? "Material" : "Component",
                        quantity: Number(ri.quantity),
                        unit: ri.unit,
                        itemName: ri.searchTerm
                    }));
                }
                return payload;
            });

            dataToSend.append("routing", JSON.stringify(routingPayload));

            routing.forEach((r, index) => {
                if (r.photoFiles && r.photoFiles.length > 0) {
                    r.photoFiles.forEach((file: File) => dataToSend.append(`routing[${index}][photos]`, file));
                }
            });

            let res;
            if (initialData?._id) {
                res = await updateComponent({ id: initialData._id, body: dataToSend });
            } else {
                res = await createComponent(dataToSend);
            }

            if ("error" in res) {
                const err = res.error as any;
                setError(err?.data?.message || "Failed to save product. Please check your data.");
            } else {
                onSuccess(initialData ? "Product updated successfully!" : "Product created successfully!");
                onClose();
            }
        } catch (err: any) {
            console.error(err);
            setError("Error saving product.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 md:rounded-2xl shadow-xl w-full max-w-[100vw] h-[100dvh] md:h-[90vh] md:max-w-[95vw] lg:max-w-7xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                            {initialData ? "Edit Product" : "Create New Product"}
                        </h2>
                        <p className="text-sm text-gray-500">Define Assembly, Sub-Assembly, or component details</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin bg-gray-50/50 dark:bg-gray-900/50 pb-32">
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

                    <form id="product-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* TOP SECTION: Basic Info + Photos */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* Left: Basic Info (8 cols) */}
                            <div className="lg:col-span-8 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                {/* Decorative background accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>

                                <h3 className="text-base font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2 relative z-10">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <ScanLine size={18} />
                                    </div>
                                    Basic Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 relative z-10 p-1">
                                    {/* Row 1 */}
                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        <div className="group">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 group-focus-within:text-indigo-600 transition-colors">
                                                Product Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.componentName}
                                                onChange={(e) => setFormData({ ...formData, componentName: e.target.value })}
                                                placeholder="e.g. Gear Box Assembly"
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:bg-white dark:focus:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all duration-200 text-sm font-medium text-gray-800 dark:text-white placeholder-gray-400 shadow-sm"
                                            />
                                        </div>
                                        <div className="group">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 group-focus-within:text-indigo-600 transition-colors">
                                                Product Code <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.componentCode}
                                                onChange={(e) => setFormData({ ...formData, componentCode: e.target.value })}
                                                placeholder="e.g. ASM-101"
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:bg-white dark:focus:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all duration-200 text-sm font-medium text-gray-800 dark:text-white placeholder-gray-400 shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="group">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 group-focus-within:text-indigo-600 transition-colors">
                                            Type
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.type}
                                                onChange={(e) => handleTypeChange(e.target.value as any)}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:bg-white dark:focus:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all duration-200 text-sm font-medium text-gray-800 dark:text-white appearance-none shadow-sm cursor-pointer"
                                            >
                                                <option value="Assembly">Assembly</option>
                                                <option value="SubAssembly">Sub Assembly</option>
                                                <option value="Component">Component</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="md:col-span-2 group">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 group-focus-within:text-indigo-600 transition-colors">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Write a brief description..."
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:bg-white dark:focus:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all duration-200 text-sm font-medium text-gray-800 dark:text-white placeholder-gray-400 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right: Photos (4 cols) */}
                            <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col relative overflow-hidden">
                                {/* Decorative background accent */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>

                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                                            <Camera size={18} />
                                        </div>
                                        Photos
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="text-xs bg-gray-900 text-white hover:bg-black px-3 py-1.5 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add
                                    </button>
                                </div>
                                <input
                                    type="file"
                                    ref={galleryInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handlePhotoChange}
                                />

                                <div className="flex-1 overflow-y-auto max-h-[140px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 grid grid-cols-3 gap-3 align-start content-start pr-1">
                                    {/* Existing Photos */}
                                    {existingPhotos.map((url, idx) => (
                                        <div key={`existing-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <img src={url} alt={`Existing ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200"></div>
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(idx, true)}
                                                className="absolute top-1 right-1 p-1 bg-white text-red-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 scale-90 group-hover:scale-100"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* New Photos */}
                                    {photoFiles.map((file, idx) => (
                                        <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group border-2 border-dashed border-indigo-300 bg-indigo-50/30">
                                            <img src={URL.createObjectURL(file)} alt={`New ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200"></div>
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(idx, false)}
                                                className="absolute top-1 right-1 p-1 bg-white text-red-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 scale-90 group-hover:scale-100"
                                            >
                                                <X size={12} />
                                            </button>
                                            <div className="absolute bottom-0 inset-x-0 bg-indigo-600/90 backdrop-blur-sm text-white text-[9px] py-1 text-center font-medium">New Upload</div>
                                        </div>
                                    ))}

                                    {existingPhotos.length === 0 && photoFiles.length === 0 && (
                                        <div className="col-span-3 flex flex-col items-center justify-center py-6 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50">
                                            <Camera size={24} className="mb-2 opacity-50" />
                                            <span className="text-xs">No photos yet</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM SECTION: Unified Process Routing */}
                        <div className="flex flex-col gap-6 h-full min-h-[450px]">

                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col relative overflow-hidden flex-1">
                                <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-gray-700 pb-3">
                                    <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                            <ArrowRight size={18} />
                                        </div>
                                        Process Operations & Inputs
                                        <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 ml-2">
                                            {routing.length} Steps
                                        </div>
                                    </h3>
                                    <button type="button" onClick={addRoutingRow} className="text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border border-emerald-100">
                                        <Plus size={14} /> Add Operation
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 pr-1 -mr-2">
                                    <div className="space-y-6 pl-4 pb-10">
                                        {/* Routing List */}
                                        {routing.map((row, idx) => (
                                            <div key={idx} className="relative pl-8">
                                                {/* Connecting Line */}
                                                {idx !== routing.length - 1 && (
                                                    <div className="absolute left-[11px] top-8 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                                                )}

                                                {/* Step Number Bubble */}
                                                <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 border-2 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center z-10 shadow-sm">
                                                    {idx + 1}
                                                </div>

                                                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600 transition-all group duration-200">

                                                    {/* STEP HEADER: Process, Machine, Time */}
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start mb-4">
                                                        <div className="md:col-span-4 w-full">
                                                            {/* Production Type Toggle */}
                                                            <div className="flex items-center gap-2 mb-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-max">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRoutingRow(idx, 'isOutsourced', false)}
                                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${!row.isOutsourced ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    In-House
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRoutingRow(idx, 'isOutsourced', true)}
                                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${row.isOutsourced ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    Jobwork
                                                                </button>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Process</div>
                                                            <select
                                                                value={row.process || ""}
                                                                onChange={(e) => {
                                                                    const selectedId = e.target.value;
                                                                    const selectedProcess = processes.find(p => p._id === selectedId);
                                                                    const newRouting = [...routing];
                                                                    newRouting[idx] = {
                                                                        ...newRouting[idx],
                                                                        process: selectedId,
                                                                        processName: selectedProcess ? selectedProcess.processName : ""
                                                                    };
                                                                    setRouting(newRouting);
                                                                }}
                                                                className="w-full text-sm font-bold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-lg border-transparent focus:border-emerald-500 focus:ring-0 py-2 h-10"
                                                            >
                                                                <option value="">Select Process...</option>
                                                                {processes.map((p: any) => (
                                                                    <option key={p._id} value={p._id}>{p.processName}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="md:col-span-4 w-full">
                                                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Machine</div>
                                                            <select
                                                                value={row.machine}
                                                                onChange={(e) => updateRoutingRow(idx, 'machine', e.target.value)}
                                                                className="w-full text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg border-transparent focus:border-emerald-500 focus:ring-0 py-2 h-10"
                                                            >
                                                                <option value="">Manual / No Machine</option>
                                                                {machines.map((m: any) => (
                                                                    <option key={m._id} value={m._id}>{m.machineName}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="md:col-span-2 w-1/2 md:w-full">
                                                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Std. Time</div>
                                                            <div className="relative">
                                                                <input
                                                                    type="number" min="0"
                                                                    value={row.standardTime}
                                                                    onChange={(e) => updateRoutingRow(idx, 'standardTime', e.target.value)}
                                                                    className="w-full text-sm font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-lg border-transparent focus:border-emerald-500 focus:ring-0 py-2 pr-8 h-10"
                                                                    placeholder="0"
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">min</span>
                                                            </div>
                                                        </div>

                                                        <div className="md:col-span-2 w-full flex md:flex-col justify-end h-full pb-1 mt-2 md:mt-0">
                                                            <div className="flex items-center gap-2 justify-end">

                                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={row.qcRequired}
                                                                        onChange={(e) => updateRoutingRow(idx, 'qcRequired', e.target.checked)}
                                                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                                                                    />
                                                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">QC Required</span>
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeRoutingRow(idx)}
                                                                    className="ml-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Remove Operation"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">

                                                        {/* LEFT SUB-COL: Required Items */}
                                                        <div className="bg-gray-50/50 dark:bg-gray-900/30 rounded-lg p-3 border border-dashed border-gray-200 dark:border-gray-700">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                                                    Required Inputs / Materials
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addRoutingItem(idx)}
                                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                                                >
                                                                    + Add Input
                                                                </button>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {row.requiredItems && row.requiredItems.map((item: any, iIdx: number) => (
                                                                    <div key={iIdx} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-md border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                        {/* Source Type */}
                                                                        <div className="relative min-w-[50px]">
                                                                            <select
                                                                                value={item.sourceType}
                                                                                onChange={(e) => updateRoutingItem(idx, iIdx, 'sourceType', e.target.value)}
                                                                                className="w-full text-[9px] uppercase font-bold tracking-wider bg-gray-100 dark:bg-gray-700 rounded py-0.5 pl-1 pr-3 border-none focus:ring-0 text-gray-600 dark:text-gray-300 cursor-pointer appearance-none"
                                                                            >
                                                                                <option value="Store-Bo">Bo</option>
                                                                                <option value="Assembly">ASM</option>
                                                                                <option value="SubAssembly">SUB</option>
                                                                                <option value="Component">COM</option>
                                                                            </select>
                                                                        </div>

                                                                        {/* Item Selector */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <select
                                                                                value={item.item}
                                                                                onChange={(e) => updateRoutingItem(idx, iIdx, 'item', e.target.value)}
                                                                                className="w-full text-xs font-medium text-gray-700 dark:text-gray-200 bg-transparent border-none p-0 focus:ring-0 truncate cursor-pointer hover:text-blue-600"
                                                                            >
                                                                                <option value="">Select Item...</option>
                                                                                {(() => {
                                                                                    let filtered = [];
                                                                                    if (item.sourceType === "Store-Bo") filtered = materials;
                                                                                    else if (item.sourceType === "Assembly") filtered = components.filter(c => c.type === "Assembly");
                                                                                    else if (item.sourceType === "SubAssembly") filtered = components.filter(c => c.type === "SubAssembly");
                                                                                    else filtered = components.filter(c => c.type === "Component");
                                                                                    
                                                                                    if (filtered.length === 0) {
                                                                                        return <option value="" disabled>No {item.sourceType === "Store-Bo" ? "Materials" : item.sourceType + "s"} found!</option>;
                                                                                    }
                                                                                    
                                                                                    return filtered.map((m: any) => (
                                                                                        <option key={m._id} value={m._id}>
                                                                                            {m.name || m.materialName || m.componentName}
                                                                                        </option>
                                                                                    ));
                                                                                })()}
                                                                            </select>
                                                                        </div>

                                                                        {/* Qty */}
                                                                        <input
                                                                            type="number" min="0.01" step="0.01"
                                                                            value={item.quantity}
                                                                            onChange={(e) => updateRoutingItem(idx, iIdx, 'quantity', e.target.value)}
                                                                            className="w-10 text-right text-xs font-semibold bg-transparent border-b border-gray-200 dark:border-gray-600 focus:border-blue-500 p-0 text-gray-800 dark:text-white"
                                                                            placeholder="Qty"
                                                                        />
                                                                        <span className="text-[9px] text-gray-400 uppercase w-6 truncate">{item.unit}</span>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeRoutingItem(idx, iIdx)}
                                                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                {(!row.requiredItems || row.requiredItems.length === 0) && (
                                                                    <div className="text-center py-2 text-[10px] text-gray-400 italic">No inputs required</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* RIGHT SUB-COL: Photos */}
                                                        <div className="bg-gray-50/50 dark:bg-gray-900/30 rounded-lg p-3 border border-dashed border-gray-200 dark:border-gray-700 flex flex-col">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                                                    Process Photos
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        // Trigger file input for this index
                                                                        const fileInput = document.getElementById(`routing-photo-${idx}`);
                                                                        if (fileInput) fileInput.click();
                                                                    }}
                                                                    className="text-[10px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition-colors flex items-center gap-1"
                                                                >
                                                                    <Camera size={10} /> Add Photo
                                                                </button>
                                                                <input
                                                                    type="file"
                                                                    id={`routing-photo-${idx}`}
                                                                    className="hidden"
                                                                    multiple
                                                                    accept="image/*"
                                                                    onChange={(e) => handleRoutingPhotoChange(idx, e)}
                                                                />
                                                            </div>

                                                            <div className="flex-1 flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200">
                                                                {/* Display Existing Photos */}
                                                                {row.photos && row.photos.map((url: string, pIdx: number) => (
                                                                    <div key={`exist-${pIdx}`} className="relative group shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                                                                        <img src={url} className="w-full h-full object-cover" />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeRoutingPhoto(idx, pIdx, true)}
                                                                            className="absolute top-0 right-0 p-0.5 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-sm"
                                                                        >
                                                                            <X size={10} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                {/* Display New Files */}
                                                                {row.photoFiles && row.photoFiles.map((file: File, pIdx: number) => (
                                                                    <div key={`new-${pIdx}`} className="relative group shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-dashed border-purple-300 bg-purple-50">
                                                                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-80" />
                                                                        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white bg-black/30 pointer-events-none">NEW</div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeRoutingPhoto(idx, pIdx, false)}
                                                                            className="absolute top-0 right-0 p-0.5 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-sm"
                                                                        >
                                                                            <X size={10} />
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                {(!row.photos?.length && !row.photoFiles?.length) && (
                                                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 italic min-h-[40px]">
                                                                        No photos
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </div>

                                                </div>
                                            </div>
                                        ))}
                                        {routing.length === 0 && (
                                            <div className="h-40 flex flex-col items-center justify-center text-gray-400 space-y-3 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm">
                                                    <ArrowRight size={20} className="opacity-30" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No routing steps</p>
                                                    <p className="text-xs text-gray-400 mt-1">Define the process flow to add materials and photos</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                    </form>
                </div>

                {/* Footer actions */}
                <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 fixed bottom-0 left-0 right-0 md:relative z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none pb-safe-offset-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="product-form"
                        className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                        disabled={submitting}
                    >
                        {submitting ? "Saving..." : initialData ? "Update Product" : "Create Product"}
                    </button>
                </div>

            </div>
        </div>
    );
}
