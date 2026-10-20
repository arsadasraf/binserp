"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, RefreshCw, Wrench, ShieldCheck, AlertCircle, 
    CheckCircle2, Clock, Calendar, Box, Tag, Edit2, Trash2, X, Check,
    UserCheck, FileText, ChevronRight, Video, ExternalLink, Download,
    Send, Award, Star, AlertTriangle, Layers, Navigation, Phone, Mail
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InstalledItem {
    _id: string;
    customerName: string;
    productName: string;
    productDescription?: string;
    serialNumber: string;
    batchNumber?: string;
    deliveryDate?: string;
    invoiceNumber?: string;
    warrantyPeriodMonths: number;
    warrantyExpiryDate?: string;
    warrantyStatus: "Under Warranty" | "Out of Warranty" | "AMC Active";
    amcStartDate?: string;
    amcEndDate?: string;
    amcValue?: number;
    location?: string;
    notes?: string;
    createdByName?: string;
    createdAt?: string;
}

interface ServiceTicket {
    _id: string;
    ticketNo: string;
    customerName: string;
    productName?: string;
    serialNumber?: string;
    category: string;
    priority: "Low" | "Medium" | "High" | "Urgent";
    status: "Open" | "Assigned" | "In Progress" | "Resolved" | "Closed";
    issueDescription: string;
    technicianName?: string;
    scheduledVisitDate?: string;
    timeSlot?: string;
    sparePartsRequired?: Array<{
        partName: string;
        partNumber?: string;
        quantity: number;
        isReplaced?: boolean;
    }>;
    customerSignOff?: {
        signedBy?: string;
        remarks?: string;
        satisfactionRating?: number;
        signedAt?: string;
    };
    resolutionNotes?: string;
    chargeable?: boolean;
    serviceCost?: number;
    createdByName?: string;
    createdAt?: string;
}

interface CRMInstallation {
    _id: string;
    installationNo: string;
    customerName: string;
    productName: string;
    productDescription?: string;
    serialNumber: string;
    siteLocation?: string;
    commissioningDate?: string;
    fieldEngineerName?: string;
    clientAttendants?: Array<{
        name: string;
        designation?: string;
        phone?: string;
        email?: string;
    }>;
    checklist?: Array<{
        item: string;
        status: "Pending" | "Passed" | "Failed" | "N/A";
        remarks?: string;
    }>;
    trainingProvided?: {
        conducted: boolean;
        topicsCovered?: string;
        traineesCount?: number;
    };
    media?: {
        photos?: string[];
        videoUrls?: Array<{
            title?: string;
            url: string;
            type?: "Upload" | "YouTube" | "Drive" | "Vimeo" | "Link";
        }>;
    };
    signOff?: {
        isSignedOff: boolean;
        signedByClientName?: string;
        signedByClientDesignation?: string;
        signOffDate?: string;
        satisfactionRating?: number;
        remarks?: string;
    };
    status: "Scheduled" | "In Progress" | "Completed & Signed Off" | "On Hold";
    createdAt?: string;
}

