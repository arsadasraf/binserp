"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Search, Edit2, X, Camera, Upload, Coins, Briefcase, User, IndianRupee, Save, Phone, Mail, Check, Zap, ChevronDown, ChevronUp, History, Clock, Download, Eye, FileText } from "lucide-react";
import axios from "axios";
import { Employee, Department, Designation, Skill, EmployeeType } from "../../types/hr.types";
import { API_BASE_URL } from "@/src/utils/config";
import CompOffHistoryModal from "../modals/CompOffHistoryModal";
import HrMasterExcelActions from "./HrMasterExcelActions";


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
    const [employeePrefix, setEmployeePrefix] = useState<string>("Prefix");

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"personal" | "professional" | "salary" | "leave_ot">("personal");

    // CompOff History Modal State
    const [showCompOffHistoryModal, setShowCompOffHistoryModal] = useState(false);
    const [selectedCompOffEmployee, setSelectedCompOffEmployee] = useState<Employee | null>(null);

    // Camera Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);



    interface FormData {
        name: string;
        gender: string;
        bloodGroup: string;
        dob: string;
        email: string;
        contact: string;
        department: string;
        employeeType: string;
        designation: string;
        idType: string;
        joiningDate: string;
        status: string;
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
        isPFApplicable: boolean;
        pfUanNumber: string;
        isESIApplicable: boolean;
        esiNumber: string;
        esi: number;
        isPTApplicable: boolean;
        professionalTax: number;
        grossSalary: number;
        netSalary: number;
        casualLeave: number;
        sickLeave: number;
        perDayCalculationBasis: string;
        dailyDivisorBasis: string;
        otCalculationBasis: string;
        otDivisorBasis: string;
        otRate: number;
        standardWorkingHours: number;
        weeklyOff: string[];
        holidayWorkPolicy: string;
        weekOffWorkPolicy: string;
        compOffBalance: number;
        isOTApplicable: boolean;
        otCompensateForAbsent: boolean;
        absentOTRate: number;
    }

    const [formData, setFormData] = useState<FormData>({
        name: "",
        gender: "",
        bloodGroup: "",
        dob: "",
        email: "",
        contact: "",
        department: "",
        employeeType: "Full-Time",
        designation: "",
        idType: "",
        joiningDate: new Date().toISOString().split("T")[0],
        status: "Active",
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
        isPFApplicable: false,
        pfUanNumber: "",
        isESIApplicable: false,
        esiNumber: "",
        esi: 0,
        isPTApplicable: false,
        professionalTax: 0,
        grossSalary: 0,
        netSalary: 0,
        casualLeave: 0,
        sickLeave: 0,
        perDayCalculationBasis: "Gross",
        dailyDivisorBasis: "TotalMonthDays",
        otCalculationBasis: "Basic",
        otDivisorBasis: "TotalMonthDays",
        otRate: 0,
        standardWorkingHours: 9,
        weeklyOff: ["Sunday"],
        holidayWorkPolicy: "Overtime",
        weekOffWorkPolicy: "Overtime",
        compOffBalance: 0,
        isOTApplicable: false,
        otCompensateForAbsent: true,
        absentOTRate: 0,
    });

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const [idFiles, setIdFiles] = useState<File[]>([]);
    const [idPreviews, setIdPreviews] = useState<string[]>([]);

    const [degreeFiles, setDegreeFiles] = useState<File[]>([]);
    const [degreePreviews, setDegreePreviews] = useState<string[]>([]);

    const [experienceFiles, setExperienceFiles] = useState<File[]>([]);
    const [experiencePreviews, setExperiencePreviews] = useState<string[]>([]);

    useEffect(() => {
        fetchEmployees();
        fetchDepartments();
        fetchDesignations();
        fetchEmployeeTypes();
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

        const computedPf = formData.pf > 0 ? formData.pf : (formData.isPFApplicable ? Math.round(Number(formData.basic || 0) * 0.12) : 0);
        const computedEsi = formData.esi > 0 ? formData.esi : (formData.isESIApplicable ? Math.round(gross * 0.0075) : 0);
        const computedPt = formData.professionalTax > 0 ? formData.professionalTax : (formData.isPTApplicable ? 200 : 0);

        const net = gross - computedPf - computedPt - computedEsi;

        if (gross !== formData.grossSalary || net !== formData.netSalary) {
            setFormData(prev => ({ ...prev, grossSalary: gross, netSalary: net }));
        }
    }, [formData.basic, formData.hra, formData.conveyance, formData.medical, formData.specialAllowance, formData.pf, formData.esi, formData.professionalTax, formData.isPFApplicable, formData.isESIApplicable, formData.isPTApplicable]);

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

    const handleOpenAdd = () => {
        setFormData({
            name: "", gender: "", bloodGroup: "", dob: "", idType: "", email: "", contact: "", department: "", employeeType: "Full-Time", designation: "",
            joiningDate: new Date().toISOString().split("T")[0], status: "Active",
            experience: "", degree: "",
            accountNumber: "", bankName: "", ifscCode: "", branchName: "",
            basic: 0, hra: 0, conveyance: 0, medical: 0, specialAllowance: 0,
            pf: 0, isPFApplicable: false, pfUanNumber: "", isESIApplicable: false, esiNumber: "", esi: 0,
            isPTApplicable: false, professionalTax: 0, grossSalary: 0, netSalary: 0,
            casualLeave: 0, sickLeave: 0, perDayCalculationBasis: "Gross", dailyDivisorBasis: "TotalMonthDays", otCalculationBasis: "Basic", otDivisorBasis: "TotalMonthDays", otRate: 0,
            standardWorkingHours: 9, weeklyOff: ["Sunday"], holidayWorkPolicy: "Overtime", weekOffWorkPolicy: "Overtime", compOffBalance: 0,
            isOTApplicable: false, otCompensateForAbsent: true, absentOTRate: 0
        });
        setPhotoFile(null);
        setPhotoPreview(null);
        setIdFiles([]); setIdPreviews([]);
        setDegreeFiles([]); setDegreePreviews([]);
        setExperienceFiles([]); setExperiencePreviews([]);
        setCapturedImage(null);
        setIsEditing(false);
        setCurrentId(null);
        setActiveTab("personal");
        setShowModal(true);
    };

    const handleOpenEdit = (emp: Employee) => {
        setFormData({
            name: emp.name,
            gender: emp.gender || "",
            bloodGroup: emp.bloodGroup || "",
            dob: emp.dob ? new Date(emp.dob).toISOString().split("T")[0] : "",
            idType: emp.idType || "",
            email: emp.email,
            contact: emp.contact,
            department: emp.department,
            employeeType: emp.employeeType || "Full-Time",
            designation: emp.designation,
            joiningDate: new Date(emp.joiningDate).toISOString().split("T")[0],
            status: emp.status,
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
            isPFApplicable: emp.salary?.isPFApplicable ?? false,
            pfUanNumber: emp.salary?.pfUanNumber || "",
            isESIApplicable: emp.salary?.isESIApplicable ?? false,
            esiNumber: emp.salary?.esiNumber || "",
            esi: emp.salary?.esi ?? 0,
            isPTApplicable: emp.salary?.isPTApplicable ?? false,
            professionalTax: emp.salary?.professionalTax ?? 0,
            grossSalary: emp.salary?.grossSalary ?? 0,
            netSalary: emp.salary?.netSalary ?? 0,
            perDayCalculationBasis: emp.salary?.perDayCalculationBasis || "Gross",
            dailyDivisorBasis: emp.salary?.dailyDivisorBasis || "TotalMonthDays",
            otCalculationBasis: emp.salary?.otCalculationBasis || "Basic",
            otDivisorBasis: emp.salary?.otDivisorBasis || "TotalMonthDays",
            otRate: emp.salary?.otRate ?? 0,
            casualLeave: (emp as any).leaves?.casualLeave ?? 0,
            sickLeave: (emp as any).leaves?.sickLeave ?? 0,
            standardWorkingHours: emp.standardWorkingHours ?? 9,
            weeklyOff: Array.isArray(emp.weeklyOff) ? emp.weeklyOff : emp.weeklyOff ? [emp.weeklyOff as unknown as string] : ["Sunday"],
            holidayWorkPolicy: emp.holidayWorkPolicy || "Overtime",
            weekOffWorkPolicy: emp.weekOffWorkPolicy || "Overtime",
            compOffBalance: emp.compOffBalance ?? 0,
            isOTApplicable: emp.isOTApplicable ?? false,
            otCompensateForAbsent: emp.otCompensateForAbsent ?? true,
            absentOTRate: emp.absentOTRate ?? 0,
        });
        setPhotoPreview(emp.photo || null);
        setPhotoFile(null);
        
        setIdFiles([]);
        setIdPreviews((emp as any).idDocuments || []);
        
        setDegreeFiles([]);
        setDegreePreviews(emp.degreeDocuments || []);
        
        setExperienceFiles([]);
        setExperiencePreviews(emp.experienceDocuments || []);

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
        if (!formData.name) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" };
            const url = `${API_BASE_URL}/api/hr/employee`;

            const data = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (!['accountNumber', 'bankName', 'ifscCode', 'branchName',
                    'basic', 'hra', 'conveyance', 'medical', 'specialAllowance', 'grossSalary', 'pf', 'esi', 'professionalTax', 'netSalary',
                    'casualLeave', 'sickLeave', 'perDayCalculationBasis', 'otRate',
                    'standardWorkingHours', 'weeklyOff', 'holidayWorkPolicy', 'weekOffWorkPolicy', 'compOffBalance',
                    'isOTApplicable', 'otCompensateForAbsent', 'absentOTRate'].includes(key)) {
                    data.append(key, value as string);
                }
            });

            // Serialize complex data
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
                isPFApplicable: formData.isPFApplicable,
                pfUanNumber: formData.pfUanNumber,
                isESIApplicable: formData.isESIApplicable,
                esiNumber: formData.esiNumber,
                esi: formData.esi,
                isPTApplicable: formData.isPTApplicable,
                professionalTax: formData.professionalTax,
                netSalary: formData.netSalary,
                perDayCalculationBasis: formData.perDayCalculationBasis,
                dailyDivisorBasis: formData.dailyDivisorBasis,
                otCalculationBasis: formData.otCalculationBasis,
                otDivisorBasis: formData.otDivisorBasis,
                otRate: formData.otRate
            }));
            data.append("leaves", JSON.stringify({
                casualLeave: formData.casualLeave,
                sickLeave: formData.sickLeave
            }));
            
            data.append("standardWorkingHours", String(formData.standardWorkingHours));
            data.append("weeklyOff", JSON.stringify(formData.weeklyOff));
            data.append("holidayWorkPolicy", formData.holidayWorkPolicy);
            data.append("weekOffWorkPolicy", formData.weekOffWorkPolicy);
            data.append("compOffBalance", String(formData.compOffBalance));
            data.append("isOTApplicable", String(formData.isOTApplicable));
            data.append("otCompensateForAbsent", String(formData.otCompensateForAbsent));
            data.append("absentOTRate", String(formData.absentOTRate));

            if (photoFile) data.append("photo", photoFile);

            idFiles.forEach(f => data.append("idDocuments", f));
            degreeFiles.forEach(f => data.append("degreeDocuments", f));
            experienceFiles.forEach(f => data.append("experienceDocuments", f));
            
            // Append remaining preview URLs to keep existing files
            if (idPreviews.length > 0) data.append("existingIdDocuments", JSON.stringify(idPreviews.filter(p => p.startsWith('http'))));
            if (degreePreviews.length > 0) data.append("existingDegreeDocuments", JSON.stringify(degreePreviews.filter(p => p.startsWith('http'))));
            if (experiencePreviews.length > 0) data.append("existingExperienceDocuments", JSON.stringify(experiencePreviews.filter(p => p.startsWith('http'))));

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
        if (!confirm("Are you sure you want to delete this employee?\n\nNote: If attendance or salary has already been marked, the employee cannot be deleted and must be deactivated (toggle Active/Inactive).")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/api/hr/employee/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchEmployees();
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to delete employee. If attendance has been marked, deactivate the employee instead.");
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

    const handleMultiFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFiles: React.Dispatch<React.SetStateAction<File[]>>, setPreviews: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 5); // Limit to 5
            setFiles(prev => [...prev, ...newFiles].slice(0, 5));
            
            newFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setPreviews(prev => [...prev, ev.target?.result as string].slice(0, 5));
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeMultiFile = (index: number, previews: string[], setPreviews: React.Dispatch<React.SetStateAction<string[]>>, setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
        const isExistingUrl = previews[index].startsWith('http');
        setPreviews(prev => prev.filter((_, i) => i !== index));
        
        if (!isExistingUrl) {
            const existingUrlsCount = previews.filter(p => p.startsWith('http')).length;
            const fileIndex = index - existingUrlsCount;
            if (fileIndex >= 0) {
                setFiles(prev => prev.filter((_, i) => i !== fileIndex));
            }
        }
    };
    const getBaseHourlyRate = () => {
        const { perDayCalculationBasis, basic, grossSalary, netSalary, standardWorkingHours } = formData;
        let monthlyBase = 0;
        if (perDayCalculationBasis === "Gross") monthlyBase = grossSalary || 0;
        else if (perDayCalculationBasis === "Net") monthlyBase = netSalary || 0;
        else monthlyBase = basic || 0;

        const perDay = monthlyBase / 30; // Assuming 30 days
        const hours = standardWorkingHours || 9; // Avoid division by zero
        return perDay / hours;
    };

    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        (typeFilter === "" || e.employeeType === typeFilter) &&
        (roleFilter === "" || e.designation === roleFilter) &&
        (statusFilter === "" || e.status === statusFilter)
    );

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-row gap-3 items-center justify-between md:gap-4 md:p-5 p-4 rounded-2xl shadow-sm">
                <div className="flex flex-1 md:flex-none flex-wrap gap-3 items-center">
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
                </div>
                <div className="flex items-center gap-2">
                    <HrMasterExcelActions
                        masterTab="employee"
                        data={employees}
                        onSuccess={fetchEmployees}
                    />
                    <button
                        onClick={handleOpenAdd}
                        className="bg-blue-600 flex flex-none font-medium gap-2 hover:bg-blue-700 hover:shadow-blue-200 hover:shadow-lg items-center justify-center md:px-5 px-3 py-2.5 rounded-xl text-white transition-all text-sm font-bold shadow-sm"
                    >
                        <Plus size={20} /> <span className="hidden md:inline">Add Employee</span>
                    </button>
                </div>
            </div>

            {/* Employee List - Responsive */}
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 overflow-hidden rounded-2xl shadow-sm">

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="text-left w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="dark:text-gray-200 font-semibold px-6 py-3 text-gray-700 align-top">
                                    <div className="flex flex-col gap-2">
                                        <span>Employee</span>
                                        <div className="h-6"></div>
                                    </div>
                                </th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-3 text-gray-700 align-top">
                                    <div className="flex flex-col gap-2">
                                        <span>Role</span>
                                        <select
                                            value={roleFilter}
                                            onChange={(e) => setRoleFilter(e.target.value)}
                                            className="bg-white border border-gray-200 dark:border-slate-600 dark:bg-slate-900 focus:border-blue-500 outline-none px-2 py-1 rounded-lg font-normal text-xs transition-all w-full dark:text-gray-300"
                                        >
                                            <option value="">All Roles</option>
                                            {designations.map(d => (
                                                <option key={d._id} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-3 text-gray-700 align-top">
                                    <div className="flex flex-col gap-2">
                                        <span>Type</span>
                                        <select
                                            value={typeFilter}
                                            onChange={(e) => setTypeFilter(e.target.value)}
                                            className="bg-white border border-gray-200 dark:border-slate-600 dark:bg-slate-900 focus:border-blue-500 outline-none px-2 py-1 rounded-lg font-normal text-xs transition-all w-full dark:text-gray-300"
                                        >
                                            <option value="">All Types</option>
                                            {employeeTypes.map(t => (
                                                <option key={t._id} value={t.name}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-3 text-gray-700 align-top">
                                    <div className="flex flex-col gap-2">
                                        <span>Leave Balances</span>
                                        <div className="h-6"></div> {/* Spacer for alignment */}
                                    </div>
                                </th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-3 text-gray-700 align-top">
                                    <div className="flex flex-col gap-2">
                                        <span>Status</span>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="bg-white border border-gray-200 dark:border-slate-600 dark:bg-slate-900 focus:border-blue-500 outline-none px-2 py-1 rounded-lg font-normal text-xs transition-all w-full dark:text-gray-300"
                                        >
                                            <option value="">All Statuses</option>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="dark:text-gray-200 font-semibold px-6 py-3 text-gray-700 text-right align-top">
                                    <div className="flex flex-col gap-2">
                                        <span>Actions</span>
                                        <div className="h-6"></div>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-gray-100 divide-y">
                            {loading ? (
                                <tr><td colSpan={6} className="dark:text-gray-400 px-6 py-10 text-center text-gray-500">Loading...</td></tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr><td colSpan={6} className="dark:text-gray-400 px-6 py-10 text-center text-gray-500">No employees found.</td></tr>
                            ) : (
                                filteredEmployees.map((emp) => (
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
                                            <div className="flex gap-2">
                                                <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/30" title="Casual Leave Balance">
                                                    CL: {emp.leaves?.casualLeave || 0}
                                                </span>
                                                <span className="text-xs font-medium px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/30" title="Sick Leave Balance">
                                                    SL: {emp.leaves?.sickLeave || 0}
                                                </span>
                                                <span className="text-xs font-medium px-2 py-1 bg-teal-50 text-teal-700 rounded border border-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800/30" title="Comp Off Balance">
                                                    CO: {emp.compOffBalance || 0}
                                                </span>
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
                    ) : filteredEmployees.map((emp) => (
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
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <span className="bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] text-indigo-600 font-medium dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/30">
                                        CL: {emp.leaves?.casualLeave || 0}
                                    </span>
                                    <span className="bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded text-[10px] text-purple-600 font-medium dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/30">
                                        SL: {emp.leaves?.sickLeave || 0}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setSelectedCompOffEmployee(emp); setShowCompOffHistoryModal(true); }}
                                        className="bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded text-[10px] text-teal-600 font-medium hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800/30 dark:hover:bg-teal-800/50 transition-colors"
                                    >
                                        CO: {emp.compOffBalance || 0}
                                    </button>
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
                    <div className="bg-white dark:bg-slate-800 flex flex-col max-h-[90vh] max-w-[95vw] md:max-w-7xl overflow-hidden rounded-2xl shadow-2xl w-full">
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
                                        { id: "leave_ot", icon: Clock, label: "Leave & OT Policies" },
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
                                                    <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Full Name <span className="text-red-500">*</span></label>
                                                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="e.g. Rahul Sharma" />
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Gender</label>
                                                            <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                                <option value="">Select Gender</option>
                                                                <option value="Male">Male</option>
                                                                <option value="Female">Female</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Blood Group</label>
                                                            <input type="text" value={formData.bloodGroup} onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="e.g. O+" />
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Date of Birth</label>
                                                            <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Email Address</label>
                                                            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="rahul@example.com" />
                                                        </div>
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Contact Number</label>
                                                            <input type="text" value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="+91 9876543210" />
                                                        </div>
                                                    </div>

                                                    <div className="border-gray-100 border-t dark:border-slate-700 gap-4 grid grid-cols-1 md:grid-cols-2 pt-4">
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
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Department <span className="text-red-500">*</span></label>
                                                        <select required value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="">Select Department</option>
                                                            {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Designation <span className="text-red-500">*</span></label>
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
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Date of Joining <span className="text-red-500">*</span></label>
                                                        <input required type="date" value={formData.joiningDate} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 md:col-span-2 p-6 rounded-xl shadow-sm space-y-4">
                                                <h4 className="border-b dark:text-white font-semibold mb-2 pb-2 text-gray-900 text-sm">Documents, Qualifications & Experience</h4>
                                                <div className="gap-6 grid grid-cols-1 md:grid-cols-3">

                                                    {/* Identity Documents Section */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Identity Card Type</label>
                                                            <div className="flex gap-2 items-center">
                                                                <select value={formData.idType} onChange={e => setFormData({ ...formData, idType: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full flex-1">
                                                                    <option value="">Select ID Type</option>
                                                                    <option value="Aadhar Card">Aadhar Card</option>
                                                                    <option value="PAN Card">PAN Card</option>
                                                                    <option value="Voter ID">Voter ID</option>
                                                                    <option value="Driving License">Driving License</option>
                                                                    <option value="Passport">Passport</option>
                                                                </select>
                                                                <label className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2.5 rounded-lg cursor-pointer transition-colors border border-blue-100 flex items-center justify-center shrink-0" title="Upload ID Documents">
                                                                    <Upload size={20} />
                                                                    <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => handleMultiFileChange(e, setIdFiles, setIdPreviews)} />
                                                                </label>
                                                            </div>
                                                            {idPreviews.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                    {idPreviews.map((preview, idx) => {
                                                                        const isPdf = preview.toLowerCase().includes('.pdf') || preview.startsWith('data:application/pdf');
                                                                        return (
                                                                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 w-20 h-20 bg-gray-50 flex items-center justify-center">
                                                                            {isPdf ? (
                                                                                <FileText className="text-gray-400" size={24} />
                                                                            ) : (
                                                                                <img src={preview} alt="ID Preview" className="w-full h-full object-cover" />
                                                                            )}
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                                                <div className="flex gap-2">
                                                                                    <a href={preview} target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
                                                                                        <Eye size={12} />
                                                                                    </a>
                                                                                    <a href={preview} download={`id-doc-${idx}`} className="bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
                                                                                        <Download size={12} />
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                            <button type="button" onClick={() => removeMultiFile(idx, idPreviews, setIdPreviews, setIdFiles)} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10">
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    )})}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Degree Section */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Degree / Qualification</label>
                                                            <div className="flex gap-2 items-center">
                                                                <select value={formData.degree} onChange={e => setFormData({ ...formData, degree: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full flex-1">
                                                                    <option value="">Select Degree</option>
                                                                    <option value="High School">High School</option>
                                                                    <option value="Diploma">Diploma</option>
                                                                    <option value="Bachelors">Bachelor's</option>
                                                                    <option value="Masters">Master's</option>
                                                                    <option value="PhD">Ph.D.</option>
                                                                </select>
                                                                <label className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2.5 rounded-lg cursor-pointer transition-colors border border-blue-100 flex items-center justify-center shrink-0" title="Upload Degree Documents">
                                                                    <Upload size={20} />
                                                                    <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => handleMultiFileChange(e, setDegreeFiles, setDegreePreviews)} />
                                                                </label>
                                                            </div>
                                                            {degreePreviews.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                    {degreePreviews.map((preview, idx) => {
                                                                        const isPdf = preview.toLowerCase().includes('.pdf') || preview.startsWith('data:application/pdf');
                                                                        return (
                                                                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 w-20 h-20 bg-gray-50 flex items-center justify-center">
                                                                            {isPdf ? (
                                                                                <FileText className="text-gray-400" size={24} />
                                                                            ) : (
                                                                                <img src={preview} alt="Degree Preview" className="w-full h-full object-cover" />
                                                                            )}
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                                                <div className="flex gap-2">
                                                                                    <a href={preview} target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
                                                                                        <Eye size={12} />
                                                                                    </a>
                                                                                    <a href={preview} download={`degree-doc-${idx}`} className="bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
                                                                                        <Download size={12} />
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                            <button type="button" onClick={() => removeMultiFile(idx, degreePreviews, setDegreePreviews, setDegreeFiles)} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10">
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    )})}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Experience Section */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Experience</label>
                                                            <div className="flex gap-2 items-center">
                                                                <select value={formData.experience} onChange={e => setFormData({ ...formData, experience: e.target.value })} className="bg-gray-50 border border-transparent cursor-pointer dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full flex-1">
                                                                    <option value="">Select Experience</option>
                                                                    <option value="Fresher">Fresher</option>
                                                                    <option value="1-3 Years">1-3 Years</option>
                                                                    <option value="3-5 Years">3-5 Years</option>
                                                                    <option value="5-10 Years">5-10 Years</option>
                                                                    <option value="10+ Years">10+ Years</option>
                                                                </select>
                                                                <label className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2.5 rounded-lg cursor-pointer transition-colors border border-blue-100 flex items-center justify-center shrink-0" title="Upload Experience Documents">
                                                                    <Upload size={20} />
                                                                    <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => handleMultiFileChange(e, setExperienceFiles, setExperiencePreviews)} />
                                                                </label>
                                                            </div>
                                                            {experiencePreviews.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                    {experiencePreviews.map((preview, idx) => {
                                                                        const isPdf = preview.toLowerCase().includes('.pdf') || preview.startsWith('data:application/pdf');
                                                                        return (
                                                                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 w-20 h-20 bg-gray-50 flex items-center justify-center">
                                                                            {isPdf ? (
                                                                                <FileText className="text-gray-400" size={24} />
                                                                            ) : (
                                                                                <img src={preview} alt="Experience Preview" className="w-full h-full object-cover" />
                                                                            )}
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                                                <div className="flex gap-2">
                                                                                    <a href={preview} target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
                                                                                        <Eye size={12} />
                                                                                    </a>
                                                                                    <a href={preview} download={`experience-doc-${idx}`} className="bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
                                                                                        <Download size={12} />
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                            <button type="button" onClick={() => removeMultiFile(idx, experiencePreviews, setExperiencePreviews, setExperienceFiles)} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10">
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    )})}
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



                                                {/* Payment Structure */}
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 mb-6">
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
                                                    
                                                    <div>
                                                        <label className="block dark:text-gray-300 font-semibold mb-1 text-gray-600 text-xs tracking-wider uppercase">Gross Salary</label>
                                                        <div className="dark:text-white font-bold text-gray-900 text-xl px-4 py-1.5">₹ {formData.grossSalary.toLocaleString()}</div>
                                                    </div>
                                                    
                                                    {/* Display Auto-Calculated Deductions if applicable */}
                                                    {formData.isPFApplicable && (
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">PF Deduction {formData.pf > 0 ? '(Manual)' : '(Auto)'}</label>
                                                            <div className="text-red-500 font-semibold text-lg px-4 py-1.5">₹ {(formData.pf > 0 ? formData.pf : Math.round(Number(formData.basic || 0) * 0.12)).toLocaleString()}</div>
                                                        </div>
                                                    )}
                                                    {formData.isESIApplicable && (
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">ESI Deduction {formData.esi > 0 ? '(Manual)' : '(Auto)'}</label>
                                                            <div className="text-red-500 font-semibold text-lg px-4 py-1.5">₹ {(formData.esi > 0 ? formData.esi : Math.round(formData.grossSalary * 0.0075)).toLocaleString()}</div>
                                                        </div>
                                                    )}
                                                    {formData.isPTApplicable && (
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Prof. Tax {formData.professionalTax > 0 ? '(Manual)' : '(Auto)'}</label>
                                                            <div className="text-red-500 font-semibold text-lg px-4 py-1.5">₹ {(formData.professionalTax > 0 ? formData.professionalTax : 200).toLocaleString()}</div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="block font-semibold mb-1 text-green-600 text-xs tracking-wider uppercase">Net Salary</label>
                                                        <div className="font-bold text-green-600 text-xl px-4 py-1.5">₹ {formData.netSalary.toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                {/* Calculation Settings */}
                                                <h5 className="dark:text-gray-300 font-semibold mt-4 mb-3 text-gray-700 text-xs tracking-widest uppercase">Wage Calculation Basis</h5>
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Per Day Salary Basis</label>
                                                        <select value={formData.perDayCalculationBasis} onChange={e => setFormData({ ...formData, perDayCalculationBasis: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="Basic">Basic</option>
                                                            <option value="Gross">Gross</option>
                                                            <option value="Net">Net</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Daily Divisor For Absences</label>
                                                        <select value={formData.dailyDivisorBasis} onChange={e => setFormData({ ...formData, dailyDivisorBasis: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full">
                                                            <option value="TotalMonthDays">Total Month Days (30/31)</option>
                                                            <option value="ApplicableWorkingDays">Applicable Working Days (e.g. 26)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <h5 className="font-bold mb-3 mt-6 text-indigo-500 text-xs tracking-wider uppercase">Statutory Compliance</h5>
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">PF Applicable</label>
                                                        <div className="mt-3">
                                                            <Switch
                                                                checked={formData.isPFApplicable}
                                                                onChange={(c) => setFormData({ ...formData, isPFApplicable: c })}
                                                                label={formData.isPFApplicable ? "Yes" : "No"}
                                                            />
                                                        </div>
                                                    </div>
                                                    {formData.isPFApplicable && (
                                                        <>
                                                            <div>
                                                                <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">PF UAN Number</label>
                                                                <input type="text" value={formData.pfUanNumber} onChange={e => setFormData({ ...formData, pfUanNumber: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="UAN Number" />
                                                            </div>
                                                            <div>
                                                                <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Manual PF (0 for Auto)</label>
                                                                <input type="number" value={formData.pf} onChange={e => setFormData({ ...formData, pf: Number(e.target.value) })} className="bg-red-50/50 border border-transparent focus:bg-white focus:border-red-500 outline-none px-4 py-2.5 rounded-lg text-red-600 transition-all w-full" placeholder="0.00" />
                                                            </div>
                                                        </>
                                                    )}
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">ESI Applicable</label>
                                                        <div className="mt-3">
                                                            <Switch
                                                                checked={formData.isESIApplicable}
                                                                onChange={(c) => setFormData({ ...formData, isESIApplicable: c })}
                                                                label={formData.isESIApplicable ? "Yes" : "No"}
                                                            />
                                                        </div>
                                                    </div>
                                                    {formData.isESIApplicable && (
                                                        <>
                                                            <div>
                                                                <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">ESI Number</label>
                                                                <input type="text" value={formData.esiNumber} onChange={e => setFormData({ ...formData, esiNumber: e.target.value })} className="bg-gray-50 border border-transparent dark:bg-slate-800/50 focus:bg-white focus:border-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="ESI Number" />
                                                            </div>
                                                            <div>
                                                                <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Manual ESI (0 for Auto)</label>
                                                                <input type="number" value={formData.esi} onChange={e => setFormData({ ...formData, esi: Number(e.target.value) })} className="bg-red-50/50 border border-transparent focus:bg-white focus:border-red-500 outline-none px-4 py-2.5 rounded-lg text-red-600 transition-all w-full" placeholder="0.00" />
                                                            </div>
                                                        </>
                                                    )}
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Prof. Tax Applicable</label>
                                                        <div className="mt-3">
                                                            <Switch
                                                                checked={formData.isPTApplicable}
                                                                onChange={(c) => setFormData({ ...formData, isPTApplicable: c })}
                                                                label={formData.isPTApplicable ? "Yes" : "No"}
                                                            />
                                                        </div>
                                                    </div>
                                                    {formData.isPTApplicable && (
                                                        <div>
                                                            <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Manual PT (0 for Auto=200)</label>
                                                            <input type="number" value={formData.professionalTax} onChange={e => setFormData({ ...formData, professionalTax: Number(e.target.value) })} className="bg-red-50/50 border border-transparent focus:bg-white focus:border-red-500 outline-none px-4 py-2.5 rounded-lg text-red-600 transition-all w-full" placeholder="0.00" />
                                                        </div>
                                                    )}
                                                </div>

                                            </div>

                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                                                <h4 className="border-b dark:text-white flex font-semibold gap-2 items-center mb-4 pb-2 text-gray-900 text-sm"><Coins size={16} /> Banking Details</h4>
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
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

                                    {/* Leave & OT Policies Tab */}
                                    {activeTab === "leave_ot" && (
                                        <div className="animate-in duration-300 slide-in-from-right-4 space-y-6">
                                            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                                                <h4 className="border-b dark:text-white flex font-semibold gap-2 items-center mb-4 pb-2 text-gray-900 text-sm"><Clock size={16} /> Leave & OT Policies</h4>

                                                {/* Salary Config */}
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100 dark:bg-slate-800 dark:border-slate-700">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">OT Applicable</label>
                                                        <div className="mt-3">
                                                            <Switch
                                                                checked={formData.isOTApplicable}
                                                                onChange={(c) => {
                                                                    if (!c) {
                                                                        setFormData({ ...formData, isOTApplicable: c, holidayWorkPolicy: "CompOff", weekOffWorkPolicy: "CompOff" });
                                                                    } else {
                                                                        setFormData({ ...formData, isOTApplicable: c, holidayWorkPolicy: "Overtime", weekOffWorkPolicy: "Overtime" });
                                                                    }
                                                                }}
                                                                label={formData.isOTApplicable ? "Yes" : "No"}
                                                            />
                                                        </div>
                                                    </div>
                                                    {formData.isOTApplicable && (
                                                        <>
                                                            <div>
                                                                <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">OT Compensates Absenteeism</label>
                                                                <div className="mt-3">
                                                                    <Switch
                                                                        checked={formData.otCompensateForAbsent}
                                                                        onChange={(c) => setFormData({ ...formData, otCompensateForAbsent: c })}
                                                                        label={formData.otCompensateForAbsent ? "Yes" : "No"}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Main OT Rate (Multiplier, e.g. 1.5x)</label>
                                                                <input type="number" step="0.1" value={formData.otRate} onChange={e => setFormData({ ...formData, otRate: Number(e.target.value) })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="1.5" />
                                                                <div className="mt-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 px-2 py-1 rounded inline-block">
                                                                    Estimated: ₹{(getBaseHourlyRate() * (formData.otRate || 0)).toFixed(2)} / hr
                                                                </div>
                                                            </div>
                                                            {!formData.otCompensateForAbsent && (
                                                                <div>
                                                                    <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Absent OT Rate (Multiplier, e.g. 1.0x)</label>
                                                                    <input type="number" step="0.1" value={formData.absentOTRate} onChange={e => setFormData({ ...formData, absentOTRate: Number(e.target.value) })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" placeholder="1.0" />
                                                                    <div className="mt-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 px-2 py-1 rounded inline-block">
                                                                        Estimated: ₹{(getBaseHourlyRate() * (formData.absentOTRate || 0)).toFixed(2)} / hr
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Working Policies Config */}
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6 bg-purple-50/50 p-4 rounded-lg border border-purple-100 dark:bg-slate-800 dark:border-slate-700">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Standard Hrs/Day</label>
                                                        <input type="number" value={formData.standardWorkingHours} onChange={e => setFormData({ ...formData, standardWorkingHours: Number(e.target.value) })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Weekly Off Day(s)</label>
                                                        <div className="relative group">
                                                            <div className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 px-4 py-2.5 rounded-lg transition-all w-full cursor-pointer flex flex-wrap gap-1 min-h-[42px] items-center">
                                                                {formData.weeklyOff.length > 0 ? (
                                                                    formData.weeklyOff.map(d => (
                                                                        <span key={d} className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                            {d.substring(0, 3)}
                                                                            <button type="button" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, weeklyOff: formData.weeklyOff.filter(w => w !== d) }); }}><X size={10} /></button>
                                                                        </span>
                                                                    ))
                                                                ) : <span className="text-gray-400 text-sm">Select days...</span>}
                                                            </div>
                                                            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                                                                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => (
                                                                    <div key={d} className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2 text-sm" onClick={() => {
                                                                        if (!formData.weeklyOff.includes(d)) {
                                                                            setFormData({ ...formData, weeklyOff: [...formData.weeklyOff, d] });
                                                                        } else {
                                                                            setFormData({ ...formData, weeklyOff: formData.weeklyOff.filter(w => w !== d) });
                                                                        }
                                                                    }}>
                                                                        <input type="checkbox" checked={formData.weeklyOff.includes(d)} readOnly className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                                        {d}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Holiday Work Policy</label>
                                                        <select disabled={!formData.isOTApplicable} value={formData.holidayWorkPolicy} onChange={e => setFormData({ ...formData, holidayWorkPolicy: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-slate-800">
                                                            <option value="Overtime" disabled={!formData.isOTApplicable}>Overtime</option>
                                                            <option value="CompOff">Comp Off</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-700 text-xs tracking-wider uppercase">Week Off Policy</label>
                                                        <select disabled={!formData.isOTApplicable} value={formData.weekOffWorkPolicy} onChange={e => setFormData({ ...formData, weekOffWorkPolicy: e.target.value })} className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2.5 rounded-lg transition-all w-full disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-slate-800">
                                                            <option value="Overtime" disabled={!formData.isOTApplicable}>Overtime</option>
                                                            <option value="CompOff">Comp Off</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Company Paid Leaves */}
                                                <h5 className="font-bold mb-3 text-indigo-500 text-xs tracking-wider uppercase">Company Paid Leaves (Annual Quota)</h5>
                                                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-6">
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Casual Leaves (CL)</label>
                                                        <input type="number" value={formData.casualLeave} onChange={e => setFormData({ ...formData, casualLeave: Number(e.target.value) })} className="bg-indigo-50/50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none px-4 py-2.5 rounded-lg text-indigo-600 transition-all w-full" placeholder="0" />
                                                    </div>
                                                    <div>
                                                        <label className="block dark:text-gray-400 font-semibold mb-1.5 text-gray-500 text-xs tracking-wider uppercase">Sick Leaves (SL)</label>
                                                        <input type="number" value={formData.sickLeave} onChange={e => setFormData({ ...formData, sickLeave: Number(e.target.value) })} className="bg-indigo-50/50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none px-4 py-2.5 rounded-lg text-indigo-600 transition-all w-full" placeholder="0" />
                                                    </div>
                                                    {(formData.weekOffWorkPolicy === "CompOff" || formData.holidayWorkPolicy === "CompOff") && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <label className="block dark:text-gray-400 font-semibold text-gray-500 text-xs tracking-wider uppercase">Comp Offs (CO)</label>
                                                                {isEditing && currentId && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const emp = employees.find(e => e._id === currentId);
                                                                            if (emp) {
                                                                                setSelectedCompOffEmployee(emp);
                                                                                setShowCompOffHistoryModal(true);
                                                                            }
                                                                        }}
                                                                        className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-1.5 py-0.5 rounded text-[10px] font-bold dark:text-teal-400 dark:hover:bg-teal-900/30 transition-colors"
                                                                    >
                                                                        <History size={12} strokeWidth={2.5} />
                                                                        HISTORY
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <input type="number" value={formData.compOffBalance} onChange={e => setFormData({ ...formData, compOffBalance: Number(e.target.value) })} className="bg-teal-50/50 border border-transparent focus:bg-white focus:border-teal-500 outline-none px-4 py-2.5 rounded-lg text-teal-600 transition-all w-full" placeholder="0" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Leave History */}
                                                {isEditing && currentId && (() => {
                                                    const emp = employees.find(e => e._id === currentId);
                                                    const history = (emp as any)?.leaveHistory || [];
                                                    if (history.length === 0) return null;

                                                    const usedCL = history.filter((h: any) => h.type === 'CL').length;
                                                    const usedSL = history.filter((h: any) => h.type === 'SL').length;
                                                    const usedCO = history.filter((h: any) => h.type === 'CO').length;

                                                    return (
                                                        <div className="mb-0 bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-700 p-4 rounded-xl">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h5 className="font-bold text-slate-600 dark:text-slate-300 text-xs tracking-wider uppercase">Leave History</h5>
                                                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex gap-4">
                                                                    <span>Used CL: <strong className="text-indigo-600 dark:text-indigo-400">{usedCL}</strong></span>
                                                                    <span>Used SL: <strong className="text-purple-600 dark:text-purple-400">{usedSL}</strong></span>
                                                                    <span>Used CO: <strong className="text-teal-600 dark:text-teal-400">{usedCO}</strong></span>
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
                                                                                record.type === 'CO' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
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
            
            <CompOffHistoryModal 
                isOpen={showCompOffHistoryModal} 
                onClose={() => { setShowCompOffHistoryModal(false); setSelectedCompOffEmployee(null); }} 
                employee={selectedCompOffEmployee} 
            />
        </div>
    );
}
