"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Search, Edit2, X, Camera, Upload, Coins, Briefcase, User, IndianRupee, Save, Phone, Mail, Check, Zap, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";
import { Employee, Department, Designation, Skill, EmployeeType } from "../../types/hr.types";
import { API_BASE_URL } from "@/src/utils/config";

// Reusable Switch Component
const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) => (
    <div className="cursor-pointer flex gap-3 items-center" onClick={() => onChange(!checked)}>
        <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${checked ? "bg-green-500" : "bg-gray-300"}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${checked ? "translate-x-6" : "translate-x-0"}`} />
        </div>
        {label && <span className="dark:text-gray-200 font-medium text-gray-700 text-sm">{label}</span>}
    </div>
);

export default function EmployeeMaster() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);
    const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
    const [employeePrefix, setEmployeePrefix] = useState<string>("Prefix");

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"personal" | "professional" | "salary">("personal");

    // Camera Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Skill Dropdown State
    const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
    const [skillSearch, setSkillSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsSkillDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    interface FormData {
        name: string;
        email: string;
        contact: string;
        department: string;
        employeeType: string;
        designation: string;
        joiningDate: string;
        status: string;
        skills: string[]; // Array of Skill IDs
        experience: string;
        degree: string;
        accountNumber: string;
        bankName: string;
        ifscCode: string;
        branchName: string;
        basic: number;
        hra: number;
        conveyance: number;
        medical: number;
        specialAllowance: number;
        pf: number;
        professionalTax: number;
        grossSalary: number;
        netSalary: number;
        casualLeave: number;
        sickLeave: number;
        perDayCalculationBasis: string;
        otRate: number;
        standardWorkingHours: number;
        weeklyOff: string;
        holidayWorkPolicy: string;
        weekOffWorkPolicy: string;
    }

    const [formData, setFormData] = useState<FormData>({
        name: "",
        email: "",
        contact: "",
        department: "",
        employeeType: "Full-Time",
        designation: "",
        joiningDate: new Date().toISOString().split("T")[0],
        status: "Active",
        skills: [],
        experience: "",
        degree: "",
        accountNumber: "",
        bankName: "",
        ifscCode: "",
        branchName: "",
        basic: 0,
        hra: 0,
        conveyance: 0,
        medical: 0,
        specialAllowance: 0,
        pf: 0,
        professionalTax: 0,
        grossSalary: 0,
        netSalary: 0,
        casualLeave: 0,
        sickLeave: 0,
        perDayCalculationBasis: "Basic",
        otRate: 0,
        standardWorkingHours: 9,
        weeklyOff: "Sunday",
        holidayWorkPolicy: "Overtime",
        weekOffWorkPolicy: "Overtime",
    });

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    useEffect(() => {
        fetchEmployees();
        fetchDepartments();
        fetchDesignations();
        fetchEmployeeTypes();
        fetchSkills();
        fetchPrefixSettings();
    }, []);

    const fetchPrefixSettings = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/hr-prefix`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data && res.data.settings && res.data.settings.employeePrefix) {
                setEmployeePrefix(res.data.settings.employeePrefix);
            }
        } catch (error) {
            console.error("Error fetching prefix settings:", error);
        }
    };

    useEffect(() => {
        const gross =
            Number(formData.basic || 0) +
            Number(formData.hra || 0) +
            Number(formData.conveyance || 0) +
            Number(formData.medical || 0) +
            Number(formData.specialAllowance || 0);

        const net = gross - Number(formData.pf || 0) - Number(formData.professionalTax || 0);

        if (gross !== formData.grossSalary || net !== formData.netSalary) {
            setFormData(prev => ({ ...prev, grossSalary: gross, netSalary: net }));
        }
    }, [formData.basic, formData.hra, formData.conveyance, formData.medical, formData.specialAllowance, formData.pf, formData.professionalTax]);

    useEffect(() => {
        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [stream]);

    const fetchEmployees = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/employee?_t=${new Date().getTime()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setEmployees(response.data.employees);
        } catch (error) { console.error("Error fetching employees:", error); } finally { setLoading(false); }
    };

    const fetchDepartments = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/department`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDepartments(response.data);
        } catch (error) { console.error(error); }
    };

    const fetchDesignations = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/designation`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDesignations(response.data);
        } catch (error) { console.error(error); }
    };

    const fetchEmployeeTypes = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/employee-type`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setEmployeeTypes(response.data);
        } catch (error) { console.error(error); }
    };

    const fetchSkills = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/skill`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAvailableSkills(response.data);
        } catch (error) { console.error(error); }
    };

    const handleOpenAdd = () => {
        setFormData({
            name: "", email: "", contact: "", department: "", employeeType: "Full-Time", designation: "",
            joiningDate: new Date().toISOString().split("T")[0], status: "Active", skills: [],
            experience: "", degree: "",
            accountNumber: "", bankName: "", ifscCode: "", branchName: "",
            basic: 0, hra: 0, conveyance: 0, medical: 0, specialAllowance: 0,
            pf: 0, professionalTax: 0, grossSalary: 0, netSalary: 0,
            casualLeave: 0, sickLeave: 0, perDayCalculationBasis: "Basic", otRate: 0,
            standardWorkingHours: 9, weeklyOff: "Sunday", holidayWorkPolicy: "Overtime", weekOffWorkPolicy: "Overtime"
        });
        setPhotoFile(null);
        setPhotoPreview(null);
        setCapturedImage(null);
        setIsEditing(false);
        setCurrentId(null);
        setActiveTab("personal");
        setShowModal(true);
    };

    const handleOpenEdit = (emp: Employee) => {
        // Map existing skills (which are objects) to IDs
        const skillIds = emp.skills ? emp.skills.map((s: any) => s._id || s) : [];

        setFormData({
            name: emp.name,
            email: emp.email,
            contact: emp.contact,
            department: emp.department,
            employeeType: emp.employeeType || "Full-Time",
            designation: emp.designation,
            joiningDate: new Date(emp.joiningDate).toISOString().split("T")[0],
            status: emp.status,
            skills: skillIds,
            experience: emp.experience || "",
            degree: emp.degree || "",
            accountNumber: emp.paymentDetails?.accountNumber || "",
            bankName: emp.paymentDetails?.bankName || "",
            ifscCode: emp.paymentDetails?.ifscCode || "",
            branchName: emp.paymentDetails?.branchName || "",
            // Fix: Ensure we use the value if present, else 0
            basic: emp.salary?.basic ?? 0,
            hra: emp.salary?.hra ?? 0,
            conveyance: emp.salary?.conveyance ?? 0,
            medical: emp.salary?.medical ?? 0,
            specialAllowance: emp.salary?.specialAllowance ?? 0,
            pf: emp.salary?.pf ?? 0,
            professionalTax: emp.salary?.professionalTax ?? 0,
            grossSalary: emp.salary?.grossSalary ?? 0,
            netSalary: emp.salary?.netSalary ?? 0,
            perDayCalculationBasis: emp.salary?.perDayCalculationBasis || "Basic",
            otRate: emp.salary?.otRate ?? 0,
            casualLeave: (emp as any).leaves?.casualLeave ?? 0,
            sickLeave: (emp as any).leaves?.sickLeave ?? 0,
            standardWorkingHours: emp.standardWorkingHours ?? 9,
            weeklyOff: emp.weeklyOff || "Sunday",
            holidayWorkPolicy: emp.holidayWorkPolicy || "Overtime",
            weekOffWorkPolicy: emp.weekOffWorkPolicy || "Overtime",
        });
        setPhotoPreview(emp.photo || null);
        setPhotoFile(null);
        setCapturedImage(null);
        setIsEditing(true);
        setCurrentId(emp._id);
        setActiveTab("personal");
        setShowModal(true);
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
            setStream(mediaStream);
            setIsCameraActive(true);
            setTimeout(() => {
                if (videoRef.current) videoRef.current.srcObject = mediaStream;
            }, 100);
        } catch (err) {
            alert("Could not access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg");

                setCapturedImage(dataUrl);
                setPhotoPreview(dataUrl);

                fetch(dataUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
                        setPhotoFile(file);
                    });

                stopCamera();
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" };
            const url = `${API_BASE_URL}/api/hr/employee`;

            const data = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (!['skills', 'accountNumber', 'bankName', 'ifscCode', 'branchName',
                    'basic', 'hra', 'conveyance', 'medical', 'specialAllowance', 'grossSalary', 'pf', 'professionalTax', 'netSalary',
                    'casualLeave', 'sickLeave', 'perDayCalculationBasis', 'otRate',
                    'standardWorkingHours', 'weeklyOff', 'holidayWorkPolicy', 'weekOffWorkPolicy'].includes(key)) {
                    data.append(key, value as string);
                }
            });

            // Serialize complex data
            data.append("skills", JSON.stringify(formData.skills));
            data.append("paymentDetails", JSON.stringify({
                accountNumber: formData.accountNumber,
                bankName: formData.bankName,
                ifscCode: formData.ifscCode,
                branchName: formData.branchName
            }));
            data.append("salary", JSON.stringify({
                basic: formData.basic,
                hra: formData.hra,
                conveyance: formData.conveyance,
                medical: formData.medical,
                specialAllowance: formData.specialAllowance,
                grossSalary: formData.grossSalary,
                pf: formData.pf,
                professionalTax: formData.professionalTax,
                netSalary: formData.netSalary,
                perDayCalculationBasis: formData.perDayCalculationBasis,
                otRate: formData.otRate
            }));
            data.append("leaves", JSON.stringify({
                casualLeave: formData.casualLeave,
                sickLeave: formData.sickLeave
            }));
            
            data.append("standardWorkingHours", String(formData.standardWorkingHours));
            data.append("weeklyOff", formData.weeklyOff);
            data.append("holidayWorkPolicy", formData.holidayWorkPolicy);
            data.append("weekOffWorkPolicy", formData.weekOffWorkPolicy);

            if (photoFile) data.append("photo", photoFile);

            if (isEditing && currentId) await axios.put(`${url}/${currentId}`, data, { headers });
            else await axios.post(url, data, { headers });

            setShowModal(false);
            fetchEmployees();
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to save employee.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this employee? Only employees created within the last 24 hours can be deleted.")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/api/hr/employee/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchEmployees();
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to delete employee.");
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            const token = localStorage.getItem("token");
            await axios.put(`${API_BASE_URL}/api/hr/employee/${id}/toggle-status`, {}, { headers: { Authorization: `Bearer ${token}` } });
            fetchEmployees();
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to toggle status.");
        }
    };

    const toggleSkill = (skillId: string) => {
        setFormData(prev => {
            const exists = prev.skills.includes(skillId);
            if (exists) return { ...prev, skills: prev.skills.filter(id => id !== skillId) };
            return { ...prev, skills: [...prev.skills, skillId] };
        });
    };

    // Filter skills for dropdown
    const filteredSkills = availableSkills.filter(skill =>
        skill.name.toLowerCase().includes(skillSearch.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-row gap-3 items-center justify-between md:gap-4 md:p-5 p-4 rounded-2xl shadow-sm">
                <div className="flex flex-1 md:flex-none gap-3 items-center">
                    <div className="relative w-full md:w-72">
                        <Search className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2" size={18} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all w-full"
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="bg-gray-50 border border-gray-200 dark:border-slate-700 dark:bg-slate-800/50 focus:border-blue-500 outline-none px-3 py-2.5 rounded-xl text-sm transition-all w-32 md:w-40 dark:text-gray-200"
                    >
                        <option value="">All Types</option>
                        {employeeTypes.map(t => (
                            <option key={t._id} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-blue-600 flex flex-none font-medium gap-2 hover:bg-blue-700 hover:shadow-blue-200 hover:shadow-lg items-center justify-center md:px-5 px-3 py-2.5 rounded-xl text-white transition-all"
                >
                    <Plus size={20} /> <span className="hidden md:inline">Add Employee</span>
                </button>
            </div>

            {/* Employee List - Responsive */}
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 overflow-hidden rounded-2xl shadow-sm">

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="text-left w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Employee</th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Role</th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Type</th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Skills</th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Status</th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-gray-100 divide-y">
                            {loading ? (
                                <tr><td colSpan={6} className="dark:text-gray-400 px-6 py-10 text-center text-gray-500">Loading...</td></tr>
                            ) : employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) && (typeFilter === "" || e.employeeType === typeFilter)).length === 0 ? (
                                <tr><td colSpan={6} className="dark:text-gray-400 px-6 py-10 text-center text-gray-500">No employees found.</td></tr>
                            ) : (
                                employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) && (typeFilter === "" || e.employeeType === typeFilter)).map((emp) => (
                                    <tr key={emp._id} onClick={() => handleOpenEdit(emp)} className="dark:hover:bg-slate-700 group hover:bg-gray-50 transition-colors cursor-pointer">
                                        <td className="px-6 py-4">
                                            <div className="flex gap-4 items-center">
                                                <div className="bg-gray-100 dark:bg-slate-700 flex h-12 items-center justify-center overflow-hidden rounded-full shadow-inner w-12">
                                                    {emp.photo ? (
                                                        <img src={emp.photo} alt={emp.name} className="h-full object-cover w-full" />
                                                    ) : (
                                                        <span className="dark:text-gray-500 font-bold text-gray-400 text-lg">{emp.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="dark:text-white font-semibold text-gray-900">{emp.name}</div>
                                                    <div className="bg-gray-100 dark:bg-slate-700 dark:text-gray-400 font-mono inline-block mt-1 px-1.5 py-0.5 rounded text-gray-500 text-xs">{emp.employeeId}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="dark:text-gray-100 font-medium text-gray-800">{emp.designation}</div>
                                            <div className="dark:text-gray-400 text-gray-500 text-sm">{emp.department}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-md text-xs font-medium dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/30">
                                                {emp.employeeType || "Full-Time"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {emp.skills && emp.skills.length > 0 ? (
                                                    emp.skills.map((skill: any, idx) => (
                                                        <span key={idx} className="bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] text-blue-600">
                                                            {skill.name}
                                                        </span>
                                                    ))
                                                ) : <span className="dark:text-gray-500 text-gray-400 text-xs">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${emp.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${emp.status === "Active" ? "bg-green-500" : "bg-red-500"}`}></span>
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex gap-2 group-hover:opacity-100 justify-end opacity-0 transition-opacity">
                                                <button onClick={() => handleOpenEdit(emp)} title="Edit Employee" className="bg-blue-50 hover:bg-blue-100 p-2 rounded-lg text-blue-600 transition-colors"><Edit2 size={16} /></button>
                                                {emp.createdAt && (Date.now() - new Date(emp.createdAt).getTime() > 24 * 60 * 60 * 1000) ? (
                                                    <button onClick={() => handleToggleStatus(emp._id)} title={emp.isActive ? "Deactivate" : "Activate"} className="bg-orange-50 hover:bg-orange-100 p-2 rounded-lg text-orange-600 transition-colors"><Zap size={16} /></button>
                                                ) : (
                                                    <button onClick={() => handleDelete(emp._id)} title="Delete (Within 24h)" className="bg-red-50 hover:bg-red-100 p-2 rounded-lg text-red-600 transition-colors"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="divide-gray-100 divide-y md:hidden">
                    {loading ? (
                        <div className="dark:text-gray-400 p-6 text-center text-gray-500">Loading...</div>
                    ) : employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) && (typeFilter === "" || e.employeeType === typeFilter)).map((emp) => (
                        <div key={emp._id} onClick={() => handleOpenEdit(emp)} className="flex flex-col gap-4 p-4 dark:hover:bg-slate-700/50 hover:bg-gray-50 cursor-pointer transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-3 items-center">
                                    <div className="bg-gray-100 dark:bg-slate-700 flex h-12 items-center justify-center overflow-hidden rounded-full shadow-inner w-12">
                                        {emp.photo ? (
                                            <img src={emp.photo} alt={emp.name} className="h-full object-cover w-full" />
                                        ) : (
                                            <span className="dark:text-gray-500 font-bold text-gray-400 text-lg">{emp.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="dark:text-white font-semibold text-gray-900">{emp.name}</div>
                                        <div className="bg-gray-100 dark:bg-slate-700 dark:text-gray-400 font-mono inline-block mt-1 px-1.5 py-0.5 rounded text-gray-500 text-xs">{emp.employeeId}</div>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${emp.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    }`}>
                                    {emp.status}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2 flex-wrap">
                                    <div className="dark:text-gray-300 flex gap-1.5 items-center text-gray-600 text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded"><Briefcase size={14} className="dark:text-gray-500 text-gray-400" /> {emp.designation}</div>
                                    <div className="dark:text-gray-300 flex gap-1.5 items-center text-gray-600 text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded"><User size={14} className="dark:text-gray-500 text-gray-400" /> {emp.department}</div>
                                    <div className="dark:text-indigo-400 text-indigo-700 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800/30">
                                        {emp.employeeType || "Full-Time"}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {emp.skills && emp.skills.length > 0 && emp.skills.map((skill: any, idx) => (
                                        <span key={idx} className="bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] text-blue-600">{skill.name}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleOpenEdit(emp)} className="bg-blue-50 flex flex-1 font-medium gap-2 hover:bg-blue-100 items-center justify-center py-2 rounded-lg text-blue-600 text-sm transition-colors"><Edit2 size={14} /> Edit</button>
                                {emp.createdAt && (Date.now() - new Date(emp.createdAt).getTime() > 24 * 60 * 60 * 1000) ? (
                                    <button onClick={() => handleToggleStatus(emp._id)} className="bg-orange-50 flex flex-1 font-medium gap-2 hover:bg-orange-100 items-center justify-center py-2 rounded-lg text-orange-600 text-sm transition-colors"><Zap size={14} /> {emp.isActive ? "Deactivate" : "Activate"}</button>
                                ) : (
                                    <button onClick={() => handleDelete(emp._id)} className="bg-red-50 flex flex-1 font-medium gap-2 hover:bg-red-100 items-center justify-center py-2 rounded-lg text-red-600 text-sm transition-colors"><Trash2 size={14} /> Delete</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Modern Modal */}
            {showModal && (
                <div className="animate-in backdrop-blur-sm bg-black/60 duration-200 fade-in fixed flex inset-0 items-center justify-center p-4 z-[999]">
                    <div className="bg-white dark:bg-slate-800 flex flex-col max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl shadow-2xl w-full">
                        {/* Modal Header */}
                        <div className="bg-white border-b border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-between px-6 py-4 sticky top-0 z-10">
                            <div>
                                <h3 className="dark:text-white font-bold text-gray-900 text-xl">{isEditing ? "Edit Employee" : "Add New Employee"}</h3>
                                <p className="dark:text-gray-400 text-gray-500 text-sm">Manage employee details, roles, and compensation.</p>
                            </div>
                            <button onClick={() => { setShowModal(false); stopCamera(); }} className="dark:hover:bg-slate-700 dark:text-gray-500 hover:bg-gray-100 hover:text-gray-600 p-2 rounded-full text-gray-400 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="bg-gray-50/50 flex-1 overflow-y-auto">
                            <div className="p-6">
                                <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex gap-2 max-w-full mb-6 overflow-x-auto p-1 rounded-xl shadow-sm w-fit">
                                    {[
                                        { id: "personal", icon: User, label: "Personal" },
                                        { id: "professional", icon: Briefcase, label: "Professional" },
                                        { id: "salary", icon: IndianRupee, label: "Salary & Payment" },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                                }`}
                                        >
                                            <tab.icon size={16} /> {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Personal Tab */}
                                    {activeTab === "personal" && (
                                        <div className="animate-in duration-300 gap-6 grid grid-cols-1 lg:grid-cols-3 slide-in-from-right-4">
                                            {/* Photo Section */}
                                            <div className="lg:col-span-1">
                                                <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col items-center p-6 rounded-xl shadow-sm">
                                                    <h4 className="dark:text-white font-semibold mb-4 text-gray-900 text-sm w-full">Employee Photo</h4>

                                                    <div className="group mb-6 relative">
                                                        {isCameraActive ? (
                                                            <div className="bg-black h-48 overflow-hidden relative rounded-full shadow-lg w-48">
                                                                <video ref={videoRef} autoPlay playsInline className="h-full object-cover scale-x-[-1] transform w-full" />
                                                                <canvas ref={canvasRef} className="hidden" />
                                                            </div>
                                                        ) : (
                                                            <div className="bg-gray-100 border-4 border-white dark:bg-slate-700 flex h-48 items-center justify-center overflow-hidden rounded-full shadow-lg w-48">
                                                                {photoPreview ? (
                                                                    <img src={photoPreview} alt="Preview" className="h-full object-cover w-full" />
                                                                ) : (
                                                                    <User size={64} className="dark:text-gray-600 text-gray-300" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="gap-3 grid grid-cols-2 w-full">
                                                        {isCameraActive ? (
                                                            <>
                                                                <button type="button" onClick={capturePhoto} className="bg-blue-600 col-span-2 flex font-medium gap-2 hover:bg-blue-700 items-center justify-center py-2 rounded-lg text-white transition-colors">
                                                                    <Camera size={18} /> Capture
                                                                </button>
                                                                <button type="button" onClick={stopCamera} className="col-span-2 hover:underline text-center text-red-500 text-sm">Cancel Camera</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <label className="bg-blue-50 border border-blue-100 cursor-pointer flex flex-col hover:bg-blue-100 items-center justify-center p-3 rounded-xl text-blue-600 transition-colors">
                                                                    <Upload size={20} className="mb-1" />
                                                                    <span className="font-medium text-xs">Upload File</span>
                                                                    <input type="file" accept="image/*" className="hidden dark:bg-slate-900 dark:border-slate-700 dark:text-white" onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            setPhotoFile(file);
                                                                            setPhotoPreview(URL.createObjectURL(file));
                                                                        }
                                                                    }} />
                                                                </label>
                                                                <button type="button" onClick={startCamera} className="bg-purple-50 border border-purple-100 flex flex-col hover:bg-purple-100 items-center justify-center p-3 rounded-xl text-purple-600 transition-colors">
                                                                    <Camera size={20} className="mb-1" />
                                                                    <span className="font-medium text-xs">Use Camera</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Info Section */}
                                            <div className="lg:col-span-2 space-y-4">
                                                <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm space-y-4">
                                                    <div className="gap-4 grid grid-cols-2">
                                                        <div className="col-span-2">
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Full Name</label>
                                                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="e.g. Rahul Sharma" />
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Email Address</label>
                                                            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="rahul@example.com" />
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Contact Number</label>
                                                            <input required type="text" value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="+91 9876543210" />
                                                        </div>
                                                    </div>

                                                    <div className="border-gray-100 border-t dark:border-slate-700 gap-4 grid grid-cols-2 pt-4">
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Status</label>
                                                            <div className="mt-2">
                                                                <Switch
                                                                    checked={formData.status === "Active"}
                                                                    onChange={(c) => setFormData({ ...formData, status: c ? "Active" : "Inactive" })}
                                                                    label={formData.status}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Employee ID</label>
                                                            <div className="bg-gray-100 dark:bg-slate-700 dark:text-gray-400 font-mono px-4 py-2.5 rounded-lg text-gray-500 text-sm">
                                                                {isEditing ? formData.name ? employees.find(e => e._id === currentId)?.employeeId : '' : `Auto-generated (${employeePrefix}-XXXX)`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Professional Tab */}
                                    {activeTab === "professional" && (
                                        <div className="animate-in duration-300 gap-6 grid grid-cols-1 md:grid-cols-2 slide-in-from-right-4">
                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 md:col-span-2 p-6 rounded-xl shadow-sm space-y-4">
                                                <h4 className="border-b dark:text-white font-semibold mb-2 pb-2 text-gray-900 text-sm">Role & Department</h4>
                                                <div className="gap-4 grid grid-cols-2">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Department</label>
                                                        <select required value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="">Select Department</option>
                                                            {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Designation</label>
                                                        <select required value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="">Select Designation</option>
                                                            {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Employee Type</label>
                                                        <select value={formData.employeeType} onChange={e => setFormData({ ...formData, employeeType: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="Full-Time">Full-Time (Default)</option>
                                                            {employeeTypes.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Date of Joining</label>
                                                        <input required type="date" value={formData.joiningDate} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 md:col-span-2 p-6 rounded-xl shadow-sm space-y-4">
                                                <h4 className="border-b dark:text-white font-semibold mb-2 pb-2 text-gray-900 text-sm">Qualifications & Skills</h4>
                                                <div className="gap-4 grid grid-cols-2">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Degree / Qualification</label>
                                                        <input type="text" value={formData.degree} onChange={e => setFormData({ ...formData, degree: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="e.g. B.Tech Computer Science" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Experience</label>
                                                        <input type="text" value={formData.experience} onChange={e => setFormData({ ...formData, experience: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="e.g. 3 Years" />
                                                    </div>

                                                    {/* Multi-Select Dropdown with Icon */}
                                                    <div className="col-span-2" ref={dropdownRef}>
                                                        <label className="dark:text-gray-400 flex font-semibold gap-1 items-center mb-1.5 text-gray-500 text-xs tracking-wider uppercase">
                                                            <Zap size={14} className="text-orange-500" />
                                                            Skills (Multi-Select)
                                                        </label>
                                                        <div className="relative">
                                                            <div
                                                                className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 flex flex-wrap focus-within:bg-white focus-within:border-blue-500 gap-2 items-center min-h-[42px] outline-none px-3 py-2 rounded-lg transition-all w-full"
                                                                onClick={() => { setIsSkillDropdownOpen(true); }}
                                                            >
                                                                {formData.skills.map(skillId => {
                                                                    const skill = availableSkills.find(s => s._id === skillId);
                                                                    return skill ? (
                                                                        <span key={skillId} className="bg-blue-100 flex font-medium gap-1 items-center px-2 py-0.5 rounded text-blue-700 text-xs">
                                                                            {skill.name}
                                                                            <X size={12} className="cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); toggleSkill(skillId); }} />
                                                                        </span>
                                                                    ) : null;
                                                                })}
                                                                <input
                                                                    type="text"
                                                                    className="bg-transparent flex-1 min-w-[60px] outline-none text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                                                    placeholder={formData.skills.length === 0 ? "Select skills..." : ""}
                                                                    value={skillSearch}
                                                                    onChange={(e) => setSkillSearch(e.target.value)}
                                                                    onFocus={() => setIsSkillDropdownOpen(true)}
                                                                />
                                                                <div className="ml-auto pointer-events-none">
                                                                    {isSkillDropdownOpen ? <ChevronUp size={16} className="dark:text-gray-500 text-gray-400" /> : <ChevronDown size={16} className="dark:text-gray-500 text-gray-400" />}
                                                                </div>
                                                            </div>

                                                            {/* Dropdown Menu */}
                                                            {isSkillDropdownOpen && (
                                                                <div className="absolute animate-in bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 duration-100 fade-in left-0 max-h-60 overflow-y-auto rounded-lg shadow-xl top-[102%] w-full z-20 zoom-in-95">
                                                                    {filteredSkills.length === 0 ? (
                                                                        <div className="dark:text-gray-400 p-3 text-center text-gray-500 text-sm">No skills found. Add from master.</div>
                                                                    ) : (
                                                                        filteredSkills.map(skill => {
                                                                            const isSelected = formData.skills.includes(skill._id);
                                                                            return (
                                                                                <div
                                                                                    key={skill._id}
                                                                                    onClick={() => { toggleSkill(skill._id); setSkillSearch(""); }}
                                                                                    className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between group ${isSelected ? "bg-blue-50/50" : ""}`}
                                                                                >
                                                                                    <div className="flex gap-2 items-center">
                                                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white group-hover:border-blue-400"}`}>
                                                                                            {isSelected && <Check size={10} className="text-white" />}
                                                                                        </div>
                                                                                        <span className={isSelected ? "font-medium text-gray-900" : "text-gray-700"}>{skill.name}</span>
                                                                                    </div>
                                                                                    {skill.description && <span className="dark:text-gray-500 group-hover:inline hidden max-w-[150px] text-gray-400 text-xs truncate">{skill.description}</span>}
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Salary & Payment Tab */}
                                    {activeTab === "salary" && (
                                        <div className="animate-in duration-300 slide-in-from-right-4 space-y-6">
                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                                                <h4 className="border-b dark:text-white flex font-semibold gap-2 items-center mb-4 pb-2 text-gray-900 text-sm"><Briefcase size={16} /> Salary Structure</h4>

                                                {/* Salary Config */}
                                                <div className="gap-4 grid grid-cols-2 lg:grid-cols-3 mb-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100 dark:bg-slate-800 dark:border-slate-700">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Per Day Salary Basis</label>
                                                        <select value={formData.perDayCalculationBasis} onChange={e => setFormData({ ...formData, perDayCalculationBasis: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="Basic">Basic</option>
                                                            <option value="Gross">Gross</option>
                                                            <option value="Net">Net</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">OT Rate (Per Hour)</label>
                                                        <input type="number" value={formData.otRate} onChange={e => setFormData({ ...formData, otRate: Number(e.target.value) })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                </div>

                                                {/* Working Policies Config */}
                                                <div className="gap-4 grid grid-cols-2 lg:grid-cols-4 mb-6 bg-purple-50/50 p-4 rounded-lg border border-purple-100 dark:bg-slate-800 dark:border-slate-700">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Standard Hrs/Day</label>
                                                        <input type="number" value={formData.standardWorkingHours} onChange={e => setFormData({ ...formData, standardWorkingHours: Number(e.target.value) })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Weekly Off Day</label>
                                                        <select value={formData.weeklyOff} onChange={e => setFormData({ ...formData, weeklyOff: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => <option key={d} value={d}>{d}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Holiday Work Policy</label>
                                                        <select value={formData.holidayWorkPolicy} onChange={e => setFormData({ ...formData, holidayWorkPolicy: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="Overtime">Overtime</option>
                                                            <option value="CompOff">Comp Off</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Week Off Policy</label>
                                                        <select value={formData.weekOffWorkPolicy} onChange={e => setFormData({ ...formData, weekOffWorkPolicy: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="Overtime">Overtime</option>
                                                            <option value="CompOff">Comp Off</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Earnings Ref */}
                                                <div className="gap-4 grid grid-cols-2 lg:grid-cols-3 mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Basic</label>
                                                        <input type="number" value={formData.basic} onChange={e => setFormData({ ...formData, basic: Number(e.target.value) })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">HRA</label>
                                                        <input type="number" value={formData.hra} onChange={e => setFormData({ ...formData, hra: Number(e.target.value) })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Conveyance</label>
                                                        <input type="number" value={formData.conveyance} onChange={e => setFormData({ ...formData, conveyance: Number(e.target.value) })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Medical</label>
                                                        <input type="number" value={formData.medical} onChange={e => setFormData({ ...formData, medical: Number(e.target.value) })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Special Allowance</label>
                                                        <input type="number" value={formData.specialAllowance} onChange={e => setFormData({ ...formData, specialAllowance: Number(e.target.value) })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                </div>

                                                {/* Deductions */}
                                                <h5 className="font-bold mb-3 text-red-500 text-xs tracking-wider uppercase">Deductions</h5>
                                                <div className="gap-4 grid grid-cols-2 lg:grid-cols-3 mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">PF</label>
                                                        <input type="number" value={formData.pf} onChange={e => setFormData({ ...formData, pf: Number(e.target.value) })} className="bg-red-50/50 border border-transparent focus:bg-white focus:border-red-500 outline-none px-4 py-2.5 rounded-lg text-red-600 transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Professional Tax</label>
                                                        <input type="number" value={formData.professionalTax} onChange={e => setFormData({ ...formData, professionalTax: Number(e.target.value) })} className="bg-red-50/50 border border-transparent focus:bg-white focus:border-red-500 outline-none px-4 py-2.5 rounded-lg text-red-600 transition-all w-full" placeholder="0.00" />
                                                    </div>
                                                </div>


                                                {/* Totals */}
                                                <div className="bg-gray-50 border-gray-100 border-t dark:bg-slate-800/50 dark:border-slate-700 gap-4 grid grid-cols-2 p-4 pt-4 rounded-lg mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-300 font-semibold mb-1 text-gray-600 text-xs tracking-wider uppercase">Gross Salary</label>
                                                        <div className="dark:text-white font-bold text-gray-900 text-xl">₹ {formData.grossSalary.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block font-semibold mb-1 text-green-600 text-xs tracking-wider uppercase">Net Salary</label>
                                                        <div className="font-bold text-green-600 text-xl">₹ {formData.netSalary.toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                {/* Company Paid Leaves */}
                                                <h5 className="font-bold mb-3 text-indigo-500 text-xs tracking-wider uppercase">Company Paid Leaves (Annual Quota)</h5>
                                                <div className="gap-4 grid grid-cols-2 lg:grid-cols-3 mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Casual Leaves (CL)</label>
                                                        <input type="number" value={formData.casualLeave} onChange={e => setFormData({ ...formData, casualLeave: Number(e.target.value) })} className="bg-indigo-50/50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none px-4 py-2.5 rounded-lg text-indigo-600 transition-all w-full" placeholder="0" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Sick Leaves (SL)</label>
                                                        <input type="number" value={formData.sickLeave} onChange={e => setFormData({ ...formData, sickLeave: Number(e.target.value) })} className="bg-indigo-50/50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none px-4 py-2.5 rounded-lg text-indigo-600 transition-all w-full" placeholder="0" />
                                                    </div>
                                                </div>

                                                {/* Leave History */}
                                                {isEditing && currentId && (() => {
                                                    const emp = employees.find(e => e._id === currentId);
                                                    const history = (emp as any)?.leaveHistory || [];
                                                    if (history.length === 0) return null;

                                                    const usedCL = history.filter((h: any) => h.type === 'CL').length;
                                                    const usedSL = history.filter((h: any) => h.type === 'SL').length;

                                                    return (
                                                        <div className="mb-0 bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-700 p-4 rounded-xl">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h5 className="font-bold text-slate-600 dark:text-slate-300 text-xs tracking-wider uppercase">Leave History</h5>
                                                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex gap-4">
                                                                    <span>Used CL: <strong className="text-indigo-600 dark:text-indigo-400">{usedCL}</strong></span>
                                                                    <span>Used SL: <strong className="text-purple-600 dark:text-purple-400">{usedSL}</strong></span>
                                                                </div>
                                                            </div>
                                                            <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                                <div className="space-y-2">
                                                                    {history.map((record: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-100 dark:border-slate-700">
                                                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                                {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                                                record.type === 'CL' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                                                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                                            }`}>
                                                                                {record.type}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                                                <h4 className="border-b dark:text-white flex font-semibold gap-2 items-center mb-4 pb-2 text-gray-900 text-sm"><Coins size={16} /> Banking Details</h4>
                                                <div className="gap-4 grid grid-cols-2">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Bank Name</label>
                                                        <input type="text" value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="e.g. HDFC Bank" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Account Number</label>
                                                        <input type="text" value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">IFSC Code</label>
                                                        <input type="text" value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Branch Name</label>
                                                        <input type="text" value={formData.branchName} onChange={e => setFormData({ ...formData, branchName: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Actions */}
                                    <div className="bg-white border-gray-100 border-t bottom-0 dark:bg-slate-800 dark:border-slate-700 flex gap-3 justify-end pb-2 pt-6 sticky">
                                        <button type="button" onClick={() => { setShowModal(false); stopCamera(); }} className="bg-gray-100 dark:bg-slate-700 dark:text-gray-200 font-medium hover:bg-gray-200 px-5 py-2.5 rounded-xl text-gray-700 transition-colors">Cancel</button>
                                        <button type="submit" disabled={submitting} className="bg-blue-600 flex font-medium gap-2 hover:bg-blue-700 items-center px-8 py-2.5 rounded-xl shadow-blue-200 shadow-lg text-white transition-all">
                                            {submitting ? <div className="animate-spin border-2 border-t-white border-white/30 h-5 rounded-full w-5" /> : <Save size={20} />}
                                            {isEditing ? "Update Employee" : "Create Employee"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
