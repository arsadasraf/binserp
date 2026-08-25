"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { 
    Plus, Trash2, Edit2, Save, X, Search, 
    CheckCircle2, Sparkles, Layers, ShieldCheck, 
    Sliders, FileText, ArrowRight, RefreshCw 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const QC_TYPE_OPTIONS = [
    { value: "Incoming", label: "📥 Incoming QC (Raw Material / BO)", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300" },
    { value: "Process", label: "⚙️ Process QC (Shopfloor In-Process)", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300" },
    { value: "Final", label: "🏆 Final / FG QC (Finished Goods)", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300" },
    { value: "JobWork-RM-Conversion", label: "🏭 Job Work: RM Conversion (RM ➔ RM)", color: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300" },
    { value: "JobWork-Store-To-WIP", label: "🔄 Job Work: Store to WIP (RM ➔ MRP WIP)", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300" },
    { value: "JobWork-WIP-To-WIP", label: "📦 Job Work: WIP to WIP (Treatment / Coating)", color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300" },
    { value: "JobWork", label: "🛠️ General Job Work", color: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300" }
];

const PRESET_PARAMETERS: Record<string, { name: string; method: string; tolerance: string }[]> = {
    "Incoming": [
        { name: "Visual Surface & Packaging", method: "Visual Inspection", tolerance: "No transit damage / rust" },
        { name: "Material Grade & Mill TC", method: "Test Certificate Verification", tolerance: "As per PO Grade Spec" },
        { name: "Critical Dimensions (OD / ID / Thk)", method: "Vernier Caliper / Micrometer", tolerance: "±0.05 mm" },
        { name: "Hardness Verification", method: "Hardness Tester", tolerance: "±2 HRC" }
    ],
    "Process": [
        { name: "First Piece Machining Dimensions", method: "Height Gauge / Micrometer", tolerance: "±0.02 mm" },
        { name: "Surface Roughness (Ra)", method: "Roughness Tester", tolerance: "Ra ≤ 1.6 µm" },
        { name: "Burr & Edge Chamfer", method: "Visual & Tactile", tolerance: "Burr Free" }
    ],
    "Final": [
        { name: "Final Dimensional Inspection", method: "CMM / Digital Height Gauge", tolerance: "As per Product Drawing" },
        { name: "Assembly Functionality / Fitment", method: "Go / No-Go Gauge", tolerance: "100% Free Fitment" },
        { name: "Coating Finish & Color", method: "Color / Visual Comparison", tolerance: "Uniform Shade" },
        { name: "Marking, Label & Packaging", method: "Visual Checklist", tolerance: "Accurate Barcode & Box" }
    ],
    "JobWork-RM-Conversion": [
        { name: "Converted Material Grade & Chemistry", method: "Spectro / Lab Report Check", tolerance: "Conforms to RM Standard" },
        { name: "Visual Surface Finish & Defects", method: "Visual 10x Magnifier", tolerance: "Free of cracks, seams & pits" },
        { name: "Cross-Section / Thickness Dimension", method: "Digital Vernier / Micrometer", tolerance: "±0.05 mm" },
        { name: "Hardness / Heat Treat State", method: "Rockwell Hardness Tester", tolerance: "±2 HRC" }
    ],
    "JobWork-Store-To-WIP": [
        { name: "Machining Operation Dimensions", method: "Digital Micrometer / Bore Gauge", tolerance: "±0.03 mm" },
        { name: "Concentricity & Runout", method: "Dial Indicator (DTI)", tolerance: "≤ 0.02 mm" },
        { name: "Threading / Pitch Gauge", method: "Thread Plug / Ring Gauge", tolerance: "6H / 6g Conformance" }
    ],
    "JobWork-WIP-To-WIP": [
        { name: "Coating / Plating Thickness", method: "Magnetic / Eddy Current Gauge", tolerance: "10 to 15 µm" },
        { name: "Plating Adhesion & Peel Test", method: "Cross-Hatch / Tape Test", tolerance: "Class 4B/5B (No peeling)" },
        { name: "Surface Hardness After Treatment", method: "Micro-Vickers / Rockwell", tolerance: "58-62 HRC" },
        { name: "Visual Color & Uniformity", method: "Visual under Day-light", tolerance: "No patchiness or blistering" }
    ]
};

export default function QualityMaster() {
    const [standards, setStandards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [showModal, setShowModal] = useState(false);

    const [formData, setFormData] = useState({
        _id: "",
        name: "",
        type: "Incoming",
        description: "",
        parameters: [{ name: "", method: "", tolerance: "" }]
    });

    const fetchStandards = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/quality/master`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) setStandards(res.data.data || []);
        } catch (error) {
            console.error("Error fetching standards", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStandards();
    }, []);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert("Please enter Standard Name");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const payload = { ...formData };
            if (payload._id === "") delete (payload as any)._id;

            if (formData._id) {
                await axios.put(`${API_BASE_URL}/api/quality/master/${formData._id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_BASE_URL}/api/quality/master`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setShowModal(false);
            fetchStandards();
            setFormData({ _id: "", name: "", type: "Incoming", description: "", parameters: [{ name: "", method: "", tolerance: "" }] });
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to save quality standard");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this standard template?")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/api/quality/master/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStandards();
        } catch (error) {
            alert("Failed to delete standard");
        }
    };

    const addParameter = () => {
        setFormData({ ...formData, parameters: [...formData.parameters, { name: "", method: "", tolerance: "" }] });
    };

    const removeParameter = (index: number) => {
        if (formData.parameters.length <= 1) return;
        const newParams = formData.parameters.filter((_, i) => i !== index);
        setFormData({ ...formData, parameters: newParams });
    };

    const updateParameter = (index: number, field: string, value: string) => {
        const newParams = [...formData.parameters];
        (newParams[index] as any)[field] = value;
        setFormData({ ...formData, parameters: newParams });
    };

    const loadPresetParameters = (type: string) => {
        const presets = PRESET_PARAMETERS[type] || PRESET_PARAMETERS["Incoming"];
        setFormData(prev => ({
            ...prev,
            type,
            parameters: presets.map(p => ({ ...p }))
        }));
    };

    const filteredStandards = useMemo(() => {
        return standards.filter((std) => {
            const matchesSearch = !searchQuery || 
                std.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (std.description && std.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                std.type.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesType = activeFilter === "all" || std.type === activeFilter;

            return matchesSearch && matchesType;
        });
    }, [standards, searchQuery, activeFilter]);

    const getTypeBadge = (type: string) => {
        const opt = QC_TYPE_OPTIONS.find(o => o.value === type);
        return opt ? (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${opt.color}`}>
                {opt.label.split(" ")[0]} {type.replace("JobWork-", "JW: ")}
            </span>
        ) : (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {type}
            </span>
        );
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-emerald-600 w-6 h-6" />
                        Quality Master Inspection Templates
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Define inspection checklists and tolerances for Incoming, Final FG, and all Job Work Returnable DC buckets.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchStandards}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>

                    <button
                        onClick={() => {
                            setFormData({
                                _id: "",
                                name: "",
                                type: "JobWork-RM-Conversion",
                                description: "",
                                parameters: PRESET_PARAMETERS["JobWork-RM-Conversion"].map(p => ({ ...p }))
                            });
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Standard</span>
                    </button>
                </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Horizontal Category Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl overflow-x-auto no-scrollbar gap-1">
                    <button
                        onClick={() => setActiveFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === "all"
                                ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                    >
                        All ({standards.length})
                    </button>

                    <button
                        onClick={() => setActiveFilter("Incoming")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === "Incoming"
                                ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                    >
                        📥 Incoming QC
                    </button>

                    <button
                        onClick={() => setActiveFilter("Final")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === "Final"
                                ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                    >
                        🏆 Final / FG QC
                    </button>

                    <button
                        onClick={() => setActiveFilter("JobWork-RM-Conversion")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === "JobWork-RM-Conversion"
                                ? "bg-white dark:bg-slate-900 text-cyan-600 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                    >
                        🏭 JW: RM Conversion
                    </button>

                    <button
                        onClick={() => setActiveFilter("JobWork-Store-To-WIP")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === "JobWork-Store-To-WIP"
                                ? "bg-white dark:bg-slate-900 text-amber-600 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                    >
                        🔄 JW: Store to WIP
                    </button>

                    <button
                        onClick={() => setActiveFilter("JobWork-WIP-To-WIP")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === "JobWork-WIP-To-WIP"
                                ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                    >
                        📦 JW: WIP to WIP
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search standard template..."
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                </div>
            </div>

            {/* Standards Card Grid */}
            {filteredStandards.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                    <Sliders className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Quality Standards Found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Create standard checklists for your Incoming material, Final FG goods, or Job Work buckets to standardize QC inspections.
                    </p>
                    <button
                        onClick={() => {
                            setFormData({
                                _id: "",
                                name: "RM Conversion Standard",
                                type: "JobWork-RM-Conversion",
                                description: "Visual & metallurgical inspection checklist for raw material conversion",
                                parameters: PRESET_PARAMETERS["JobWork-RM-Conversion"].map(p => ({ ...p }))
                            });
                            setShowModal(true);
                        }}
                        className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                    >
                        + Create Sample Template
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStandards.map((std) => (
                        <div
                            key={std._id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                                            {std.name}
                                        </h4>
                                        <div className="mt-1">
                                            {getTypeBadge(std.type)}
                                        </div>
                                    </div>

                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                                setFormData(std);
                                                setShowModal(true);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            title="Edit Standard"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(std._id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                            title="Delete Standard"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 mb-3.5 line-clamp-2">
                                    {std.description || "Tailored inspection test checklist"}
                                </p>

                                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                                        <span>Inspection Parameters</span>
                                        <span>{std.parameters?.length || 0} tests</span>
                                    </div>

                                    {(std.parameters || []).slice(0, 3).map((p: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[65%]">
                                                {p.name}
                                            </span>
                                            <span className="text-[11px] font-mono font-bold text-slate-500 truncate max-w-[35%] text-right">
                                                {p.tolerance || p.method || "Standard"}
                                            </span>
                                        </div>
                                    ))}

                                    {(std.parameters?.length || 0) > 3 && (
                                        <p className="text-[10px] font-bold text-center text-slate-400 pt-1">
                                            +{std.parameters.length - 3} more parameters
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/80">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        {formData._id ? "Edit Quality Standard" : "New Quality Standard Template"}
                                    </h3>
                                    <p className="text-xs text-slate-500">Configure parameters, test methods, and tolerances.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Standard Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                            placeholder="e.g. Steel Rod Conversion Standard"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Quality / DC Bucket Type
                                        </label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => {
                                                const newType = e.target.value;
                                                setFormData(prev => ({ ...prev, type: newType }));
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        >
                                            {QC_TYPE_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Description / Purpose
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        placeholder="Optional description of tests and scope..."
                                    />
                                </div>

                                {/* Parameter List Toolbar */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                            Test Parameters & Tolerances
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => loadPresetParameters(formData.type)}
                                                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800"
                                            >
                                                <Sparkles size={12} />
                                                Load Preset Tests
                                            </button>

                                            <button
                                                type="button"
                                                onClick={addParameter}
                                                className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                                            >
                                                + Add Test
                                            </button>
                                        </div>
                                    </div>

                                    {/* Parameters Grid */}
                                    <div className="space-y-2">
                                        {formData.parameters.map((param, idx) => (
                                            <div key={idx} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </div>

                                                <input
                                                    placeholder="Test Name (e.g. Surface Finish)"
                                                    value={param.name}
                                                    onChange={(e) => updateParameter(idx, "name", e.target.value)}
                                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none"
                                                />
                                                <input
                                                    placeholder="Method / Instrument"
                                                    value={param.method}
                                                    onChange={(e) => updateParameter(idx, "method", e.target.value)}
                                                    className="w-36 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none"
                                                />
                                                <input
                                                    placeholder="Tolerance"
                                                    value={param.tolerance}
                                                    onChange={(e) => updateParameter(idx, "tolerance", e.target.value)}
                                                    className="w-28 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none"
                                                />
                                                <button 
                                                    onClick={() => removeParameter(idx)} 
                                                    disabled={formData.parameters.length <= 1}
                                                    className="text-red-400 hover:text-red-600 disabled:opacity-30 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/80">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Template
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
