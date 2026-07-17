"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { Camera, Trash2, Save, User, Check, RefreshCw, Search, Plus, ArrowLeft } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { API_BASE_URL } from "@/src/utils/config";

interface Employee {
    _id: string;
    name: string;
    employeeId: string;
    department: string;
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
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            if (capturedImages.length >= 5) {
                alert("Maximum 5 images allowed.");
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
        if (capturedImages.length < 3) return alert("Please capture at least 3 images for better accuracy.");

        setTraining(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("employeeId", selectedEmployee);

            // Convert base64 to blob
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

            alert("Face data saved and model trained successfully!");
            setCapturedImages([]);
            setSelectedEmployee("");
            setView("list"); // Return to list view
        } catch (error: any) {
            console.error("Training error:", error);
            alert(error.response?.data?.message || "Failed to train face data.");
        } finally {
            setTraining(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (view === "list") {
        return (
            <div className="space-y-4">
                <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-row gap-3 items-center justify-between md:gap-4 p-4 rounded-xl shadow-sm">
                    <div className="flex-1 md:flex-none md:w-64 relative">
                        <Search
                            className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border focus:border-transparent focus:ring-2 focus:ring-blue-500 pl-10 pr-4 py-2 rounded-lg text-sm w-full"
                        />
                    </div>
                    <button
                        onClick={() => handleStartCreate()}
                        className="bg-blue-600 flex flex-none gap-2 hover:bg-blue-700 items-center justify-center md:px-4 px-3 py-2 rounded-lg text-white transition-colors"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">Add Face Data</span>
                    </button>
                </div>

                <div className="bg-gray-50/50 min-h-[300px]">
                    {loading ? (
                        <div className="p-6 text-center">
                            <LoadingSpinner />
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="dark:text-gray-500 flex flex-col gap-3 items-center p-12 text-center text-gray-400">
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-sm">
                                <User size={32} className="opacity-40" />
                            </div>
                            <p className="font-medium">No employees found matching your search</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 hidden md:block overflow-hidden rounded-xl shadow-sm">
                                <table className="text-left w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
                                        <tr>
                                            <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Employee</th>
                                            <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">ID</th>
                                            <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Department</th>
                                            <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Status</th>
                                            <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-gray-100 divide-y">
                                        {filteredEmployees.map((emp) => (
                                            <tr key={emp._id} className="dark:hover:bg-slate-700 hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-3 items-center">
                                                        {emp.photo ? (
                                                            <img src={emp.photo} alt={emp.name} className="border border-gray-200 dark:border-slate-600 h-10 object-cover rounded-full w-10" />
                                                        ) : (
                                                            <div className="bg-blue-100 flex font-bold h-10 items-center justify-center rounded-full text-blue-600 w-10">
                                                                {emp.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="dark:text-white font-medium text-gray-900">{emp.name}</div>
                                                    </div>
                                                </td>
                                                <td className="dark:text-gray-300 px-6 py-4 text-gray-600">{emp.employeeId}</td>
                                                <td className="dark:text-gray-300 px-6 py-4 text-gray-600">
                                                    <span className="bg-blue-50 border border-blue-100 font-semibold px-2.5 py-1 rounded-md text-blue-700 text-xs">
                                                        {emp.department}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {emp.faceEncoding === "Active" ? (
                                                        <span className="bg-green-100 border border-green-200 font-medium gap-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-green-800 text-xs">
                                                            <Check size={12} /> Registered
                                                        </span>
                                                    ) : (
                                                        <span className="bg-gray-100 border border-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 font-medium gap-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-gray-800 text-xs">
                                                            Not Registered
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleStartCreate(emp._id)}
                                                        className="bg-blue-50 font-medium hover:bg-blue-100 hover:text-blue-800 px-3 py-1 rounded-lg text-blue-600 text-sm transition-colors"
                                                    >
                                                        {emp.faceEncoding === "Active" ? "Retrain" : "Register Face"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="flex flex-col gap-3 md:hidden">
                                {filteredEmployees.map((emp) => (
                                    <div key={emp._id} className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-4 p-4 rounded-xl shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-3 items-center">
                                                {emp.photo ? (
                                                    <img src={emp.photo} alt={emp.name} className="border border-gray-200 dark:border-slate-600 h-12 object-cover rounded-full w-12" />
                                                ) : (
                                                    <div className="bg-blue-100 flex font-bold h-12 items-center justify-center rounded-full text-blue-600 text-lg w-12">
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 className="dark:text-white font-bold leading-tight text-gray-900 text-lg">{emp.name}</h4>
                                                    <p className="dark:text-gray-400 font-mono mt-0.5 text-gray-500 text-xs">{emp.employeeId}</p>
                                                </div>
                                            </div>
                                            {emp.faceEncoding === "Active" ? (
                                                <div className="bg-green-100 p-1.5 rounded-full text-green-600">
                                                    <Check size={16} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="bg-gray-100 dark:bg-slate-700 dark:text-gray-500 p-1.5 rounded-full text-gray-400">
                                                    <User size={16} strokeWidth={2} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 items-center text-sm">
                                            <span className="bg-blue-50 border border-blue-100 font-semibold px-2.5 py-1 rounded text-blue-700 text-xs">
                                                {emp.department}
                                            </span>
                                            {emp.faceEncoding === "Active" ? (
                                                <span className="font-medium px-2 text-green-700 text-xs">
                                                    Face Data Active
                                                </span>
                                            ) : (
                                                <span className="dark:text-gray-400 font-medium px-2 text-gray-500 text-xs">
                                                    No Face Data
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleStartCreate(emp._id)}
                                            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm ${emp.faceEncoding === "Active"
                                                ? "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                                                }`}
                                        >
                                            {emp.faceEncoding === "Active" ? "Retrain Face Model" : "Register Face"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Create/Edit View
    return (
        <div className="flex flex-col gap-6">
            <div className="flex gap-4 items-center">
                <button
                    onClick={() => setView("list")}
                    className="dark:hover:bg-slate-700 dark:text-gray-300 hover:bg-gray-100 p-2 rounded-lg text-gray-600 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <h2 className="dark:text-white font-bold text-gray-900 text-xl">
                    {selectedEmployee ? "Register Face Data" : "New Face Registration"}
                </h2>
            </div>

            <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
                {/* Left: Controls & Camera */}
                <div className="space-y-6">
                    <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                        <label className="block dark:text-gray-200 font-medium mb-2 text-gray-700 text-sm">Select Employee</label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            disabled={!!selectedEmployee && view === "create" && selectedEmployee !== ""}
                            // Only disable if we passed an ID explicitly, otherwise allow changing if started from "Add"
                            className="bg-gray-50 border dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500 outline-none p-3 rounded-lg w-full"
                        >
                            <option value="">-- Choose Employee --</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.name} ({emp.employeeId})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 overflow-hidden p-4 relative rounded-xl shadow-sm">
                        <div className="aspect-video bg-black overflow-hidden relative rounded-lg">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="h-full object-cover w-full"
                                videoConstraints={{ facingMode: "user" }}
                            />
                        </div>
                        <button
                            onClick={capture}
                            disabled={!selectedEmployee || capturedImages.length >= 5}
                            className="bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 flex font-medium gap-2 hover:bg-blue-700 items-center justify-center mt-4 py-3 rounded-lg text-white transition-colors w-full"
                        >
                            <Camera size={20} />
                            Capture Photo ({capturedImages.length}/5)
                        </button>
                    </div>
                </div>

                {/* Right: Gallery & Actions */}
                <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col h-full p-6 rounded-xl shadow-sm">
                    <h3 className="dark:text-gray-100 font-semibold mb-4 text-gray-800 text-lg">Captured Photos</h3>

                    {capturedImages.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 dark:border-slate-600 dark:text-gray-500 flex flex-1 flex-col items-center justify-center p-8 rounded-xl text-gray-400">
                            <Camera size={48} className="mb-2 opacity-20" />
                            <p>Select employee and capture photos to start</p>
                        </div>
                    ) : (
                        <div className="gap-4 grid grid-cols-2 mb-6 sm:grid-cols-3">
                            {capturedImages.map((img, index) => (
                                <div key={index} className="aspect-square border border-gray-200 dark:border-slate-600 group overflow-hidden relative rounded-lg">
                                    <img src={img} alt={`Capture ${index}`} className="h-full object-cover w-full" />
                                    <button
                                        onClick={() => removeImage(index)}
                                        className="absolute bg-red-500 group-hover:opacity-100 hover:scale-110 opacity-0 p-1 right-1 rounded-full text-white top-1 transform transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="absolute bg-black/50 bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] text-white">
                                        #{index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-gray-100 border-t dark:border-slate-700 mt-auto pt-6">
                        <div className="bg-blue-50 mb-4 p-4 rounded-lg text-blue-700 text-sm">
                            <p className="font-semibold mb-1">Instructions:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Capture at least 3 photos of the employee.</li>
                                <li>Ensure good lighting and face visibility.</li>
                                <li>Ask employee to slightly turn head left/right for better model.</li>
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setView("list")}
                                className="dark:hover:bg-slate-700 dark:text-gray-200 flex-1 font-medium hover:bg-gray-100 py-4 rounded-xl text-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTrain}
                                disabled={capturedImages.length < 3 || training}
                                className="bg-green-600 disabled:opacity-50 flex flex-[2] font-bold gap-2 hover:bg-green-700 items-center justify-center py-4 rounded-xl shadow-green-200 shadow-lg text-lg text-white transition-all"
                            >
                                {training ? (
                                    <>
                                        <RefreshCw size={24} className="animate-spin" /> Processing...
                                    </>
                                ) : (
                                    <>
                                        <Save size={24} /> Save Face Data
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
