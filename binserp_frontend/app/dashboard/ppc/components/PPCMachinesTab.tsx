"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, MapPin, Camera, X, FileText, Download, Eye, Briefcase, User, Clock, ArrowRight, ClipboardList, CheckCircle, Cpu, Settings, Hash } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import Modal from "@/src/components/Modal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";
import {
  useGetMachinesQuery,
  useGetMachineCategoriesQuery,
  useGetMachineLocationsQuery,
  useGetProcessesQuery,
  useGetWorkstationsQuery,
  useCreateMachineMutation,
  useUpdateMachineMutation,
  useDeleteMachineMutation,
  useCreateMachineCategoryMutation,
  useUpdateMachineCategoryMutation,
  useDeleteMachineCategoryMutation,
  useCreateProcessMutation,
  useUpdateProcessMutation,
  useDeleteProcessMutation,
  useCreateMachineLocationMutation,
  useUpdateMachineLocationMutation,
  useDeleteMachineLocationMutation,
  useGetMachineMaintenanceQuery,
  useCreateMachineMaintenanceMutation,
} from "@/src/store/services/ppcService";

// --- Types ---
interface Machine {
    _id: string;
    machineCode: string;
    machineName: string;
    machineType: string;
    location?: any; // populated or string ID
    make?: string;
    commissionYear?: number;
    category?: any; // populated or string ID
    processes?: any[]; // populated or string IDs
    photos?: string[];
}

interface Process {
    _id: string;
    processCode: string;
    processName: string;
    description: string;
}

interface MachineCategory {
    _id: string;
    categoryCode: string;
    categoryName: string;
    description: string;
}

interface MachineLocation {
    _id: string;
    locationCode: string;
    locationName: string;
    description: string;
}

type SubTab = "machine-list" | "process" | "category" | "location";

// --- Components ---

function EmptyState({ message, onAction }: { message: string, onAction?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <Search className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No items found</h3>
            <p className="text-gray-500 text-center max-w-sm mb-6">{message}</p>
            {onAction && (
                <button
                    onClick={onAction}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Create New
                </button>
            )}
        </div>
    );
}

// --- MachineDetailView sub-component ---
interface MachineDetailViewProps {
    machine: any;
    onEdit: () => void;
    onDownloadPDF: () => void;
    onClose: () => void;
}

function MachineDetailView({ machine, onEdit, onDownloadPDF, onClose }: MachineDetailViewProps) {
    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{machine.machineName}</h3>
                    <p className="text-sm text-gray-400 font-mono mt-0.5">{machine.machineCode}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onDownloadPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                        <Download size={14} /> PDF
                    </button>
                    <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                        <Edit2 size={14} /> Edit
                    </button>
                </div>
            </div>

            {/* Photos Gallery */}
            {machine.photos && machine.photos.length > 0 && (
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Camera size={13} className="text-blue-500" /> Equipment Photos
                    </label>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {machine.photos.map((p: string, i: number) => (
                            <img key={i} src={p} alt={`Machine Photo ${i}`} className="h-24 w-32 rounded-xl object-cover flex-shrink-0 border border-gray-200 shadow-sm" />
                        ))}
                    </div>
                </div>
            )}

            {/* Machine Physical Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Make</p>
                    <p className="text-gray-900 dark:text-white font-medium mt-0.5">{machine.make || '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Model</p>
                    <p className="text-gray-900 dark:text-white font-medium mt-0.5">{machine.model || '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Serial No.</p>
                    <p className="text-gray-900 dark:text-white font-medium mt-0.5 font-mono">{machine.serialNumber || '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Commission Year</p>
                    <p className="text-gray-900 dark:text-white font-medium mt-0.5">{machine.commissionYear || '—'}</p>
                </div>
            </div>

            {/* Description */}
            {machine.description && (
                <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 text-xs text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">Description / Notes</p>
                    <p>{machine.description}</p>
                </div>
            )}
        </div>
    );
}

// --- Main Component ---
interface PPCMachinesTabProps {
    initialTab?: SubTab;
    hideSubNav?: boolean;
}

