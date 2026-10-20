"use client";

import React, { useState } from "react";
import { 
    X, MapPin, Navigation, Calendar, Clock, DollarSign, 
    Upload, Image as ImageIcon, Paperclip, CheckCircle2, AlertCircle, 
    Trash2, Send, RefreshCw, Car, Plane, Train, Bike, Bus, Compass
} from "lucide-react";
import { apiRequest } from "@/src/lib/api";
import { API_BASE_URL } from "@/src/utils/config";

export interface TravelLogItem {
    _id?: string;
    visitDate: string;
    visitorName: string;
    purpose: string;
    location?: string;
    distanceKm: number;
    travelMode: "Flight" | "Train" | "Cab" | "Car" | "Bike" | "Bus" | "Other";
    expense: number;
    minutesOfMeeting?: string;
    outcome: "Positive" | "Follow-up Needed" | "PO Expected" | "Closure" | "No Outcome";
    nextVisitDate?: string;
    photos?: string[];
    attachments?: Array<{ name: string; url: string }>;
    createdAt?: string;
}

interface CustomerTravelModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: {
        _id: string;
        name: string;
        customerCode?: string;
        contactPerson?: string;
        address?: { city?: string; state?: string; street?: string };
        travelHistory?: TravelLogItem[];
    };
    onCustomerUpdated: (updatedCustomer: any) => void;
}

const TRAVEL_MODES: Array<{ id: TravelLogItem["travelMode"]; label: string; icon: any }> = [
    { id: "Car", label: "Company / Personal Car", icon: Car },
    { id: "Bike", label: "Two Wheeler", icon: Bike },
    { id: "Train", label: "Railways", icon: Train },
    { id: "Flight", label: "Flight", icon: Plane },
    { id: "Cab", label: "Cab / Taxi", icon: Car },
    { id: "Bus", label: "Bus", icon: Bus },
    { id: "Other", label: "Other Mode", icon: Compass },
];

