"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
    X, Phone, MessageSquare, Users, Mail, FileText, MapPin, 
    Calendar, Clock, Mic, MicOff, Play, Pause, Trash2, Upload, 
    Image as ImageIcon, Paperclip, CheckCircle2, AlertCircle, 
    ChevronRight, ArrowRight, Eye, Download, Send, RefreshCw, 
    Sparkles, Volume2
} from "lucide-react";
import { apiRequest } from "@/src/lib/api";
import { API_BASE_URL } from "@/src/utils/config";

export interface FollowUpItem {
    _id?: string;
    type: "Call" | "WhatsApp" | "Meeting" | "Email" | "Note" | "Site Visit" | "Demo";
    text: string;
    voiceUrl?: string;
    voiceDuration?: number;
    photos?: string[];
    attachments?: Array<{
        name: string;
        url: string;
        size?: number;
        mimeType?: string;
    }>;
    nextFollowUpDate?: string;
    stageChange?: {
        fromStage: string;
        toStage: string;
    };
    createdByName?: string;
    createdAt?: string;
}

interface LeadFollowUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: any;
    onFollowUpAdded: (updatedLead: any) => void;
    masterStages?: Array<{ id: string; label: string; color: string }>;
}

const INTERACTION_TYPES: Array<{
    id: FollowUpItem["type"];
    label: string;
    icon: any;
    color: string;
    bg: string;
}> = [
    { id: "Call", label: "Phone Call", icon: Phone, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800" },
    { id: "WhatsApp", label: "WhatsApp", icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
    { id: "Meeting", label: "Meeting", icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800" },
    { id: "Email", label: "Email", icon: Mail, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
    { id: "Note", label: "Quick Note", icon: FileText, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
    { id: "Site Visit", label: "Site Visit", icon: MapPin, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800" },
];

export default function LeadFollowUpModal({
    isOpen,
    onClose,
    lead,
    onFollowUpAdded,
    masterStages = []
}: LeadFollowUpModalProps) {
    // Form Inputs
    const [type, setType] = useState<FollowUpItem["type"]>("Call");
    const [text, setText] = useState("");
    const [nextFollowUpDate, setNextFollowUpDate] = useState("");
    const [newStage, setNewStage] = useState("");

    // Audio Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [audioDurationSec, setAudioDurationSec] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<any>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Photos & Files State
    const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // Lightbox Modal for Photo Preview
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Audio Player State for Timeline Items
    const [playingTimelineAudio, setPlayingTimelineAudio] = useState<string | null>(null);
    const timelineAudioRef = useRef<HTMLAudioElement | null>(null);

    // Submitting State
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Follow-ups list from lead
    const followUps: FollowUpItem[] = lead?.followUps || [];

    // Initialize or Reset
    useEffect(() => {
        if (isOpen && lead) {
            setType("Call");
            setText("");
            setNextFollowUpDate("");
            setNewStage(lead.status || "New");
            setSelectedPhotos([]);
            setPhotoPreviews([]);
            setSelectedFiles([]);
            setAudioBlob(null);
            setAudioPreviewUrl(null);
            setIsRecording(false);
            setRecordingTime(0);
            setErrorMsg(null);
        }
    }, [isOpen, lead]);

    // Format file sizes
    const formatBytes = (bytes = 0) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    // Format Relative Time
    const getRelativeTime = (dateStr?: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    // Format Next Follow-Up Date with status color
    const formatNextDateInfo = (dateStr?: string) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const now = new Date();
        const isPast = target.getTime() < now.getTime();

        const formatted = target.toLocaleString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        return {
            text: formatted,
            isPast,
            label: isPast ? "⚠️ Overdue" : "⏰ Scheduled"
        };
    };

    // --- Voice Recording Functions ---
    const startRecording = async () => {
        try {
            setErrorMsg(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioPreviewUrl(url);
                setAudioDurationSec(recordingTime);

                // Stop tracks
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start(200); // 200ms slice
            setIsRecording(true);
            setRecordingTime(0);

            timerIntervalRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            console.error("Microphone access error:", err);
            setErrorMsg("Could not access microphone. Please ensure microphone permissions are granted in your browser.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    };

    const deleteVoiceRecording = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
        }
        setAudioBlob(null);
        setAudioPreviewUrl(null);
        setRecordingTime(0);
        setIsPlayingPreview(false);
    };

    const togglePlayPreview = () => {
        if (!audioPreviewUrl) return;
        if (!previewAudioRef.current) {
            previewAudioRef.current = new Audio(audioPreviewUrl);
            previewAudioRef.current.onended = () => setIsPlayingPreview(false);
        }

        if (isPlayingPreview) {
            previewAudioRef.current.pause();
            setIsPlayingPreview(false);
        } else {
            previewAudioRef.current.play();
            setIsPlayingPreview(true);
        }
    };

    // Play timeline audio
    const toggleTimelineAudio = (url: string) => {
        const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
        if (playingTimelineAudio === url) {
            if (timelineAudioRef.current) {
                timelineAudioRef.current.pause();
            }
            setPlayingTimelineAudio(null);
        } else {
            if (timelineAudioRef.current) {
                timelineAudioRef.current.pause();
            }
            const audio = new Audio(fullUrl);
            timelineAudioRef.current = audio;
            audio.onended = () => setPlayingTimelineAudio(null);
            audio.play();
            setPlayingTimelineAudio(url);
        }
    };

    // Handle Photo Selections
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);
        const newPhotos = [...selectedPhotos, ...filesArray].slice(0, 5); // max 5
        setSelectedPhotos(newPhotos);

        const newPreviews = newPhotos.map((file) => URL.createObjectURL(file));
        setPhotoPreviews(newPreviews);
    };

    const removePhoto = (index: number) => {
        const updatedPhotos = selectedPhotos.filter((_, i) => i !== index);
        setSelectedPhotos(updatedPhotos);
        const updatedPreviews = photoPreviews.filter((_, i) => i !== index);
        setPhotoPreviews(updatedPreviews);
    };

    // Handle Document Selections
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);
        const newFiles = [...selectedFiles, ...filesArray].slice(0, 5); // max 5
        setSelectedFiles(newFiles);
    };

    const removeFile = (index: number) => {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    // Quick Date Scheduling Presets
    const applyDatePreset = (preset: "2h" | "tomorrow10" | "tomorrow3" | "in3days" | "nextweek") => {
        const now = new Date();
        let target = new Date();

        if (preset === "2h") {
            target = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        } else if (preset === "tomorrow10") {
            target.setDate(target.getDate() + 1);
            target.setHours(10, 0, 0, 0);
        } else if (preset === "tomorrow3") {
            target.setDate(target.getDate() + 1);
            target.setHours(15, 0, 0, 0);
        } else if (preset === "in3days") {
            target.setDate(target.getDate() + 3);
            target.setHours(11, 0, 0, 0);
        } else if (preset === "nextweek") {
            const day = target.getDay();
            const daysUntilNextMon = ((8 - day) % 7) || 7;
            target.setDate(target.getDate() + daysUntilNextMon);
            target.setHours(10, 0, 0, 0);
        }

        // Format to YYYY-MM-DDTHH:mm for datetime-local
        const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        setNextFollowUpDate(localIso);
    };

    // Handle Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) {
            setErrorMsg("Please write a summary note or discussion details for this follow-up.");
            return;
        }

        try {
            setSubmitting(true);
            setErrorMsg(null);

            const formData = new FormData();
            formData.append("type", type);
            formData.append("text", text.trim());
            if (nextFollowUpDate) {
                formData.append("nextFollowUpDate", new Date(nextFollowUpDate).toISOString());
            }
            if (newStage && newStage !== lead.status) {
                formData.append("newStage", newStage);
            }
            if (audioDurationSec) {
                formData.append("voiceDuration", String(audioDurationSec));
            }

            // Append Voice
            if (audioBlob) {
                formData.append("voice", audioBlob, `voice-${Date.now()}.webm`);
            }

            // Append Photos
            selectedPhotos.forEach((photo) => {
                formData.append("photos", photo);
            });

            // Append Documents
            selectedFiles.forEach((file) => {
                formData.append("files", file);
            });

            const token = localStorage.getItem("token");
            const response = await apiRequest(`/api/crm/leads/${lead._id}/follow-ups`, {
                method: "POST",
                token,
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || "Failed to save follow-up");
            }

            onFollowUpAdded(result.data);
            onClose();
        } catch (err: any) {
            console.error("Follow-up save error:", err);
            setErrorMsg(err.message || "An error occurred while saving the follow-up note.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !lead) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* 1. Header with Lead Overview */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-blue-500/20">
                            {lead.name ? lead.name.charAt(0).toUpperCase() : "L"}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    {lead.name}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    lead.warmth === "Hot" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" :
                                    lead.warmth === "Warm" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" :
                                    "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                }`}>
                                    {lead.warmth === "Hot" ? "🔥 Hot" : lead.warmth === "Warm" ? "☀️ Warm" : "❄️ Cold"}
                                </span>
                                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                                    Stage: {lead.status || "New"}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                                {lead.companyName && <span className="font-semibold">{lead.companyName}</span>}
                                {lead.phone && (
                                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline font-mono">
                                        <Phone size={11} /> {lead.phone}
                                    </a>
                                )}
                                {lead.city && (
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <MapPin size={11} /> {lead.city}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 2. Main Body: Split into Form (Left/Top) & History Timeline (Right/Bottom) */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
                    
                    {/* LEFT COLUMN: Add New Follow-Up Note Composer (7 cols) */}
                    <div className="lg:col-span-7 p-4 sm:p-6 space-y-5 overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <Sparkles size={16} className="text-blue-600" />
                                Record Follow-Up Note & Interaction
                            </h4>
                            <span className="text-[10px] text-slate-400 font-semibold">
                                Multi-modal Note & Reminder
                            </span>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            {/* A. Channel Type Selector */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Interaction Channel
                                </label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                    {INTERACTION_TYPES.map((t) => {
                                        const Icon = t.icon;
                                        const isSelected = type === t.id;
                                        return (
                                            <button
                                                type="button"
                                                key={t.id}
                                                onClick={() => setType(t.id)}
                                                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all border ${
                                                    isSelected
                                                        ? `${t.bg} ${t.color} ring-2 ring-blue-500/20 shadow-xs scale-[1.02]`
                                                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                                                }`}
                                            >
                                                <Icon size={16} />
                                                <span className="text-[10px] truncate max-w-full">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* B. Note Text Input */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Discussion Summary & Notes <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Enter conversation highlights, customer questions, pricing discussed, or next requirements..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                />
                            </div>

                            {/* C. In-Browser Voice Recording Widget */}
                            <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Volume2 size={14} className="text-indigo-600" />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            Voice Note Recording
                                        </span>
                                    </div>
                                    {isRecording && (
                                        <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-600 animate-pulse">
                                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                                            {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {!isRecording && !audioBlob && (
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                        >
                                            <Mic size={14} />
                                            <span>Record Voice Note</span>
                                        </button>
                                    )}

                                    {isRecording && (
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs animate-pulse"
                                        >
                                            <MicOff size={14} />
                                            <span>Stop & Save Voice Note</span>
                                        </button>
                                    )}

                                    {audioBlob && audioPreviewUrl && (
                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex-1">
                                            <button
                                                type="button"
                                                onClick={togglePlayPreview}
                                                className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                                title={isPlayingPreview ? "Pause" : "Play Preview"}
                                            >
                                                {isPlayingPreview ? <Pause size={12} /> : <Play size={12} />}
                                            </button>
                                            <div className="flex-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                🎙️ Recorded Voice ({audioDurationSec}s)
                                            </div>
                                            <button
                                                type="button"
                                                onClick={deleteVoiceRecording}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                                                title="Delete Voice Note"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* D. Photos & Documents Attachment Hub */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                
                                {/* Photo Attachments */}
                                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <ImageIcon size={14} className="text-blue-500" />
                                            Photos ({selectedPhotos.length}/5)
                                        </label>
                                        <label className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                                disabled={selectedPhotos.length >= 5}
                                            />
                                            + Add Photo
                                        </label>
                                    </div>

                                    {photoPreviews.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {photoPreviews.map((preview, i) => (
                                                <div key={i} className="relative group w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhoto(i)}
                                                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic">No photos attached yet</p>
                                    )}
                                </div>

                                {/* Document / File Attachments */}
                                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Paperclip size={14} className="text-purple-500" />
                                            Docs / Quotations ({selectedFiles.length}/5)
                                        </label>
                                        <label className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50">
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                                                multiple
                                                onChange={handleFileChange}
                                                className="hidden"
                                                disabled={selectedFiles.length >= 5}
                                            />
                                            + Add File
                                        </label>
                                    </div>

                                    {selectedFiles.length > 0 ? (
                                        <div className="space-y-1 max-h-24 overflow-y-auto">
                                            {selectedFiles.map((file, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px]">
                                                    <span className="truncate max-w-[130px] font-medium text-slate-700 dark:text-slate-300">
                                                        📎 {file.name}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[9px] text-slate-400 font-mono">
                                                            {formatBytes(file.size)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFile(i)}
                                                            className="text-slate-400 hover:text-rose-600 ml-1"
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic">No files attached yet</p>
                                    )}
                                </div>

                            </div>

                            {/* E. Next Follow-Up Date & Time with Quick Presets */}
                            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/50 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                        <Calendar size={14} className="text-blue-600" />
                                        Next Scheduled Follow-Up
                                    </label>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                                        Sets alert badge on Kanban & Table
                                    </span>
                                </div>

                                {/* Quick Presets */}
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => applyDatePreset("2h")}
                                        className="px-2 py-1 bg-white dark:bg-slate-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        +2 Hours
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyDatePreset("tomorrow10")}
                                        className="px-2 py-1 bg-white dark:bg-slate-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        Tomorrow 10 AM
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyDatePreset("tomorrow3")}
                                        className="px-2 py-1 bg-white dark:bg-slate-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        Tomorrow 3 PM
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyDatePreset("in3days")}
                                        className="px-2 py-1 bg-white dark:bg-slate-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        In 3 Days
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyDatePreset("nextweek")}
                                        className="px-2 py-1 bg-white dark:bg-slate-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        Next Monday
                                    </button>
                                    {nextFollowUpDate && (
                                        <button
                                            type="button"
                                            onClick={() => setNextFollowUpDate("")}
                                            className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-500 rounded-lg hover:bg-slate-200"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="datetime-local"
                                    value={nextFollowUpDate}
                                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* F. Move Stage (Optional) */}
                            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                        Update Pipeline Stage?
                                    </label>
                                    <span className="text-[10px] text-slate-400">
                                        Optionally advance lead stage during this follow-up
                                    </span>
                                </div>

                                <select
                                    value={newStage}
                                    onChange={(e) => setNewStage(e.target.value)}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    {masterStages.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Submit Button */}
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !text.trim()}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>Saving Follow-Up...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send size={14} />
                                            <span>Save Follow-Up Note</span>
                                        </>
                                    )}
                                </button>
                            </div>

                        </form>
                    </div>

                    {/* RIGHT COLUMN: Follow-Up History Timeline (5 cols) */}
                    <div className="lg:col-span-5 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare size={14} className="text-blue-600" />
                                Follow-Up History ({followUps.length})
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400">
                                Newest on Top
                            </span>
                        </div>

                        {followUps.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-700">
                                    <MessageSquare size={20} className="text-slate-300" />
                                </div>
                                <p className="text-xs font-semibold text-slate-500">No follow-ups recorded yet.</p>
                                <p className="text-[10px] text-slate-400 max-w-[200px]">
                                    Use the form on the left to record your first interaction or voice note.
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {followUps.map((item, idx) => {
                                    const nextDateInfo = formatNextDateInfo(item.nextFollowUpDate);
                                    return (
                                        <div
                                            key={item._id || idx}
                                            className={`p-3.5 rounded-2xl border transition-all ${
                                                idx === 0
                                                    ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900/60 shadow-xs ring-1 ring-blue-500/10"
                                                    : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80"
                                            }`}
                                        >
                                            {/* Top Tag & Author */}
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2 py-0.5 rounded-md font-bold text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                        {item.type || "Call"}
                                                    </span>
                                                    {idx === 0 && (
                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                                            Top / Latest
                                                        </span>
                                                    )}
                                                </div>

                                                <span className="text-[10px] font-medium text-slate-400">
                                                    {getRelativeTime(item.createdAt)}
                                                </span>
                                            </div>

                                            {/* Discussion Note Body */}
                                            <p className="text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
                                                {item.text}
                                            </p>

                                            {/* Voice Note Player if Present */}
                                            {item.voiceUrl && (
                                                <div className="mt-2.5 p-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleTimelineAudio(item.voiceUrl!)}
                                                        className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs hover:bg-indigo-700 transition-colors shrink-0"
                                                    >
                                                        {playingTimelineAudio === item.voiceUrl ? (
                                                            <Pause size={12} />
                                                        ) : (
                                                            <Play size={12} />
                                                        )}
                                                    </button>
                                                    <div className="flex-1 truncate">
                                                        <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 block truncate">
                                                            🎙️ Voice Interaction
                                                        </span>
                                                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono">
                                                            {item.voiceDuration ? `${item.voiceDuration}s` : "Audio Recording"}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Photo Thumbnails if Present */}
                                            {item.photos && item.photos.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {item.photos.map((pUrl, pIdx) => {
                                                        const fullPhotoUrl = pUrl.startsWith("http") ? pUrl : `${API_BASE_URL}${pUrl}`;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={pIdx}
                                                                onClick={() => setLightboxImage(fullPhotoUrl)}
                                                                className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity"
                                                            >
                                                                <img src={fullPhotoUrl} alt="Photo" className="w-full h-full object-cover" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Attachments if Present */}
                                            {item.attachments && item.attachments.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {item.attachments.map((att, aIdx) => {
                                                        const fullAttUrl = att.url?.startsWith("http") ? att.url : `${API_BASE_URL}${att.url}`;
                                                        return (
                                                            <a
                                                                key={aIdx}
                                                                href={fullAttUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                                                            >
                                                                <span className="truncate max-w-[180px]">📎 {att.name || "Attachment"}</span>
                                                                <Download size={11} className="text-slate-400 shrink-0" />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Stage Change Info */}
                                            {item.stageChange && (
                                                <div className="mt-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md w-fit flex items-center gap-1">
                                                    <span>Stage moved:</span>
                                                    <span>{item.stageChange.fromStage}</span>
                                                    <ArrowRight size={10} />
                                                    <span>{item.stageChange.toStage}</span>
                                                </div>
                                            )}

                                            {/* Footer: Author & Next Follow-Up Pill */}
                                            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                                                <span className="text-slate-400 font-medium">
                                                    by {item.createdByName || "Team Member"}
                                                </span>

                                                {nextDateInfo && (
                                                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                                                        nextDateInfo.isPast
                                                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                                    }`}>
                                                        {nextDateInfo.label}: {nextDateInfo.text}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>

            </div>

            {/* Lightbox Modal for Photo Zoom */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-3xl max-h-[85vh]">
                        <img src={lightboxImage} alt="Enlarged" className="rounded-2xl max-w-full max-h-[80vh] object-contain shadow-2xl" />
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-3 -right-3 p-2 bg-white text-slate-900 rounded-full shadow-lg hover:bg-slate-100"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
