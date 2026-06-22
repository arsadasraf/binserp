import { useState, useEffect } from "react";
import { User, Mail, Lock, Briefcase, MapPin, Globe, Shield, X, Save } from "lucide-react";

import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetCompanyProfileQuery } from "@/src/store/services/companyService";

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (formData: any) => Promise<void>;
    editingUser?: any;
    isLoading: boolean;
}

export default function UserFormModal({ isOpen, onClose, onSubmit, editingUser, isLoading }: UserFormModalProps) {
    const { data: companyProfile } = useGetCompanyProfileQuery();

    const [formData, setFormData] = useState({
        name: "",
        userId: "",
        email: "",
        password: "",
        department: "",
        allowedIP: "",
        allowedLat: "",
        allowedLng: "",
        allowedRadius: "500",
    });

    useEffect(() => {
        if (editingUser) {
            setFormData({
                name: editingUser.name,
                userId: editingUser.userId,
                email: editingUser.email,
                password: "",
                department: editingUser.department,
                allowedIP: editingUser.allowedIP || "",
                allowedLat: editingUser.allowedLocation?.lat?.toString() || "",
                allowedLng: editingUser.allowedLocation?.lng?.toString() || "",
                allowedRadius: editingUser.allowedLocation?.radius?.toString() || "500",
            });
        } else {
            setFormData({
                name: "", userId: "", email: "", password: "", department: "",
                allowedIP: "", allowedLat: "", allowedLng: "", allowedRadius: "500"
            });
        }
    }, [editingUser, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    const departments = [
        "CEO", "MD", "Admin", "Store", "PPC", "HR", "Accounts", 
        "Quality", "Maintenance", "CRM", "Security"
    ];

    const inputClass = "w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-gray-700 dark:text-gray-300 placeholder:text-gray-400";
    const labelClass = "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backend Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-900">
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            {editingUser ? "Edit User Profile" : "Create New User"}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage user access and security settings</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:bg-slate-700 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Form Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <form id="user-form" onSubmit={handleSubmit} className="space-y-8">

                        {/* Section 1: Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <h3 className="flex items-center text-sm font-semibold text-gray-900 dark:text-white mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3">
                                        <User size={18} />
                                    </div>
                                    User Information
                                </h3>
                            </div>

                            {/* Full Name */}
                            <div className="md:col-span-2">
                                <label className={labelClass}>Full Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="e.g. John Doe"
                                    />
                                    <div className="absolute left-3 top-3.5 text-gray-400">
                                        <User size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* User ID */}
                            <div>
                                <label className={labelClass}>User ID (Login ID)</label>
                                <div className="relative flex shadow-sm rounded-xl">
                                    <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 sm:text-sm font-semibold">
                                        {companyProfile?.companyId ? companyProfile.companyId : 'CompanyID'}
                                    </span>
                                    <input
                                        type="text"
                                        className={`${inputClass} rounded-l-none pl-4 ${editingUser ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed text-gray-500 dark:text-gray-400 ' : ''}`}
                                        value={formData.userId}
                                        onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                        required
                                        disabled={!!editingUser}
                                        placeholder="e.g. USER001"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className={labelClass}>Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        className={inputClass}
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        placeholder="user@example.com"
                                    />
                                    <div className="absolute left-3 top-3.5 text-gray-400">
                                        <Mail size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Department */}
                            <div>
                                <label className={labelClass}>Department / Role</label>
                                <div className="relative">
                                    <select
                                        className={`${inputClass} appearance-none cursor-pointer`}
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Role</option>
                                        {departments.map((dept) => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                    <div className="absolute left-3 top-3.5 text-gray-400 pointer-events-none">
                                        <Briefcase size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className={labelClass}>Password {editingUser && "(Optional)"}</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        className={inputClass}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                        placeholder={editingUser ? "Check to keep current" : "Set password"}
                                    />
                                    <div className="absolute left-3 top-3.5 text-gray-400">
                                        <Lock size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-100 dark:bg-slate-700 my-4" />

                        {/* Section 2: Security */}
                        <div className="bg-red-50/50 rounded-2xl p-6 border border-red-100">
                            <h3 className="flex items-center text-sm font-semibold text-red-700 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mr-3">
                                    <Shield size={18} />
                                </div>
                                Access Control & Security
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* IP Address */}
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Allowed IP Address</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className={`${inputClass} bg-white dark:bg-slate-800 border-red-100 focus:ring-red-500/20 focus:border-red-400 placeholder:text-red-300`}
                                            value={formData.allowedIP}
                                            onChange={(e) => setFormData({ ...formData, allowedIP: e.target.value })}
                                            placeholder="e.g. 192.168.1.10 (Leave empty for any)"
                                        />
                                        <div className="absolute left-3 top-3.5 text-red-300">
                                            <Globe size={18} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-red-500/70 mt-1.5 ml-1">
                                        *Restrict login to a specific network IP.
                                    </p>
                                </div>

                                {/* Location */}
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Geofencing (Location Lock)</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="relative col-span-1">
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Lat"
                                                className={`${inputClass} bg-white dark:bg-slate-800 px-2 text-center border-red-100 focus:border-red-400`}
                                                value={formData.allowedLat}
                                                onChange={(e) => setFormData({ ...formData, allowedLat: e.target.value })}
                                            />
                                        </div>
                                        <div className="relative col-span-1">
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Lng"
                                                className={`${inputClass} bg-white dark:bg-slate-800 px-2 text-center border-red-100 focus:border-red-400`}
                                                value={formData.allowedLng}
                                                onChange={(e) => setFormData({ ...formData, allowedLng: e.target.value })}
                                            />
                                        </div>
                                        <div className="relative col-span-1">
                                            <input
                                                type="number"
                                                placeholder="Rad (m)"
                                                className={`${inputClass} bg-white dark:bg-slate-800 px-2 text-center border-red-100 focus:border-red-400`}
                                                value={formData.allowedRadius}
                                                onChange={(e) => setFormData({ ...formData, allowedRadius: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 flex justify-between items-center">
                                        <p className="text-[10px] text-red-500/70 ml-1">
                                            *User can only login within this radius.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (navigator.geolocation) {
                                                    navigator.geolocation.getCurrentPosition(pos => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            allowedLat: pos.coords.latitude.toString(),
                                                            allowedLng: pos.coords.longitude.toString()
                                                        }));
                                                    });
                                                } else {
                                                    alert("Geolocation not supported");
                                                }
                                            }}
                                            className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <MapPin size={12} />
                                            Use My Current Location
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 /50 flex justify-end gap-3 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:bg-slate-700 transition-colors"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="user-form"
                        disabled={isLoading}
                        className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <LoadingSpinner size="sm" /> : <Save size={18} />}
                        {editingUser ? "Update User" : "Create User"}
                    </button>
                </div>
            </div>
        </div>
    );
}
