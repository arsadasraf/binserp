"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import {
    Camera, Trash2, Save, User, Check, RefreshCw, Search, Plus,
    ArrowLeft, SwitchCamera, CheckCircle2, ShieldCheck, Sparkles
} from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { API_BASE_URL } from "@/src/utils/config";

interface Employee {
    _id: string;
    name: string;
    employeeId: string;
    department?: { name: string } | string;
    designation?: { name: string } | string;
    photo?: string;
    faceEncoding?: string; // "Active" if data exists
}

export default function FaceDataMaster() {
    const [view, setView] = useState<"list" | "create">("list");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Create View State
    const [selectedEmployee, setSelectedEmployee] = useState<string>("");
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [training, setTraining] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const webcamRef = useRef<Webcam>(null);

    useEffect(() => {
        if (view === "list") {
            fetchEmployees();
        }
    }, [view]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/employee`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error("Error fetching employees:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartCreate = (employeeId?: string) => {
        setSelectedEmployee(employeeId || "");
        setCapturedImages([]);
        setView("create");
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot({ width: 640, height: 480 });
        if (imageSrc) {
            if (capturedImages.length >= 5) {
                alert("Maximum 5 photos allowed.");
                return;
            }
            setCapturedImages((prev) => [...prev, imageSrc]);
        }
    }, [webcamRef, capturedImages]);

    const removeImage = (index: number) => {
        setCapturedImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleTrain = async () => {
        if (!selectedEmployee) return alert("Please select an employee.");
        if (capturedImages.length < 3) return alert("Please capture at least 3 photos (Front, Left, and Right) for accurate biometric matching.");

        setTraining(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("employeeId", selectedEmployee);

            for (let i = 0; i < capturedImages.length; i++) {
                const fetchRes = await fetch(capturedImages[i]);
                const blob = await fetchRes.blob();
                formData.append("files", blob, `face_${i}.jpg`);
            }

            await axios.post(
                `${API_BASE_URL}/api/hr/face-data`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            alert("Face biometric model enrolled successfully!");
            setCapturedImages([]);
            setSelectedEmployee("");
            setView("list");
        } catch (error: any) {
            console.error("Training error:", error);
            alert(error.response?.data?.message || "Failed to train face biometric model.");
        } finally {
            setTraining(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── LIST VIEW ──────────────────────────────────────────────────────────
    if (view === "list") {
        return (
            <div className="space-y-4">
                {/* Search & Add Header */}
                <div className="bg-white border border-gray-100 dark:bg-slate-900 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 rounded-2xl shadow-sm">
                    <div className="flex-1 sm:max-w-xs relative">
                        <Search
                            className="-translate-y-1/2 absolute dark:text-gray-500 left-3.5 text-gray-400 top-1/2"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search employee or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 pl-10 pr-4 py-2.5 rounded-xl text-sm w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white outline-none"
                        />
                    </div>
                    <button
                        onClick={() => handleStartCreate()}
                        className="bg-blue-600 flex gap-2 hover:bg-blue-700 items-center justify-center px-5 py-2.5 rounded-xl text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Enroll Face Biometric</span>
                    </button>
                </div>

                {/* Employee Cards Grid */}
                <div className="min-h-[300px]">
                    {loading ? (
                        <div className="p-12 text-center">
                            <LoadingSpinner />
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-12 text-center rounded-2xl text-gray-400">
                            <User size={48} className="mx-auto mb-3 opacity-25" />
                            <p className="font-semibold text-base">No employee records found</p>
                            <p className="text-xs text-gray-500 mt-1">Try refining your search query</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredEmployees.map((emp) => (
                                <div
                                    key={emp._id}
                                    className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                                >
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-lg flex-shrink-0 overflow-hidden border border-blue-200/60 dark:border-blue-800">
                                            {emp.photo ? (
                                                <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                                            ) : (
                                                emp.name.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                                                {emp.name}
                                            </h3>
                                            <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                                                ID: {emp.employeeId}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                                                {typeof emp.department === "object" ? emp.department?.name : emp.department || "General"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status Badge & Button */}
                                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                        <div>
                                            {emp.faceEncoding === "Active" ? (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-semibold px-2.5 py-1 rounded-full text-xs border border-emerald-200/70 dark:border-emerald-800/50">
                                                    <CheckCircle2 size={12} /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 font-medium px-2.5 py-1 rounded-full text-xs">
                                                    Not Enrolled
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleStartCreate(emp._id)}
                                            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                                                emp.faceEncoding === "Active"
                                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                            }`}
                                        >
                                            {emp.faceEncoding === "Active" ? "Retrain" : "Enroll Face"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── CREATE / ENROLL VIEW ────────────────────────────────────────────────
    const selectedEmpData = employees.find(e => e._id === selectedEmployee);

    return (
        <div className="flex flex-col gap-5 max-w-6xl mx-auto">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView("list")}
                        className="dark:hover:bg-slate-800 dark:text-gray-300 hover:bg-gray-100 p-2 rounded-xl text-gray-600 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="dark:text-white font-extrabold text-gray-900 text-lg sm:text-xl">
                            {selectedEmpData ? `Enroll: ${selectedEmpData.name}` : "Face Biometric Enrollment"}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Capture 3 high-quality angles for zero-spoof biometric recognition
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT: Camera & Employee Selection (7 Columns) */}
                <div className="lg:col-span-7 space-y-4">
                    {/* Employee Picker */}
                    <div className="bg-white border border-gray-100 dark:bg-slate-900 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                        <label className="block dark:text-gray-200 font-semibold mb-2 text-gray-700 text-xs sm:text-sm">
                            Target Employee
                        </label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            disabled={!!selectedEmployee && view === "create" && selectedEmployee !== ""}
                            className="bg-gray-50 border border-gray-200 dark:border-slate-700 dark:bg-slate-800/80 focus:ring-2 focus:ring-blue-500 outline-none p-3 rounded-xl w-full text-sm font-medium text-gray-900 dark:text-white"
                        >
                            <option value="">-- Select Employee to Enroll --</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.name} ({emp.employeeId})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Camera Feed Card */}
                    <div className="bg-slate-950 border border-slate-800 overflow-hidden p-3.5 sm:p-4 relative rounded-2xl shadow-2xl space-y-3">
                        <div className="aspect-[4/3] bg-black overflow-hidden relative rounded-xl flex items-center justify-center">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="h-full object-cover w-full"
                                videoConstraints={{ facingMode: { ideal: facingMode }, width: 640, height: 480 }}
                                onUserMediaError={() => alert("Could not access camera. Please allow camera permissions.")}
                            />

                            {/* Camera Switcher Button */}
                            <button
                                onClick={() => setFacingMode(p => p === "user" ? "environment" : "user")}
                                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 p-2.5 rounded-full text-white transition-all active:scale-95"
                                title="Switch Camera"
                            >
                                <SwitchCamera size={18} />
                            </button>

                            {/* Guided Center Face Oval */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-48 h-60 sm:w-56 sm:h-72 border-2 border-dashed border-cyan-400/70 rounded-full" />
                            </div>
                        </div>

                        <button
                            onClick={capture}
                            disabled={!selectedEmployee || capturedImages.length >= 5}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 flex font-bold gap-2 items-center justify-center py-3.5 rounded-xl text-white shadow-lg shadow-blue-600/30 transition-all active:scale-95 w-full text-sm sm:text-base"
                        >
                            <Camera size={20} />
                            Capture Angle Photo ({capturedImages.length}/5)
                        </button>
                    </div>
                </div>

                {/* RIGHT: Guided Steps & Captured Gallery (5 Columns) */}
                <div className="lg:col-span-5 bg-white border border-gray-100 dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between p-5 rounded-2xl shadow-sm space-y-5">
                    <div>
                        {/* 3-Angle Step Progression Card */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700/80 p-4 rounded-2xl space-y-3 mb-5">
                            <h4 className="font-extrabold text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
                                Guided 3-Angle Enrollment
                            </h4>
                            
                            <div className="space-y-2 text-xs">
                                <div className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${
                                    capturedImages.length === 0 
                                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20" 
                                        : capturedImages.length > 0 
                                            ? "text-emerald-700 dark:text-emerald-400 font-semibold" 
                                            : "text-gray-500"
                                }`}>
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20 font-bold text-[11px]">
                                        {capturedImages.length > 0 ? "✓" : "1"}
                                    </span>
                                    <span>Angle 1: Look straight (Front Face)</span>
                                </div>

                                <div className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${
                                    capturedImages.length === 1 
                                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20" 
                                        : capturedImages.length > 1 
                                            ? "text-emerald-700 dark:text-emerald-400 font-semibold" 
                                            : "text-gray-500"
                                }`}>
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20 font-bold text-[11px]">
                                        {capturedImages.length > 1 ? "✓" : "2"}
                                    </span>
                                    <span>Angle 2: Turn slightly Left (~15°)</span>
                                </div>

                                <div className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${
                                    capturedImages.length === 2 
                                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20" 
                                        : capturedImages.length > 2 
                                            ? "text-emerald-700 dark:text-emerald-400 font-semibold" 
                                            : "text-gray-500"
                                }`}>
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20 font-bold text-[11px]">
                                        {capturedImages.length > 2 ? "✓" : "3"}
                                    </span>
                                    <span>Angle 3: Turn slightly Right (~15°)</span>
                                </div>
                            </div>
                        </div>

                        {/* Gallery of Captured Photos */}
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-3">
                            Captured Face Samples ({capturedImages.length}/5)
                        </h4>

                        {capturedImages.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-200 dark:border-slate-800 flex flex-col items-center justify-center p-8 rounded-2xl text-gray-400 text-center">
                                <Camera size={36} className="mb-2 opacity-25" />
                                <p className="text-xs font-medium">Capture at least 3 photos to enable saving</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2.5">
                                {capturedImages.map((img, index) => (
                                    <div key={index} className="aspect-square border-2 border-gray-200 dark:border-slate-700 group overflow-hidden relative rounded-xl bg-black">
                                        <img src={img} alt={`Sample ${index}`} className="h-full object-cover w-full" />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute bg-rose-600 hover:scale-110 p-1.5 right-1 top-1 rounded-full text-white shadow-md transition-all"
                                            title="Delete sample"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                        <div className="absolute bg-black/70 bottom-1 left-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white">
                                            {index === 0 ? "Front" : index === 1 ? "Left" : index === 2 ? "Right" : `#${index + 1}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                        <button
                            onClick={() => setView("list")}
                            className="flex-1 font-semibold text-xs sm:text-sm py-3.5 px-4 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleTrain}
                            disabled={capturedImages.length < 3 || training}
                            className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            {training ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" /> Training Model...
                                </>
                            ) : (
                                <>
                                    <Save size={18} /> Save & Enroll Face
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