export default function AfterSalesServicesHub() {
    const [activeSection, setActiveSection] = useState<"installed" | "installations" | "tickets">("installed");
    const [installedItems, setInstalledItems] = useState<InstalledItem[]>([]);
    const [installations, setInstallations] = useState<CRMInstallation[]>([]);
    const [tickets, setTickets] = useState<ServiceTicket[]>([]);
    const [metrics, setMetrics] = useState<{
        total: number;
        underWarranty: number;
        outOfWarranty: number;
        amcActive: number;
        expiring30: number;
        expiring60: number;
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [warrantyFilter, setWarrantyFilter] = useState("All");
    const [expiryFilter, setExpiryFilter] = useState("All");
    const [ticketStatusFilter, setTicketStatusFilter] = useState("All");
    const [installationStatusFilter, setInstallationStatusFilter] = useState("All");

    // Installed Base Modal State
    const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
    const [editingEquip, setEditingEquip] = useState<InstalledItem | null>(null);
    const [equipForm, setEquipForm] = useState({
        customerName: "",
        productName: "",
        productDescription: "",
        serialNumber: "",
        batchNumber: "",
        deliveryDate: new Date().toISOString().slice(0, 10),
        invoiceNumber: "",
        warrantyPeriodMonths: 12,
        warrantyExpiryDate: "",
        warrantyStatus: "Under Warranty" as InstalledItem["warrantyStatus"],
        amcStartDate: "",
        amcEndDate: "",
        amcValue: 0,
        location: "",
        notes: ""
    });

    // AMC Renewal Modal State
    const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
    const [renewalItem, setRenewalItem] = useState<InstalledItem | null>(null);
    const [renewalStartDate, setRenewalStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [renewalEndDate, setRenewalEndDate] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [renewalValue, setRenewalValue] = useState(50000);

    // Ticket Modal State
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
    const [ticketForm, setTicketForm] = useState({
        customerName: "",
        productName: "",
        serialNumber: "",
        category: "Breakdown",
        priority: "Medium" as ServiceTicket["priority"],
        status: "Open" as ServiceTicket["status"],
        issueDescription: "",
        technicianName: "",
        scheduledVisitDate: "",
        timeSlot: "10:00 AM - 01:00 PM",
        sparePartsRequired: [
            { partName: "", partNumber: "", quantity: 1, isReplaced: false }
        ],
        resolutionNotes: "",
        chargeable: false,
        serviceCost: 0
    });

    // Installation Modal State
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [editingInstall, setEditingInstall] = useState<CRMInstallation | null>(null);
    const [installForm, setInstallForm] = useState({
        customerName: "",
        productName: "",
        productDescription: "",
        serialNumber: "",
        siteLocation: "",
        commissioningDate: new Date().toISOString().slice(0, 10),
        fieldEngineerName: "",
        clientAttendants: [
            { name: "", designation: "Plant Engineer", phone: "", email: "" }
        ],
        checklist: [
            { item: "Power input & voltage verification (Within ±5% tolerance)", status: "Passed" as const, remarks: "Measured 415V steady." },
            { item: "Mechanical mounting, levelling & vibration dampers check", status: "Passed" as const, remarks: "Spirit level bubble centered." },
            { item: "Safety guards, emergency stop switches & interlocks testing", status: "Passed" as const, remarks: "Emergency stops functional." },
            { item: "Lubrication, pneumatic & hydraulic pressure check", status: "Passed" as const, remarks: "6 bar operating pressure." },
            { item: "Control panel PLC/HMI calibration & sensor alignment", status: "Passed" as const, remarks: "Sensors responding accurately." },
            { item: "Dry run test cycle (30 minutes non-load continuous operation)", status: "Passed" as const, remarks: "No overheating or vibration." },
            { item: "Live batch sample test run & dimensional QA inspection", status: "Passed" as const, remarks: "Tolerance within 0.02mm." },
            { item: "Operator & Maintenance team training session conducted", status: "Passed" as const, remarks: "SOP handover completed." }
        ],
        trainingTopics: "Machine operation, safety interlocks, emergency stop procedures, basic calibration and daily maintenance SOP.",
        traineesCount: 4,
        trainingConducted: true,
        videoUrls: [
            { title: "Commissioning & Training Walkthrough", url: "", type: "YouTube" as const }
        ],
        signOffName: "",
        signOffDesignation: "Plant Head / GM",
        satisfactionRating: 5,
        signOffRemarks: "Machine installed, commissioned and handed over in satisfactory working condition.",
        isSignedOff: true
    });

    // Video Viewing Drawer
    const [activeVideoModal, setActiveVideoModal] = useState<CRMInstallation | null>(null);

    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let equipUrl = `/api/crm/installed-base?search=${encodeURIComponent(search)}`;
            if (warrantyFilter !== "All") equipUrl += `&warrantyStatus=${encodeURIComponent(warrantyFilter)}`;
            if (expiryFilter !== "All") equipUrl += `&expiryFilter=${encodeURIComponent(expiryFilter)}`;

            let ticketUrl = `/api/crm/service-tickets?search=${encodeURIComponent(search)}`;
            if (ticketStatusFilter !== "All") ticketUrl += `&status=${encodeURIComponent(ticketStatusFilter)}`;

            let installUrl = `/api/crm/installations?search=${encodeURIComponent(search)}`;
            if (installationStatusFilter !== "All") installUrl += `&status=${encodeURIComponent(installationStatusFilter)}`;

            const [equipRes, ticketRes, installRes] = await Promise.all([
                apiGet(equipUrl, token).catch(() => ({ data: [] })),
                apiGet(ticketUrl, token).catch(() => ({ data: [] })),
                apiGet(installUrl, token).catch(() => ({ data: [] }))
            ]);

            const equipData = equipRes.data?.items || equipRes.data || [];
            setInstalledItems(equipData);
            if (equipRes.data?.metrics) {
                setMetrics(equipRes.data.metrics);
            }
            setTickets(ticketRes.data || []);
            setInstallations(installRes.data || []);
        } catch (err) {
            console.error("Failed to fetch after-sales data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [warrantyFilter, expiryFilter, ticketStatusFilter, installationStatusFilter]);

    // Handle AMC Renewal
    const handleOpenRenewal = (item: InstalledItem) => {
        setRenewalItem(item);
        setRenewalStartDate(new Date().toISOString().slice(0, 10));
        setRenewalEndDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
        setRenewalValue(item.amcValue || 50000);
        setIsRenewalModalOpen(true);
    };

    const handleSaveRenewal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renewalItem) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await apiPut(`/api/crm/installed-base/${renewalItem._id}`, {
                warrantyStatus: "AMC Active",
                amcStartDate: renewalStartDate,
                amcEndDate: renewalEndDate,
                amcValue: renewalValue
            }, token);
            setIsRenewalModalOpen(false);
            setRenewalItem(null);
            fetchData();
        } catch (err) {
            console.error("Failed to renew AMC", err);
            alert("Failed to renew AMC");
        } finally {
            setSubmitting(false);
        }
    };

    // Installed Base Form Submit
    const handleEquipSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            if (editingEquip) {
                await apiPut(`/api/crm/installed-base/${editingEquip._id}`, equipForm, token);
            } else {
                await apiPost("/api/crm/installed-base", equipForm, token);
            }
            setIsEquipModalOpen(false);
            fetchData();
        } catch (err: any) {
            console.error("Equipment save error", err);
            alert(err.message || "Failed to save equipment record");
        } finally {
            setSubmitting(false);
        }
    };

    // Service Ticket Form Submit
    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                ...ticketForm,
                sparePartsRequired: ticketForm.sparePartsRequired.filter(p => p.partName.trim())
            };
            if (editingTicket) {
                await apiPut(`/api/crm/service-tickets/${editingTicket._id}`, payload, token);
            } else {
                await apiPost("/api/crm/service-tickets", payload, token);
            }
            setIsTicketModalOpen(false);
            fetchData();
        } catch (err: any) {
            console.error("Ticket save error", err);
            alert(err.message || "Failed to save ticket");
        } finally {
            setSubmitting(false);
        }
    };

    // Installation Form Submit
    const handleInstallSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                customerName: installForm.customerName,
                productName: installForm.productName,
                productDescription: installForm.productDescription,
                serialNumber: installForm.serialNumber,
                siteLocation: installForm.siteLocation,
                commissioningDate: installForm.commissioningDate,
                fieldEngineerName: installForm.fieldEngineerName,
                clientAttendants: installForm.clientAttendants.filter(a => a.name.trim()),
                checklist: installForm.checklist,
                trainingProvided: {
                    conducted: installForm.trainingConducted,
                    topicsCovered: installForm.trainingTopics,
                    traineesCount: Number(installForm.traineesCount)
                },
                media: {
                    photos: [],
                    videoUrls: installForm.videoUrls.filter(v => v.url.trim())
                },
                signOff: {
                    isSignedOff: installForm.isSignedOff,
                    signedByClientName: installForm.signOffName,
                    signedByClientDesignation: installForm.signOffDesignation,
                    signOffDate: installForm.isSignedOff ? new Date().toISOString() : undefined,
                    satisfactionRating: installForm.satisfactionRating,
                    remarks: installForm.signOffRemarks
                },
                status: installForm.isSignedOff ? "Completed & Signed Off" : "Scheduled"
            };

            if (editingInstall) {
                await apiPut(`/api/crm/installations/${editingInstall._id}`, payload, token);
            } else {
                await apiPost("/api/crm/installations", payload, token);
            }
            setIsInstallModalOpen(false);
            fetchData();
        } catch (err: any) {
            console.error("Installation save error", err);
            alert(err.message || "Failed to save installation report");
        } finally {
            setSubmitting(false);
        }
    };

    // Generate PDF Commissioning Report (Requirement #17)
    const generateCommissioningPDF = (inst: CRMInstallation) => {
        try {
            const doc = new jsPDF();

            // Header Background Banner
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, 210, 32, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("BINSERP ENTERPRISE COMMISSIONING & HANDOVER CERTIFICATE", 14, 15);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Official Machinery Handover Report • Certificate No: ${inst.installationNo}`, 14, 23);
            doc.text(`Issued Date: ${new Date().toLocaleDateString("en-GB")}`, 155, 23);

            // Customer & Equipment Details Box
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, 38, 182, 38, 2, 2, "FD");

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("EQUIPMENT & SITE DETAILS", 18, 45);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Client / Enterprise: ${inst.customerName}`, 18, 52);
            doc.text(`Machine / Product: ${inst.productName}`, 18, 58);
            if (inst.productDescription) {
                doc.text(`Description: ${inst.productDescription.slice(0, 60)}`, 18, 64);
            }
            doc.text(`Serial Number: ${inst.serialNumber}`, 18, 70);

            doc.text(`Commissioning Date: ${inst.commissioningDate ? new Date(inst.commissioningDate).toLocaleDateString("en-GB") : "-"}`, 115, 52);
            doc.text(`Site Location: ${inst.siteLocation || "Factory Floor"}`, 115, 58);
            doc.text(`Lead Field Engineer: ${inst.fieldEngineerName || "Senior Engineer"}`, 115, 64);
            doc.text(`Status: ${inst.status}`, 115, 70);

            // Commissioning Checklist Table
            const checklistRows = (inst.checklist || []).map((c, i) => [
                String(i + 1),
                c.item,
                c.status,
                c.remarks || "-"
            ]);

            autoTable(doc, {
                startY: 82,
                head: [["#", "Commissioning Inspection Checkpoint", "Status", "Technical Remarks"]],
                body: checklistRows.length > 0 ? checklistRows : [["1", "Machine installation & dry run test", "Passed", "Verified"]],
                headStyles: {
                    fillColor: [37, 99, 235],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 8
                },
                bodyStyles: {
                    fontSize: 7.5
                },
                columnStyles: {
                    0: { cellWidth: 10, halign: "center" },
                    1: { cellWidth: 95 },
                    2: { cellWidth: 25, halign: "center", fontStyle: "bold" },
                    3: { cellWidth: 52 }
                },
                didParseCell: (data) => {
                    if (data.section === "body" && data.column.index === 2) {
                        if (data.cell.raw === "Passed") {
                            data.cell.styles.textColor = [16, 185, 129];
                        } else if (data.cell.raw === "Failed") {
                            data.cell.styles.textColor = [239, 68, 68];
                        }
                    }
                }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 8;

            // Training Summary
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("OPERATOR & MAINTENANCE TRAINING CERTIFICATION", 14, finalY);

            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.text(
                `Training Conducted: ${inst.trainingProvided?.conducted ? "YES" : "NO"}  |  Certified Operators Handled: ${inst.trainingProvided?.traineesCount || 0} Persons`,
                14,
                finalY + 5
            );
            doc.text(
                `SOP Topics Covered: ${inst.trainingProvided?.topicsCovered || "Standard startup, emergency shut-off, and routine lubrication SOP."}`,
                14,
                finalY + 10
            );

            // Client Sign-off Box
            const signY = finalY + 18;
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(14, signY, 182, 35, 2, 2);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text("CLIENT COMMISSIONING SIGN-OFF & HANDOVER ACCEPTANCE", 18, signY + 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.text(`Signed By Representative: ${inst.signOff?.signedByClientName || "Client Plant Head"}`, 18, signY + 13);
            doc.text(`Designation: ${inst.signOff?.signedByClientDesignation || "General Manager - Operations"}`, 18, signY + 19);
            doc.text(`Satisfaction Rating: ${"★".repeat(inst.signOff?.satisfactionRating || 5)} (${inst.signOff?.satisfactionRating || 5}/5 Stars)`, 18, signY + 25);
            doc.text(`Client Remarks: "${inst.signOff?.remarks || "Equipment tested, verified and accepted."}"`, 18, signY + 31);

            doc.line(135, signY + 24, 185, signY + 24);
            doc.setFontSize(7);
            doc.text("Client Authorized Signatory & Seal", 137, signY + 29);

            // Footer
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text("Generated securely via Binserp CRM Field Operations & Quality Assurance Hub.", 14, 285);

            doc.save(`Commissioning_Report_${inst.installationNo}.pdf`);
        } catch (err) {
            console.error("PDF generation failed", err);
            alert("Failed to generate Commissioning Report PDF");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* 30 & 60-Day Warranty / AMC Expiry Alert Banner (Requirement #14) */}
            {metrics && (metrics.expiring30 > 0 || metrics.expiring60 > 0) && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-xs text-amber-950 dark:text-amber-200">
                                Warranty & AMC Contracts Due for Renewal
                            </h4>
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium mt-0.5">
                                <strong>{metrics.expiring30} contracts</strong> expiring in the next 30 days • <strong>{metrics.expiring60} contracts</strong> expiring in 60 days.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setActiveSection("installed");
                                setExpiryFilter("expiring_30");
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                        >
                            View Expiring in 30 Days ({metrics.expiring30})
                        </button>
                        <button
                            onClick={() => {
                                setActiveSection("installed");
                                setExpiryFilter("expiring_60");
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold hover:bg-amber-50 transition-colors"
                        >
                            View 60 Days ({metrics.expiring60})
                        </button>
                    </div>
                </div>
            )}

            {/* Top Control Bar with 3 Enterprise Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                {/* 3 Section Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
                    <button
                        onClick={() => setActiveSection("installed")}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                            activeSection === "installed"
                                ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <ShieldCheck size={15} />
                        <span>Equipment & Warranty ({installedItems.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveSection("installations")}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                            activeSection === "installations"
                                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <Award size={15} />
                        <span>Installation & Commissioning ({installations.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveSection("tickets")}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                            activeSection === "tickets"
                                ? "bg-white dark:bg-slate-800 text-rose-600 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <Wrench size={15} />
                        <span>Service & Technician Dispatch ({tickets.length})</span>
                    </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    <div className="relative flex-1 md:w-56">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search machinery, serial..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchData()}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                        />
                    </div>

                    <button
                        onClick={fetchData}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>

                    {activeSection === "installed" && (
                        <button
                            onClick={() => {
                                setEditingEquip(null);
                                setIsEquipModalOpen(true);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                        >
                            <Plus size={15} /> Register Machine
                        </button>
                    )}

                    {activeSection === "installations" && (
                        <button
                            onClick={() => {
                                setEditingInstall(null);
                                setIsInstallModalOpen(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                        >
                            <Plus size={15} /> New Commissioning
                        </button>
                    )}

                    {activeSection === "tickets" && (
                        <button
                            onClick={() => {
                                setEditingTicket(null);
                                setIsTicketModalOpen(true);
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5"
                        >
                            <Plus size={15} /> Raise Service Ticket
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: INSTALLED BASE & WARRANTY / AMC */}
            {activeSection === "installed" && (
                <div className="space-y-4">
                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-400 text-[11px] uppercase mr-1">Status:</span>
                        {["All", "Under Warranty", "AMC Active", "Out of Warranty"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setWarrantyFilter(s)}
                                className={`px-3 py-1 rounded-xl font-bold text-[11px] ${
                                    warrantyFilter === s
                                        ? "bg-blue-600 text-white shadow-xs"
                                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                }`}
                            >
                                {s}
                            </button>
                        ))}

                        <span className="font-bold text-slate-400 text-[11px] uppercase ml-3 mr-1">Expiry Filter:</span>
                        {[
                            { id: "All", label: "All Timeline" },
                            { id: "expiring_30", label: "⚠️ Expiring in 30 Days" },
                            { id: "expiring_60", label: "⏰ Expiring in 60 Days" },
                            { id: "expired", label: "❌ Expired" },
                        ].map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setExpiryFilter(p.id)}
                                className={`px-3 py-1 rounded-xl font-bold text-[11px] ${
                                    expiryFilter === p.id
                                        ? "bg-amber-600 text-white shadow-xs"
                                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="p-3.5">Customer & Site</th>
                                        <th className="p-3.5">Product & Technical Description</th>
                                        <th className="p-3.5">Serial / Batch No</th>
                                        <th className="p-3.5">Delivery Date</th>
                                        <th className="p-3.5">Warranty & Expiry</th>
                                        <th className="p-3.5">AMC Status & Value</th>
                                        <th className="p-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    {installedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-400">
                                                No machinery registered under this filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        installedItems.map((item) => {
                                            const wExp = item.warrantyExpiryDate ? new Date(item.warrantyExpiryDate) : null;
                                            const now = new Date();
                                            const isExpiringSoon = wExp && wExp >= now && wExp.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000;

                                            return (
                                                <tr key={item._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-3.5">
                                                        <strong className="text-slate-900 dark:text-white font-extrabold block text-xs">
                                                            {item.customerName}
                                                        </strong>
                                                        <span className="text-[10px] text-slate-400">{item.location || "Client Plant"}</span>
                                                    </td>
                                                    <td className="p-3.5 max-w-xs">
                                                        <strong className="text-slate-800 dark:text-slate-200 block text-xs">
                                                            {item.productName}
                                                        </strong>
                                                        {item.productDescription && (
                                                            <p className="text-[11px] text-slate-500 italic truncate mt-0.5">
                                                                {item.productDescription}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 font-mono text-xs">
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-bold">
                                                            {item.serialNumber}
                                                        </span>
                                                        {item.batchNumber && (
                                                            <span className="text-[10px] text-slate-400 block mt-0.5">Lot: {item.batchNumber}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                                                        {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString("en-GB") : "-"}
                                                    </td>
                                                    <td className="p-3.5 space-y-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${
                                                            item.warrantyStatus === "Under Warranty"
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : item.warrantyStatus === "AMC Active"
                                                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                                : "bg-slate-100 text-slate-600"
                                                        }`}>
                                                            {item.warrantyStatus}
                                                        </span>
                                                        {item.warrantyExpiryDate && (
                                                            <div className={`text-[10px] font-mono ${isExpiringSoon ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                                                                Exp: {new Date(item.warrantyExpiryDate).toLocaleDateString("en-GB")}
                                                                {isExpiringSoon && " ⚠️"}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5">
                                                        {item.amcValue ? (
                                                            <div>
                                                                <strong className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                                                    ₹{Number(item.amcValue).toLocaleString()}
                                                                </strong>
                                                                {item.amcEndDate && (
                                                                    <span className="text-[10px] text-slate-400 block font-mono">
                                                                        Till {new Date(item.amcEndDate).toLocaleDateString("en-GB")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => handleOpenRenewal(item)}
                                                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-colors"
                                                                title="Renew Warranty / AMC Contract"
                                                            >
                                                                Renew AMC
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingEquip(item);
                                                                    setEquipForm({
                                                                        customerName: item.customerName,
                                                                        productName: item.productName,
                                                                        productDescription: item.productDescription || "",
                                                                        serialNumber: item.serialNumber,
                                                                        batchNumber: item.batchNumber || "",
                                                                        deliveryDate: item.deliveryDate ? item.deliveryDate.slice(0, 10) : "",
                                                                        invoiceNumber: item.invoiceNumber || "",
                                                                        warrantyPeriodMonths: item.warrantyPeriodMonths || 12,
                                                                        warrantyExpiryDate: item.warrantyExpiryDate ? item.warrantyExpiryDate.slice(0, 10) : "",
                                                                        warrantyStatus: item.warrantyStatus,
                                                                        amcStartDate: item.amcStartDate ? item.amcStartDate.slice(0, 10) : "",
                                                                        amcEndDate: item.amcEndDate ? item.amcEndDate.slice(0, 10) : "",
                                                                        amcValue: item.amcValue || 0,
                                                                        location: item.location || "",
                                                                        notes: item.notes || ""
                                                                    });
                                                                    setIsEquipModalOpen(true);
                                                                }}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: INSTALLATION & COMMISSIONING (I&C) MODULE (Requirement #17) */}
            {activeSection === "installations" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {installations.map((inst) => (
                            <div
                                key={inst._id}
                                className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md transition-all space-y-3"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {inst.installationNo}
                                        </span>
                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1">
                                            {inst.productName}
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">{inst.customerName}</p>
                                    </div>

                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        inst.status === "Completed & Signed Off"
                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}>
                                        {inst.status}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-[10px]">Serial No:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{inst.serialNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-[10px]">Commissioned On:</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300">
                                            {inst.commissioningDate ? new Date(inst.commissioningDate).toLocaleDateString("en-GB") : "-"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-[10px]">Lead Engineer:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{inst.fieldEngineerName || "Field Engineer"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 text-[10px]">Checklist Items:</span>
                                        <span className="font-bold text-emerald-600">
                                            {(inst.checklist || []).filter(c => c.status === "Passed").length} / {(inst.checklist || []).length} Passed
                                        </span>
                                    </div>
                                </div>

                                {/* Video / Photos Indicator */}
                                {inst.media?.videoUrls && inst.media.videoUrls.length > 0 && (
                                    <div className="p-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900 flex items-center justify-between text-xs">
                                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                            <Video size={13} /> Training Videos Available ({inst.media.videoUrls.length})
                                        </span>
                                        <button
                                            onClick={() => setActiveVideoModal(inst)}
                                            className="text-[10px] font-extrabold text-indigo-600 hover:underline"
                                        >
                                            Watch
                                        </button>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <button
                                        onClick={() => generateCommissioningPDF(inst)}
                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <Download size={13} />
                                        <span>PDF Sign-Off Report</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setEditingInstall(inst);
                                            setInstallForm({
                                                customerName: inst.customerName,
                                                productName: inst.productName,
                                                productDescription: inst.productDescription || "",
                                                serialNumber: inst.serialNumber,
                                                siteLocation: inst.siteLocation || "",
                                                commissioningDate: inst.commissioningDate ? inst.commissioningDate.slice(0, 10) : "",
                                                fieldEngineerName: inst.fieldEngineerName || "",
                                                clientAttendants: inst.clientAttendants && inst.clientAttendants.length > 0 
                                                    ? inst.clientAttendants.map(a => ({ name: a.name, designation: a.designation || "", phone: a.phone || "", email: a.email || "" }))
                                                    : [{ name: "", designation: "", phone: "", email: "" }],
                                                checklist: inst.checklist && inst.checklist.length > 0 ? (inst.checklist as any) : [],
                                                trainingTopics: inst.trainingProvided?.topicsCovered || "",
                                                traineesCount: inst.trainingProvided?.traineesCount || 0,
                                                trainingConducted: inst.trainingProvided?.conducted ?? true,
                                                videoUrls: inst.media?.videoUrls && inst.media.videoUrls.length > 0 ? (inst.media.videoUrls as any) : [{ title: "Walkthrough", url: "", type: "YouTube" }],
                                                signOffName: inst.signOff?.signedByClientName || "",
                                                signOffDesignation: inst.signOff?.signedByClientDesignation || "",
                                                satisfactionRating: inst.signOff?.satisfactionRating || 5,
                                                signOffRemarks: inst.signOff?.remarks || "",
                                                isSignedOff: inst.signOff?.isSignedOff ?? false
                                            });
                                            setIsInstallModalOpen(true);
                                        }}
                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"
                                        title="Edit Commissioning Report"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: SERVICE & FIELD TECHNICIAN DISPATCH (Requirements #15 & #18) */}
            {activeSection === "tickets" && (
                <div className="space-y-4">
                    {/* Status Filter */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-400 text-[11px] uppercase mr-1">Ticket Stage:</span>
                        {["All", "Open", "Assigned", "In Progress", "Resolved", "Closed"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setTicketStatusFilter(s)}
                                className={`px-3 py-1 rounded-xl font-bold text-[11px] ${
                                    ticketStatusFilter === s
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="p-3.5">Ticket # & Customer</th>
                                        <th className="p-3.5">Equipment & Serial</th>
                                        <th className="p-3.5">Category & Priority</th>
                                        <th className="p-3.5">Issue Description</th>
                                        <th className="p-3.5">Assigned Technician & Slot</th>
                                        <th className="p-3.5">Status</th>
                                        <th className="p-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    {tickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-400">
                                                No service tickets found.
                                            </td>
                                        </tr>
                                    ) : (
                                        tickets.map((t) => (
                                            <tr key={t._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="p-3.5">
                                                    <span className="font-mono text-[10px] font-extrabold text-blue-600 dark:text-blue-400 block">
                                                        {t.ticketNo}
                                                    </span>
                                                    <strong className="text-slate-900 dark:text-white font-extrabold block text-xs">
                                                        {t.customerName}
                                                    </strong>
                                                </td>
                                                <td className="p-3.5">
                                                    <strong className="text-slate-800 dark:text-slate-200 block text-xs">{t.productName || "General Equipment"}</strong>
                                                    {t.serialNumber && <span className="font-mono text-[10px] text-slate-400">SN: {t.serialNumber}</span>}
                                                </td>
                                                <td className="p-3.5 space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">{t.category}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold inline-block ${
                                                        t.priority === "Urgent" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                                        t.priority === "High" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                        "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {t.priority} Priority
                                                    </span>
                                                </td>
                                                <td className="p-3.5 max-w-xs">
                                                    <p className="text-slate-700 dark:text-slate-300 line-clamp-2 text-xs italic">
                                                        "{t.issueDescription}"
                                                    </p>
                                                    {t.sparePartsRequired && t.sparePartsRequired.length > 0 && (
                                                        <span className="text-[10px] font-bold text-indigo-600 mt-0.5 block">
                                                            Parts Needed: {t.sparePartsRequired.map(p => p.partName).join(", ")}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3.5">
                                                    <strong className="text-slate-800 dark:text-slate-200 block text-xs">
                                                        {t.technicianName || "Unassigned"}
                                                    </strong>
                                                    {t.scheduledVisitDate && (
                                                        <span className="text-[10px] text-slate-400 block font-mono">
                                                            {new Date(t.scheduledVisitDate).toLocaleDateString("en-GB")} • {t.timeSlot || "Day Shift"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                                        t.status === "Resolved" || t.status === "Closed"
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : t.status === "In Progress"
                                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                            : "bg-amber-50 text-amber-700 border border-amber-200"
                                                    }`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setEditingTicket(t);
                                                            setTicketForm({
                                                                customerName: t.customerName,
                                                                productName: t.productName || "",
                                                                serialNumber: t.serialNumber || "",
                                                                category: t.category,
                                                                priority: t.priority,
                                                                status: t.status,
                                                                issueDescription: t.issueDescription,
                                                                technicianName: t.technicianName || "",
                                                                scheduledVisitDate: t.scheduledVisitDate ? t.scheduledVisitDate.slice(0, 10) : "",
                                                                timeSlot: t.timeSlot || "10:00 AM - 01:00 PM",
                                                                sparePartsRequired: t.sparePartsRequired && t.sparePartsRequired.length > 0 
                                                                    ? t.sparePartsRequired.map(p => ({ partName: p.partName, partNumber: p.partNumber || "", quantity: p.quantity, isReplaced: p.isReplaced || false }))
                                                                    : [{ partName: "", partNumber: "", quantity: 1, isReplaced: false }],
                                                                resolutionNotes: t.resolutionNotes || "",
                                                                chargeable: t.chargeable || false,
                                                                serviceCost: t.serviceCost || 0
                                                            });
                                                            setIsTicketModalOpen(true);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold"
                                                    >
                                                        Dispatch / Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: REGISTER / EDIT EQUIPMENT */}
            {isEquipModalOpen && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <h3 className="font-extrabold text-base">
                                {editingEquip ? "Edit Installed Machinery" : "Register Sold Equipment"}
                            </h3>
                            <button onClick={() => setIsEquipModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleEquipSubmit} className="p-5 space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Enterprise *</label>
                                <input
                                    type="text"
                                    required
                                    value={equipForm.customerName}
                                    onChange={(e) => setEquipForm({ ...equipForm, customerName: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Product Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={equipForm.productName}
                                        onChange={(e) => setEquipForm({ ...equipForm, productName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Serial Number *</label>
                                    <input
                                        type="text"
                                        required
                                        value={equipForm.serialNumber}
                                        onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Technical Description</label>
                                <input
                                    type="text"
                                    value={equipForm.productDescription}
                                    onChange={(e) => setEquipForm({ ...equipForm, productDescription: e.target.value })}
                                    placeholder="Technical spec, model variant, motor rating..."
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={equipForm.deliveryDate}
                                        onChange={(e) => setEquipForm({ ...equipForm, deliveryDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Warranty (Months)</label>
                                    <input
                                        type="number"
                                        value={equipForm.warrantyPeriodMonths}
                                        onChange={(e) => setEquipForm({ ...equipForm, warrantyPeriodMonths: Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsEquipModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md shadow-blue-600/20">
                                    {submitting ? "Saving..." : "Save Equipment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: AMC RENEWAL MODAL (Requirement #14) */}
            {isRenewalModalOpen && renewalItem && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base">Renew AMC / Warranty Contract</h3>
                                <p className="text-xs text-amber-100">{renewalItem.productName} • SN: {renewalItem.serialNumber}</p>
                            </div>
                            <button onClick={() => setIsRenewalModalOpen(false)} className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRenewal} className="p-5 space-y-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">AMC Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={renewalStartDate}
                                        onChange={(e) => setRenewalStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">AMC End Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={renewalEndDate}
                                        onChange={(e) => setRenewalEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Revised AMC Contract Value (INR)</label>
                                <input
                                    type="number"
                                    required
                                    value={renewalValue}
                                    onChange={(e) => setRenewalValue(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsRenewalModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20">
                                    {submitting ? "Updating..." : "Confirm AMC Renewal"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: COMMISSIONING & INSTALLATION REPORT (Requirement #17) */}
            {isInstallModalOpen && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-base">
                                    {editingInstall ? "Edit Commissioning Report" : "New Installation & Commissioning (I&C)"}
                                </h3>
                                <p className="text-xs text-indigo-200">Checklist, Attendants, Training & Sign-Off Certificate</p>
                            </div>
                            <button onClick={() => setIsInstallModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleInstallSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
                            {/* Equipment & Client Site */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Enterprise *</label>
                                    <input
                                        type="text"
                                        required
                                        value={installForm.customerName}
                                        onChange={(e) => setInstallForm({ ...installForm, customerName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Machine / Equipment Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={installForm.productName}
                                        onChange={(e) => setInstallForm({ ...installForm, productName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Serial Number *</label>
                                    <input
                                        type="text"
                                        required
                                        value={installForm.serialNumber}
                                        onChange={(e) => setInstallForm({ ...installForm, serialNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Commissioning Date</label>
                                    <input
                                        type="date"
                                        value={installForm.commissioningDate}
                                        onChange={(e) => setInstallForm({ ...installForm, commissioningDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Lead Field Engineer</label>
                                    <input
                                        type="text"
                                        value={installForm.fieldEngineerName}
                                        onChange={(e) => setInstallForm({ ...installForm, fieldEngineerName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                            </div>

                            {/* Attendants */}
                            <div className="space-y-2">
                                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                                    Client Engineers / Attendants Present
                                </label>
                                {installForm.clientAttendants.map((att, idx) => (
                                    <div key={idx} className="grid grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Engineer Name"
                                            value={att.name}
                                            onChange={(e) => {
                                                const next = [...installForm.clientAttendants];
                                                next[idx].name = e.target.value;
                                                setInstallForm({ ...installForm, clientAttendants: next });
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Designation"
                                            value={att.designation}
                                            onChange={(e) => {
                                                const next = [...installForm.clientAttendants];
                                                next[idx].designation = e.target.value;
                                                setInstallForm({ ...installForm, clientAttendants: next });
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Contact Phone"
                                            value={att.phone}
                                            onChange={(e) => {
                                                const next = [...installForm.clientAttendants];
                                                next[idx].phone = e.target.value;
                                                setInstallForm({ ...installForm, clientAttendants: next });
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Checklist Items */}
                            <div className="space-y-2">
                                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                                    Commissioning Inspection Checklist ({installForm.checklist.length} Checkpoints)
                                </label>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {installForm.checklist.map((chk, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex-1">
                                                {chk.item}
                                            </span>
                                            <select
                                                value={chk.status}
                                                onChange={(e) => {
                                                    const next = [...installForm.checklist];
                                                    next[idx].status = e.target.value as any;
                                                    setInstallForm({ ...installForm, checklist: next });
                                                }}
                                                className={`px-2.5 py-1 rounded-lg font-bold text-xs outline-none ${
                                                    chk.status === "Passed" ? "bg-emerald-100 text-emerald-800" :
                                                    chk.status === "Failed" ? "bg-rose-100 text-rose-800" :
                                                    "bg-slate-200 text-slate-700"
                                                }`}
                                            >
                                                <option value="Passed">Passed</option>
                                                <option value="Failed">Failed</option>
                                                <option value="Pending">Pending</option>
                                                <option value="N/A">N/A</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Training Video Links */}
                            <div className="space-y-2">
                                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                                    Commissioning & Training Video Links (Cloud / YouTube / Drive)
                                </label>
                                {installForm.videoUrls.map((vid, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Video Title"
                                            value={vid.title}
                                            onChange={(e) => {
                                                const next = [...installForm.videoUrls];
                                                next[idx].title = e.target.value;
                                                setInstallForm({ ...installForm, videoUrls: next });
                                            }}
                                            className="col-span-4 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                        />
                                        <input
                                            type="url"
                                            placeholder="https://youtube.com/... or Google Drive URL"
                                            value={vid.url}
                                            onChange={(e) => {
                                                const next = [...installForm.videoUrls];
                                                next[idx].url = e.target.value;
                                                setInstallForm({ ...installForm, videoUrls: next });
                                            }}
                                            className="col-span-8 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Client Sign-off */}
                            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <strong className="font-extrabold text-xs text-emerald-900 dark:text-emerald-300 uppercase">
                                        Client Sign-Off & Handover
                                    </strong>
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-emerald-800">
                                        <input
                                            type="checkbox"
                                            checked={installForm.isSignedOff}
                                            onChange={(e) => setInstallForm({ ...installForm, isSignedOff: e.target.checked })}
                                            className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                                        />
                                        Certified & Signed Off
                                    </label>
                                </div>

                                {installForm.isSignedOff && (
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <input
                                            type="text"
                                            placeholder="Signed By Client Representative"
                                            value={installForm.signOffName}
                                            onChange={(e) => setInstallForm({ ...installForm, signOffName: e.target.value })}
                                            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Designation"
                                            value={installForm.signOffDesignation}
                                            onChange={(e) => setInstallForm({ ...installForm, signOffDesignation: e.target.value })}
                                            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsInstallModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20">
                                    {submitting ? "Saving..." : "Save Commissioning Report"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: SERVICE TICKET & TECHNICIAN DISPATCH (Requirement #18) */}
            {isTicketModalOpen && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-5 bg-rose-950 text-white flex justify-between items-center border-b border-rose-900">
                            <div>
                                <h3 className="font-extrabold text-base">Field Technician Dispatch & Ticket</h3>
                                <p className="text-xs text-rose-200">Task assignment, schedule slot & spare parts</p>
                            </div>
                            <button onClick={() => setIsTicketModalOpen(false)} className="w-8 h-8 rounded-full bg-rose-900 flex items-center justify-center text-rose-200">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleTicketSubmit} className="p-5 space-y-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={ticketForm.customerName}
                                        onChange={(e) => setTicketForm({ ...ticketForm, customerName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Equipment Name</label>
                                    <input
                                        type="text"
                                        value={ticketForm.productName}
                                        onChange={(e) => setTicketForm({ ...ticketForm, productName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assign Technician</label>
                                    <input
                                        type="text"
                                        placeholder="Engineer Name"
                                        value={ticketForm.technicianName}
                                        onChange={(e) => setTicketForm({ ...ticketForm, technicianName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Scheduled Date</label>
                                    <input
                                        type="date"
                                        value={ticketForm.scheduledVisitDate}
                                        onChange={(e) => setTicketForm({ ...ticketForm, scheduledVisitDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Time Slot</label>
                                    <select
                                        value={ticketForm.timeSlot}
                                        onChange={(e) => setTicketForm({ ...ticketForm, timeSlot: e.target.value })}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    >
                                        <option value="10:00 AM - 01:00 PM">Morning (10am-1pm)</option>
                                        <option value="02:00 PM - 05:00 PM">Afternoon (2pm-5pm)</option>
                                        <option value="Emergency Visit">🚨 Emergency Visit</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Description *</label>
                                <textarea
                                    rows={3}
                                    required
                                    value={ticketForm.issueDescription}
                                    onChange={(e) => setTicketForm({ ...ticketForm, issueDescription: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                                    <select
                                        value={ticketForm.priority}
                                        onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent Breakdown</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={ticketForm.status}
                                        onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Open">Open</option>
                                        <option value="Assigned">Assigned</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsTicketModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20">
                                    {submitting ? "Saving..." : "Dispatch / Save Ticket"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIDEO MODAL DRAWER */}
            {activeVideoModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base">Commissioning Training Videos</h3>
                                <p className="text-xs text-slate-400">{activeVideoModal.productName} • {activeVideoModal.installationNo}</p>
                            </div>
                            <button onClick={() => setActiveVideoModal(null)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            {activeVideoModal.media?.videoUrls?.map((vid, i) => (
                                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Video size={16} className="text-indigo-600" />
                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{vid.title || `Video Walkthrough #${i + 1}`}</span>
                                    </div>
                                    <a
                                        href={vid.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs"
                                    >
                                        <span>Open Video Link</span> <ExternalLink size={12} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