export default function CustomerTravelModal({
    isOpen,
    onClose,
    customer,
    onCustomerUpdated
}: CustomerTravelModalProps) {
    const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
    const [visitorName, setVisitorName] = useState("");
    const [purpose, setPurpose] = useState("Sales Presentation & Requirement Gathering");
    const [location, setLocation] = useState(customer.address?.city || "");
    const [distanceKm, setDistanceKm] = useState(25);
    const [travelMode, setTravelMode] = useState<TravelLogItem["travelMode"]>("Car");
    const [expense, setExpense] = useState(0);
    const [outcome, setOutcome] = useState<TravelLogItem["outcome"]>("Positive");
    const [minutesOfMeeting, setMinutesOfMeeting] = useState("");
    const [nextVisitDate, setNextVisitDate] = useState("");

    // Photos & Files
    const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);
        const newPhotos = [...selectedPhotos, ...filesArray].slice(0, 5);
        setSelectedPhotos(newPhotos);
        setPhotoPreviews(newPhotos.map((f) => URL.createObjectURL(f)));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);
        setSelectedFiles([...selectedFiles, ...filesArray].slice(0, 5));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!purpose.trim()) {
            setErrorMsg("Please specify the purpose of this customer visit.");
            return;
        }

        try {
            setSubmitting(true);
            setErrorMsg(null);

            const formData = new FormData();
            formData.append("visitDate", visitDate);
            if (visitorName) formData.append("visitorName", visitorName);
            formData.append("purpose", purpose);
            formData.append("location", location);
            formData.append("distanceKm", String(distanceKm));
            formData.append("travelMode", travelMode);
            formData.append("expense", String(expense));
            formData.append("outcome", outcome);
            if (minutesOfMeeting) formData.append("minutesOfMeeting", minutesOfMeeting);
            if (nextVisitDate) formData.append("nextVisitDate", nextVisitDate);

            selectedPhotos.forEach((photo) => formData.append("photos", photo));
            selectedFiles.forEach((file) => formData.append("files", file));

            const token = localStorage.getItem("token");
            const response = await apiRequest(`/api/crm/customers/${customer._id}/travel-logs`, {
                method: "POST",
                token,
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || "Failed to log customer visit");
            }

            const updatedHistory = result.data?.travelHistory || [];
            onCustomerUpdated({
                ...customer,
                travelHistory: updatedHistory
            });

            // Reset form
            setMinutesOfMeeting("");
            setExpense(0);
            setSelectedPhotos([]);
            setPhotoPreviews([]);
            setSelectedFiles([]);
        } catch (err: any) {
            console.error("Save travel error:", err);
            setErrorMsg(err.message || "Failed to log visit");
        } finally {
            setSubmitting(false);
        }
    };

    const travelHistory = customer.travelHistory || [];
    const totalKm = travelHistory.reduce((acc, t) => acc + (Number(t.distanceKm) || 0), 0);
    const totalExpense = travelHistory.reduce((acc, t) => acc + (Number(t.expense) || 0), 0);

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                                Customer Travel & Visit History
                            </span>
                            <span className="text-xs text-slate-400">On-site Audits & Field Logs</span>
                        </div>
                        <h3 className="font-extrabold text-base mt-1">
                            {customer.name}
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5 font-medium">
                            {customer.contactPerson || "Client Representative"} • {customer.address?.city || "Site Location"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-4 gap-2.5 p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Visits Logged</span>
                        <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{travelHistory.length} Visits</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase">Total Distance</span>
                        <div className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{totalKm.toLocaleString()} KM</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase">Travel Expense</span>
                        <div className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">₹{totalExpense.toLocaleString()}</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-amber-500 uppercase">Latest Outcome</span>
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">
                            {travelHistory[0]?.outcome || "N/A"}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
                    
                    {/* Log New Visit Form */}
                    <div className="lg:col-span-5 p-5 border-r border-slate-200 dark:border-slate-800 overflow-y-auto space-y-4">
                        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                            <h4 className="font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Log Customer Visit
                            </h4>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Visit Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={visitDate}
                                        onChange={(e) => setVisitDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Visitor / Executive</label>
                                    <input
                                        type="text"
                                        placeholder="Executive Name"
                                        value={visitorName}
                                        onChange={(e) => setVisitorName(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Purpose of Visit *</label>
                                <select
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                >
                                    <option value="Sales Presentation & Requirement Gathering">Sales Presentation & Requirement Gathering</option>
                                    <option value="Technical Site Audit / Plant Inspection">Technical Site Audit / Plant Inspection</option>
                                    <option value="Commercial Negotiation & Price Finalization">Commercial Negotiation & Price Finalization</option>
                                    <option value="Installation & Commissioning Follow-up">Installation & Commissioning Follow-up</option>
                                    <option value="Payment Recovery & Accounts Settlement">Payment Recovery & Accounts Settlement</option>
                                    <option value="Routine Relationship & Feedback">Routine Relationship & Feedback</option>
                                    <option value="Other Field Visit">Other Field Visit</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Site Location</label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Distance (KM)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={distanceKm}
                                        onChange={(e) => setDistanceKm(Number(e.target.value))}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expense (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expense}
                                        onChange={(e) => setExpense(Number(e.target.value))}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Travel Mode</label>
                                    <select
                                        value={travelMode}
                                        onChange={(e) => setTravelMode(e.target.value as any)}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    >
                                        {TRAVEL_MODES.map(m => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Visit Outcome</label>
                                    <select
                                        value={outcome}
                                        onChange={(e) => setOutcome(e.target.value as any)}
                                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Positive">✅ Positive Discussion</option>
                                        <option value="PO Expected">🎯 PO Expected</option>
                                        <option value="Follow-up Needed">⏳ Follow-up Needed</option>
                                        <option value="Closure">🏆 Deal Closed</option>
                                        <option value="No Outcome">❌ No Immediate Outcome</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Minutes of Meeting (MOM)</label>
                                <textarea
                                    rows={3}
                                    value={minutesOfMeeting}
                                    onChange={(e) => setMinutesOfMeeting(e.target.value)}
                                    placeholder="Discussion summary, client requirements observed, commitments made..."
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none resize-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Next Planned Visit Date</label>
                                <input
                                    type="date"
                                    value={nextVisitDate}
                                    onChange={(e) => setNextVisitDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                />
                            </div>

                            {/* Photos */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <ImageIcon size={13} className="text-emerald-500" />
                                        Site Photos / Proof ({selectedPhotos.length}/5)
                                    </label>
                                    <label className="text-[11px] text-blue-600 font-bold cursor-pointer">
                                        Upload
                                        <input type="file" multiple accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                    </label>
                                </div>
                                {photoPreviews.length > 0 && (
                                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                                        {photoPreviews.map((p, i) => (
                                            <img key={i} src={p} alt="Site" className="w-full h-14 object-cover rounded-lg border border-slate-200" />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {errorMsg && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                            >
                                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Navigation size={14} />}
                                <span>{submitting ? "Logging Visit..." : "Save Travel & Visit Log"}</span>
                            </button>
                        </form>
                    </div>

                    {/* Visit History Timeline */}
                    <div className="lg:col-span-7 p-5 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-900/40">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-200 dark:border-slate-800">
                            Visit Timeline & Records ({travelHistory.length})
                        </h4>

                        {travelHistory.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Navigation size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-semibold">No customer site visits logged yet.</p>
                                <p className="text-[11px] mt-0.5">Use the form to log distance traveled, visit purpose, and minutes of meeting.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 text-xs">
                                {travelHistory.map((entry, idx) => (
                                    <div key={entry._id || idx} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                        entry.outcome === "PO Expected" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                        entry.outcome === "Closure" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                                        "bg-blue-50 text-blue-700 border border-blue-200"
                                                    }`}>
                                                        {entry.outcome}
                                                    </span>
                                                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                                        {entry.purpose}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Visited by <strong>{entry.visitorName}</strong> • {new Date(entry.visitDate).toLocaleDateString("en-GB")}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                                                    {entry.distanceKm} KM ({entry.travelMode})
                                                </div>
                                                {entry.expense > 0 && (
                                                    <div className="font-mono text-[10px] text-slate-500">₹{entry.expense.toLocaleString()} claimed</div>
                                                )}
                                            </div>
                                        </div>

                                        {entry.minutesOfMeeting && (
                                            <p className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                                                {entry.minutesOfMeeting}
                                            </p>
                                        )}

                                        {entry.nextVisitDate && (
                                            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                                                <Calendar size={11} className="text-amber-500" />
                                                <span>Next Planned Visit: {new Date(entry.nextVisitDate).toLocaleDateString("en-GB")}</span>
                                            </div>
                                        )}

                                        {entry.photos && entry.photos.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {entry.photos.map((photo, pIdx) => {
                                                    const fullPhoto = photo.startsWith("http") ? photo : `${API_BASE_URL}${photo}`;
                                                    return (
                                                        <a key={pIdx} href={fullPhoto} target="_blank" rel="noopener noreferrer">
                                                            <img src={fullPhoto} alt="Visit proof" className="w-14 h-14 object-cover rounded-xl border border-slate-200" />
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
