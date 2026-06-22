import React, { useState, useEffect } from "react";
import Image from "next/image";

interface MachineFormProps {
    initialData?: any;
    onSubmit: (formData: FormData) => void;
    onCancel: () => void;
    loading: boolean;
}

export default function MachineForm({
    initialData,
    onSubmit,
    onCancel,
    loading,
}: MachineFormProps) {
    const [formData, setFormData] = useState({
        machineName: "",
        machineCode: "",
        machineType: "",
        hourlyRate: "",
        capacity: "",
        location: "",
        specifications: "",
        status: "Available",
    });
    const [photos, setPhotos] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                machineName: initialData.machineName || "",
                machineCode: initialData.machineCode || "",
                machineType: initialData.machineType || "",
                hourlyRate: initialData.hourlyRate || "",
                capacity: initialData.capacity || "",
                location: initialData.location || "",
                specifications: initialData.specifications || "",
                status: initialData.status || "Available",
            });
            setExistingPhotos(initialData.photos || []);
        }
    }, [initialData]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setPhotos((prev) => [...prev, ...files]);

            // Create preview URLs
            const newPreviews = files.map((file) => URL.createObjectURL(file));
            setPreviewUrls((prev) => [...prev, ...newPreviews]);
        }
    };

    const removePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = new FormData();

        // Explicitly append fields to handle types correctly
        Object.entries(formData).forEach(([key, value]) => {
            // Skip empty strings for optional numeric fields to avoid CastError
            if ((key === "hourlyRate" || key === "capacity") && value === "") {
                return;
            }
            data.append(key, value);
        });

        photos.forEach((photo) => {
            data.append("photos", photo);
        });

        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Machine Name *</label>
                    <input
                        type="text"
                        name="machineName"
                        value={formData.machineName}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. CNC Mill B3"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Machine Code *</label>
                    <input
                        type="text"
                        name="machineCode"
                        value={formData.machineCode}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. MAC-001"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Type *</label>
                    <input
                        type="text"
                        name="machineType"
                        value={formData.machineType}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. Lathe"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Status</label>
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    >
                        <option value="Available">Available (Green)</option>
                        <option value="Busy">Busy (Yellow)</option>
                        <option value="Maintenance">Maintenance (Gray)</option>
                        <option value="Breakdown">Breakdown (Red)</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Hourly Rate (₹)</label>
                    <input
                        type="number"
                        name="hourlyRate"
                        value={formData.hourlyRate}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Capacity (Units/Hr)</label>
                    <input
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="0"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    />
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Location</label>
                    <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="e.g. Shop Floor 1, Bay 3"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none"
                    />
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Specifications / Details</label>
                    <textarea
                        name="specifications"
                        value={formData.specifications}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder="Enter technical specifications, dimensions, power requirements, etc..."
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white outline-none resize-none"
                    />
                </div>

                <div className="md:col-span-2 space-y-3">
                    <label className="text-sm font-semibold text-gray-700">Machine Photos</label>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {/* Existing Photos */}
                        {existingPhotos.map((url, idx) => (
                            <div key={`existing-${idx}`} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                                <Image src={url} alt="Machine" fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-medium">Existing</span>
                                </div>
                            </div>
                        ))}

                        {/* New Previews */}
                        {previewUrls.map((url, idx) => (
                            <div key={`new-${idx}`} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                <Image src={url} alt="Preview" fill className="object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removePhoto(idx)}
                                    className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ))}

                        {/* Upload Button */}
                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group">
                            <div className="p-3 rounded-full bg-gray-100 group-hover:bg-indigo-100 transition-colors mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-700">Add Photo</span>
                            <input
                                type="file"
                                onChange={handlePhotoChange}
                                className="hidden"
                                accept="image/*"
                                multiple
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all focus:ring-4 focus:ring-gray-100"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 focus:ring-4 focus:ring-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </span>
                    ) : initialData ? "Update Machine" : "Create Machine"}
                </button>
            </div>
        </form>
    );
}
