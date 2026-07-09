import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
    Settings2, 
    Hash, 
    Cpu, 
    Activity, 
    IndianRupee, 
    Gauge, 
    MapPin, 
    FileText, 
    Image as ImageIcon,
    UploadCloud,
    X,
    CheckCircle2
} from "lucide-react";

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

        Object.entries(formData).forEach(([key, value]) => {
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

    const InputWrapper = ({ icon: Icon, label, children }: any) => (
        <div className="relative group">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                <Icon size={14} className="text-indigo-500" />
                {label}
            </label>
            {children}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                
                {/* 1st Row / Section */}
                <InputWrapper icon={Settings2} label="Machine Name *">
                    <input
                        type="text"
                        name="machineName"
                        value={formData.machineName}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. CNC Mill B3"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm"
                    />
                </InputWrapper>

                <InputWrapper icon={Hash} label="Machine Code *">
                    <input
                        type="text"
                        name="machineCode"
                        value={formData.machineCode}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. MAC-001"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm font-mono"
                    />
                </InputWrapper>

                <InputWrapper icon={Cpu} label="Type *">
                    <input
                        type="text"
                        name="machineType"
                        value={formData.machineType}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. Lathe"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm"
                    />
                </InputWrapper>

                <InputWrapper icon={Activity} label="Status">
                    <div className="relative">
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white text-sm text-gray-900 shadow-sm appearance-none"
                        >
                            <option value="Available">Available</option>
                            <option value="Busy">Busy</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Breakdown">Breakdown</option>
                        </select>
                        <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                            formData.status === 'Available' ? 'bg-emerald-500' :
                            formData.status === 'Busy' ? 'bg-amber-500' :
                            formData.status === 'Maintenance' ? 'bg-gray-500' : 'bg-red-500'
                        }`} />
                    </div>
                </InputWrapper>

                {/* 2nd Row / Section */}
                <InputWrapper icon={IndianRupee} label="Hourly Rate (₹)">
                    <input
                        type="number"
                        name="hourlyRate"
                        value={formData.hourlyRate}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm font-medium"
                    />
                </InputWrapper>

                <InputWrapper icon={Gauge} label="Capacity (Units/Hr)">
                    <input
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="0"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm"
                    />
                </InputWrapper>

                <div className="lg:col-span-2">
                    <InputWrapper icon={MapPin} label="Location">
                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleInputChange}
                            placeholder="e.g. Shop Floor 1, Bay 3"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm"
                        />
                    </InputWrapper>
                </div>

                {/* 3rd Row / Specifications spans full width or 2 cols */}
                <div className="lg:col-span-4">
                    <InputWrapper icon={FileText} label="Specifications / Details">
                        <textarea
                            name="specifications"
                            value={formData.specifications}
                            onChange={handleInputChange}
                            rows={2}
                            placeholder="Enter technical specifications, dimensions, power requirements, etc..."
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-gray-400 text-sm text-gray-900 shadow-sm resize-none custom-scrollbar"
                        />
                    </InputWrapper>
                </div>

                {/* 4th Row / Media spans full width */}
                <div className="lg:col-span-4">
                    <InputWrapper icon={ImageIcon} label="Machine Photos">
                        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar items-center">
                            {/* Upload Button */}
                            <label className="flex-shrink-0 w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group bg-white">
                                <UploadCloud size={20} className="text-gray-400 group-hover:text-indigo-600 transition-colors mb-1" />
                                <span className="text-xs font-semibold text-gray-600 group-hover:text-indigo-700">Upload</span>
                                <input
                                    type="file"
                                    onChange={handlePhotoChange}
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                />
                            </label>

                            {/* Existing Photos */}
                            {existingPhotos.map((url, idx) => (
                                <div key={`existing-${idx}`} className="flex-shrink-0 relative w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-100 shadow-sm bg-white group">
                                    <Image src={url} alt="Machine" fill className="object-cover" />
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-center">
                                        <span className="text-white text-[9px] font-semibold">Existing</span>
                                    </div>
                                </div>
                            ))}

                            {/* New Previews */}
                            {previewUrls.map((url, idx) => (
                                <div key={`new-${idx}`} className="flex-shrink-0 relative w-24 h-24 rounded-xl overflow-hidden border-2 border-indigo-100 shadow-sm bg-white group ring-2 ring-indigo-500/20">
                                    <Image src={url} alt="Preview" fill className="object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(idx)}
                                        className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-lg hover:scale-110"
                                    >
                                        <X size={12} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </InputWrapper>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-5 mt-2 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all focus:ring-4 focus:ring-gray-100 active:scale-[0.98] text-sm"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 focus:ring-4 focus:ring-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] text-sm"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={18} />
                            {initialData ? "Update Machine" : "Create Machine"}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