export default function PPCMachinesTab({ initialTab = "machine-list", hideSubNav = true }: PPCMachinesTabProps) {
    const router = useRouter();
    const [subTab, setSubTab] = useState<SubTab>(initialTab);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setSubTab(initialTab);
    }, [initialTab]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [viewingItem, setViewingItem] = useState<Machine | null>(null);

    // Form State
    const [formData, setFormData] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);

    // RTK Query Data hooks
    const { data: machines = [], isLoading: machinesLoading } = useGetMachinesQuery();
    const { data: categories = [], isLoading: categoriesLoading } = useGetMachineCategoriesQuery();
    const { data: locations = [], isLoading: locationsLoading } = useGetMachineLocationsQuery();
    const { data: processes = [], isLoading: processesLoading } = useGetProcessesQuery();
    const { data: workstations = [] } = useGetWorkstationsQuery();

    // RTK Query Mutations
    const [createMachine] = useCreateMachineMutation();
    const [updateMachine] = useUpdateMachineMutation();
    const [deleteMachine] = useDeleteMachineMutation();
    const [createCategory] = useCreateMachineCategoryMutation();
    const [updateCategory] = useUpdateMachineCategoryMutation();
    const [deleteCategory] = useDeleteMachineCategoryMutation();
    const [createProcess] = useCreateProcessMutation();
    const [updateProcess] = useUpdateProcessMutation();
    const [deleteProcess] = useDeleteProcessMutation();
    const [createLocation] = useCreateMachineLocationMutation();
    const [updateLocation] = useUpdateMachineLocationMutation();
    const [deleteLocation] = useDeleteMachineLocationMutation();

    const loading = subTab === 'machine-list' ? machinesLoading
        : subTab === 'category' ? categoriesLoading
        : subTab === 'process' ? processesLoading
        : locationsLoading;

    // Empty rosterMap since we removed Operator (Today) column
    const rosterMap = new Map<string, string>();




    const handleCreate = () => { setEditingItem(null); setFormData({}); setShowModal(true); };
    const handleEdit = (item: any) => { setEditingItem(item); setFormData({ ...item }); setShowModal(true); };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        try {
            if (subTab === 'machine-list') await deleteMachine(id);
            else if (subTab === 'category') await deleteCategory(id);
            else if (subTab === 'process') await deleteProcess(id);
            else if (subTab === 'location') await deleteLocation(id);
        } catch (err) {
            console.error("Delete error:", err);
            alert("An unexpected error occurred during deletion.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (subTab === 'machine-list') {
                const formDataObj = new FormData();
                if (formData.machineCode) formDataObj.append('machineCode', formData.machineCode);
                formDataObj.append('machineName', formData.machineName);
                if (formData.make) formDataObj.append('make', formData.make);
                
                // Machine Type is derived from Category as requested
                const categoryName = categories.find(c => c._id === formData.category)?.categoryName || 'Unknown';
                formDataObj.append('machineType', categoryName);

                if (formData.commissionYear) formDataObj.append('commissionYear', formData.commissionYear);
                if (formData.category) formDataObj.append('category', formData.category);
                if (formData.processes && formData.processes.length > 0) formDataObj.append('processes', JSON.stringify(formData.processes));
                if (formData.location) formDataObj.append('location', formData.location);
                if (formData.description) formDataObj.append('description', formData.description);
                if (formData.photos && formData.photos.length > 0) formData.photos.forEach((file: any) => formDataObj.append('photos', file));

                if (editingItem) await updateMachine({ id: editingItem._id, body: formDataObj });
                else await createMachine(formDataObj);
            } else if (subTab === 'category') {
                if (editingItem) await updateCategory({ id: editingItem._id, body: formData });
                else await createCategory(formData);
            } else if (subTab === 'process') {
                if (editingItem) await updateProcess({ id: editingItem._id, body: formData });
                else await createProcess(formData);
            } else if (subTab === 'location') {
                if (editingItem) await updateLocation({ id: editingItem._id, body: formData });
                else await createLocation(formData);
            }
            setShowModal(false);
        } catch (error: any) {
            console.error('Error submitting form:', error);
            alert(`An error occurred: ${error.message || 'Unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Unused but kept to avoid removing handleOpenPlanJob reference in the file
    const handleOpenPlanJob = (_machine: Machine) => {};
    const handleAssignJob = async () => {};



    // PDF Download Handler
    const handleDownloadPDF = async (machine: Machine) => {
        const doc = new jsPDF();

        // Helper to load image
        const loadImage = (url: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = url;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL("image/jpeg"));
                };
                img.onerror = () => {
                    // Start fallback logic: try to fetch as blob
                    fetch(url)
                        .then(res => res.blob())
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        })
                        .catch(reject);
                };
            });
        };

        // Header
        doc.setFillColor(79, 70, 229); // Indigo 600
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Machine Details", 14, 25);

        // Machine Info Link
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`${machine.machineName} (${machine.machineCode})`, 14, 35);

        let y = 50;

        // Photos
        if (machine.photos && machine.photos.length > 0) {
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Photos", 14, y);
            y += 10;

            const startX = 14;
            let currentX = startX;
            const imgWidth = 50;
            const imgHeight = 50;
            const margin = 10;

            for (const photoUrl of machine.photos) {
                try {
                    const base64Img = await loadImage(photoUrl);
                    if (currentX + imgWidth > 200) {
                        currentX = startX;
                        y += imgHeight + margin;
                    }
                    doc.addImage(base64Img, 'JPEG', currentX, y, imgWidth, imgHeight);
                    currentX += imgWidth + margin;
                } catch (err) {
                    console.error("Error loading image for PDF:", err);
                }
            }
            // Move y past the images row(s)
            y += imgHeight + margin;
        }

        // Basic Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);

        // Ensure we don't write over page bottom
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.text("Basic Information", 14, y);
        y += 10;

        doc.setFont("helvetica", "normal");
        doc.text(`Machine Name: ${machine.machineName}`, 14, y);
        doc.text(`Machine Code: ${machine.machineCode}`, 110, y);
        y += 8;

        doc.text(`Make: ${machine.make || 'N/A'}`, 14, y);
        doc.text(`Commission Year: ${machine.commissionYear || 'N/A'}`, 110, y);
        y += 8;

        const categoryName = categories.find(c => c._id === (typeof machine.category === 'string' ? machine.category : machine.category?._id))?.categoryName || 'N/A';
        const locationName = locations.find(l => l._id === (typeof machine.location === 'string' ? machine.location : machine.location?._id))?.locationName || 'N/A';

        doc.text(`Category: ${categoryName}`, 14, y);
        doc.text(`Location: ${locationName}`, 110, y);
        y += 15;

        // Description
        if ((machine as any).description) {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold");
            doc.text("Description", 14, y);
            y += 7;
            doc.setFont("helvetica", "normal");
            const splitDesc = doc.splitTextToSize((machine as any).description, 180);
            doc.text(splitDesc, 14, y);
            y += (splitDesc.length * 7) + 8;
        }

        // Operations
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.text("Assigned Operations", 14, y);
        y += 5;

        const processRows = (machine.processes || []).map((proc: any) => {
            const procId = typeof proc === 'string' ? proc : proc._id;
            const process = processes.find(p => p._id === procId);
            return [process?.processCode || '-', process?.processName || '-', process?.description || '-'];
        });

        if (processRows.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['Code', 'Process Name', 'Description']],
                body: processRows,
                headStyles: { fillColor: [79, 70, 229] },
            });
        } else {
            y += 10;
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            doc.text("No operations assigned.", 14, y);
        }

        doc.save(`${machine.machineCode}_Details.pdf`);
    };

    // Derived State for Filtering
    const getFilteredItems = () => {
        const term = searchTerm.toLowerCase();
        let currentItems: any[] = [];

        switch (subTab) {
            case 'machine-list': currentItems = machines; break;
            case 'category': currentItems = categories; break;
            case 'process': currentItems = processes; break;
            case 'location': currentItems = locations; break;
        }

        return currentItems.filter(item => {
            if (subTab === 'machine-list') return item.machineName?.toLowerCase().includes(term) || item.machineCode?.toLowerCase().includes(term);
            if (subTab === 'category') return item.categoryName?.toLowerCase().includes(term) || item.categoryCode?.toLowerCase().includes(term);
            if (subTab === 'process') return item.processName?.toLowerCase().includes(term) || item.processCode?.toLowerCase().includes(term);
            if (subTab === 'location') return item.locationName?.toLowerCase().includes(term) || item.locationCode?.toLowerCase().includes(term);
            return false;
        });
    };

    const filteredItems = getFilteredItems();

    const renderTable = () => {
        if (loading) {
            return (
                <div className="flex justify-center py-12">
                    <LoadingSpinner />
                </div>
            );
        }

        if (filteredItems.length === 0) {
            return <EmptyState message={`No ${subTab.replace("-", " ")} items found.`} onAction={handleCreate} />;
        }

        return (
            // Machine List View - Responsive (Table on Desktop, Cards on Mobile)
            subTab === 'machine-list' ? (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>


                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Make / Model</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comm. Year</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workstation Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredItems.map((item: any) => {
                                        const assignedWs = workstations.find((w: any) =>
                                            Array.isArray(w.machines) &&
                                            w.machines.some((m: any) => (typeof m === 'object' ? m._id : m) === item._id)
                                        );

                                        return (
                                            <tr
                                                key={item._id}
                                                onClick={() => setViewingItem(item)}
                                                className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {item.photos && item.photos.length > 0 ? (
                                                        <div className="h-9 w-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                                                            <img src={item.photos[0]} alt="Machine" className="h-full w-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{item.machineCode}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">{item.machineName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {[item.make, item.model].filter(Boolean).join(" - ") || "—"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.commissionYear || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    {assignedWs ? (
                                                        assignedWs.workstationType === "ASSEMBLY_LINE" ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                                                <CheckCircle className="w-3 h-3 mr-1 text-purple-600" />
                                                                Line: {assignedWs.workstationName}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                                <CheckCircle className="w-3 h-3 mr-1 text-indigo-600" />
                                                                Single: {assignedWs.workstationName}
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                            Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/dashboard/ppc/master/shop-floor/workstation?createForMachine=${item._id}`);
                                                        }}
                                                        className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg mr-3 transition-colors shadow-sm"
                                                        title="Create or assign workstation for this machine"
                                                    >
                                                        <Plus size={13} className="mr-1" /> Workstation
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                                        className="text-indigo-600 hover:text-indigo-900 mr-3 p-1 rounded hover:bg-indigo-50"
                                                        title="Edit Machine"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                                                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                                        title="Delete Machine"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {filteredItems.map((item: any) => (
                            <div
                                key={item._id}
                                onClick={() => setViewingItem(item)}
                                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex space-x-4 cursor-pointer active:scale-[0.99] transition-transform"
                            >
                                <div className="flex-shrink-0">
                                    {item.photos && item.photos.length > 0 ? (
                                        <img src={item.photos[0]} alt="Machine" className="h-16 w-16 rounded-md object-cover" />
                                    ) : (
                                        <div className="h-16 w-16 rounded-md bg-gray-100 flex items-center justify-center text-gray-400">
                                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-sm font-medium text-gray-900 truncate">{item.machineName}</h3>
                                        <span className="text-xs text-gray-400">{item.machineCode}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {item.make} {item.commissionYear && `• ${item.commissionYear}`}
                                    </p>


                                    <div className="flex items-center mt-2 text-xs text-gray-500 space-x-2">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                                            {categories.find(c => c._id === item.category)?.categoryName || 'No Category'}
                                        </span>
                                        <span>•</span>
                                        <span>
                                            {locations.find(l => l._id === item.location)?.locationName || 'No Location'}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex justify-end space-x-3 items-center">
                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-sm text-indigo-600 font-medium">Edit</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }} className="text-sm text-red-600 font-medium">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                // Other Tabs (Category, Process, Location) - Standard Table
                <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredItems.map((item: any) => (
                                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {subTab === 'category' ? item.categoryCode : subTab === 'process' ? item.processCode : item.locationCode}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {subTab === 'category' ? item.categoryName : subTab === 'process' ? item.processName : item.locationName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.description || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                            <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-900">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Bar: Search and Create Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative flex-1 w-full sm:max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        placeholder={`Search ${subTab === 'machine-list' ? 'machines' : subTab.replace('-', ' ')}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleCreate}
                    className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md transform transition hover:scale-[1.02]"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New
                </button>
            </div>

            {/* Sub-tabs Navigation (rendered only when hideSubNav is false) */}
            {!hideSubNav && (
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                    {[
                        { id: 'machine-list', label: 'Machine List' },
                        { id: 'category', label: 'Categories' },
                        { id: 'process', label: 'Processes' },
                        { id: 'location', label: 'Locations' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id as SubTab)}
                            className={`
                                px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                                ${subTab === tab.id
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                                }
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Content Area */}
            {renderTable()}

            {/* Modal for Categories, Processes, Locations */}
            <Modal
                isOpen={showModal && subTab !== 'machine-list'}
                onClose={() => setShowModal(false)}
                title={editingItem
                    ? `Edit ${subTab === 'category' ? 'Category' : subTab === 'process' ? 'Process' : 'Location'}`
                    : `Create New ${subTab === 'category' ? 'Category' : subTab === 'process' ? 'Process' : 'Location'}`}
            >
                <form id="modal-form" onSubmit={handleSubmit} className="space-y-6">
                    {(subTab === 'category' || subTab === 'process' || subTab === 'location') && (
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Code {editingItem ? "" : "(Auto-generated)"}</label>
                                <input
                                    type="text"
                                    disabled={true}
                                    placeholder={editingItem ? "Code" : "Auto-generated on save"}
                                    value={(subTab === 'category' ? formData.categoryCode : subTab === 'process' ? formData.processCode : formData.locationCode) || ''}
                                    onChange={e => {
                                        const key = subTab === 'category' ? 'categoryCode' : subTab === 'process' ? 'processCode' : 'locationCode';
                                        setFormData({ ...formData, [key]: e.target.value })
                                    }}
                                    className="block w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-500 focus:ring-0 sm:text-sm p-2.5 border cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder={`e.g. ${subTab === 'category' ? 'CNC Lathes' : subTab === 'process' ? 'Turning' : 'Shop Floor 1'}`}
                                    value={(subTab === 'category' ? formData.categoryName : subTab === 'process' ? formData.processName : formData.locationName) || ''}
                                    onChange={e => {
                                        const key = subTab === 'category' ? 'categoryName' : subTab === 'process' ? 'processName' : 'locationName';
                                        setFormData({ ...formData, [key]: e.target.value })
                                    }}
                                    className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                        >
                            {submitting ? <LoadingSpinner size="sm" color="white" /> : (editingItem ? 'Save Changes' : 'Create')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Custom Full-Screen Modal for Machine Form */}
            {showModal && subTab === 'machine-list' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 md:rounded-2xl shadow-xl w-full max-w-[100vw] h-[100dvh] md:h-[90vh] md:max-w-[95vw] lg:max-w-7xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                    {editingItem ? "Edit Machine" : "Create New Machine"}
                                </h2>
                                <p className="text-sm text-gray-500">Register new equipment or modify existing machine details</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin bg-gray-50/50 dark:bg-gray-900/50 pb-32">
                            <form id="machine-form" onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
                            {/* Unified 4-Column Layout */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Row 1 */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Hash size={12} className="text-indigo-500"/> Machine Code {editingItem ? "" : "(Auto)"}</label>
                                        <input
                                            type="text"
                                            disabled={true}
                                            placeholder={editingItem ? "Code" : "Auto-generated"}
                                            value={formData.machineCode || ''}
                                            onChange={e => setFormData({ ...formData, machineCode: e.target.value })}
                                            className="block w-full border-gray-200 rounded-xl shadow-sm bg-gray-50 text-gray-500 focus:ring-0 text-sm p-2.5 border cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Settings size={12} className="text-indigo-500"/> Machine Name <span className="text-red-500">*</span></label>
                                        <input type="text" required placeholder="e.g. CNC Mill B3" value={formData.machineName || ''} onChange={e => setFormData({ ...formData, machineName: e.target.value })} className="block w-full border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-sm p-2.5 border placeholder-gray-300" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Briefcase size={12} className="text-indigo-500"/> Make</label>
                                        <input type="text" placeholder="e.g. Haas" value={formData.make || ''} onChange={e => setFormData({ ...formData, make: e.target.value })} className="block w-full border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-sm p-2.5 border placeholder-gray-300" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Cpu size={12} className="text-indigo-500"/> Model</label>
                                        <input type="text" placeholder="e.g. VF-2" value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} className="block w-full border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-sm p-2.5 border placeholder-gray-300" />
                                    </div>

                                    {/* Row 2 */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileText size={12} className="text-indigo-500"/> Serial Number</label>
                                        <input type="text" placeholder="e.g. SN-12345" value={formData.serialNumber || ''} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} className="block w-full border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-sm p-2.5 border placeholder-gray-300" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Clock size={12} className="text-indigo-500"/> Comm. Year</label>
                                        <input type="number" placeholder="YYYY" value={formData.commissionYear || ''} onChange={e => setFormData({ ...formData, commissionYear: e.target.value })} className="block w-full border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-sm p-2.5 border placeholder-gray-300" />
                                    </div>
                                    {/* Row 3 - Description */}
                                    <div className="col-span-1 md:col-span-2 lg:col-span-4">
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileText size={12} className="text-indigo-500"/> Description / Notes</label>
                                        <textarea rows={2} placeholder="Physical equipment specs, technical notes..." value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="block w-full border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all text-sm p-2.5 border resize-none custom-scrollbar placeholder-gray-300" />
                                    </div>

                                    {/* Row 5 - Photos */}
                                    <div className="col-span-1 md:col-span-2 lg:col-span-4 border-t border-gray-100 pt-4 mt-2">
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Camera size={12} className="text-blue-500"/> Machine Photos</label>
                                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar items-center">
                                            <label className="cursor-pointer flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-all shadow-sm group">
                                                <Camera className="w-5 h-5 text-gray-400 group-hover:text-blue-500 mb-1" />
                                                <span className="text-[10px] text-gray-500 font-semibold group-hover:text-blue-600">Upload</span>
                                                <input type="file" className="hidden" accept="image/*" multiple onChange={e => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        const currentPhotos = formData.photos || [];
                                                        setFormData({ ...formData, photos: [...currentPhotos, ...Array.from(e.target.files)] });
                                                    }
                                                }} />
                                            </label>

                                            {formData.photos && Array.from(formData.photos).map((file: any, index: number) => (
                                                <div key={`new-${index}`} className="relative w-20 h-20 border border-gray-200 rounded-xl overflow-hidden group shadow-sm bg-white flex-shrink-0">
                                                    <img src={typeof file === 'string' ? file : URL.createObjectURL(file)} alt={`Photo ${index}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    <button type="button" onClick={() => { const updatedPhotos = Array.from(formData.photos || []).filter((_, i) => i !== index); setFormData({ ...formData, photos: updatedPhotos }); }} className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all">
                                                        <X size={12} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!formData.photos || formData.photos.length === 0) && (
                                                <span className="text-xs text-gray-400 italic">No photos.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-5 mt-4 border-t border-gray-100 justify-end">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 shadow-sm text-sm font-bold rounded-xl text-gray-600 bg-white hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-[0.98]">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={submitting} className="inline-flex items-center justify-center px-5 py-2.5 shadow-sm text-sm font-bold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all active:scale-[0.98] min-w-[140px]">
                                        {submitting ? <LoadingSpinner size="sm" color="white" /> : (
                                            <><CheckCircle className="w-4 h-4 mr-2"/> {editingItem ? 'Update Machine' : 'Create Machine'}</>
                                        )}
                                    </button>
                                </div>
                            </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={!!viewingItem}
                onClose={() => setViewingItem(null)}
                title="Machine Details"
            >
                {viewingItem && (
                    <MachineDetailView
                        machine={viewingItem}
                        onEdit={() => { setViewingItem(null); handleEdit(viewingItem); }}
                        onDownloadPDF={() => handleDownloadPDF(viewingItem)}
                        onClose={() => setViewingItem(null)}
                    />
                )}
            </Modal>

        </div>
    );
}
