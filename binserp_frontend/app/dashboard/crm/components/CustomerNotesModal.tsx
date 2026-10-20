"use client";

import React, { useState, useRef } from "react";
import { 
    X, Phone, MessageSquare, Users, Mail, FileText, MapPin, 
    Mic, MicOff, Play, Pause, Trash2, Upload, 
    Image as ImageIcon, Paperclip, CheckCircle2, AlertCircle, 
    Eye, Download, Send, RefreshCw, Volume2
} from "lucide-react";
import { apiRequest } from "@/src/lib/api";
import { API_BASE_URL } from "@/src/utils/config";

export interface ContactNoteItem {
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
    createdByName?: string;
    createdAt?: string;
}

interface CustomerNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: {
        _id: string;
        name: string;
        customerCode?: string;
        contactPerson?: string;
        phone?: string;
        email?: string;
        notesHistory?: ContactNoteItem[];
    };
    onCustomerUpdated: (updatedCustomer: any) => void;
}

const INTERACTION_TYPES: Array<{
    id: ContactNoteItem["type"];
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

export default function CustomerNotesModal({
    isOpen,
    onClose,
    customer,
    onCustomerUpdated
}: CustomerNotesModalProps) {
    const [type, setType] = useState<ContactNoteItem["type"]>("Note");
    const [text, setText] = useState("");

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

    if (!isOpen) return null;

    // Start Audio Recording
    const startRecording = async () => {
        try {
            setErrorMsg(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioPreviewUrl(url);
                setAudioDurationSec(recordingTime);

                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start(200);
            setIsRecording(true);
            setRecordingTime(0);

            timerIntervalRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            console.error("Microphone access error:", err);
            setErrorMsg("Could not access microphone. Please ensure microphone permissions are granted.");
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
        const newPhotos = [...selectedPhotos, ...filesArray].slice(0, 5);
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
        const newFiles = [...selectedFiles, ...filesArray].slice(0, 5);
        setSelectedFiles(newFiles);
    };

    const removeFile = (index: number) => {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    // Handle Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) {
            setErrorMsg("Please enter discussion notes or a summary.");
            return;
        }

        try {
            setSubmitting(true);
            setErrorMsg(null);

            const formData = new FormData();
            formData.append("type", type);
            formData.append("text", text.trim());
            if (audioDurationSec) {
                formData.append("voiceDuration", String(audioDurationSec));
            }

            if (audioBlob) {
                formData.append("voice", audioBlob, `voice-${Date.now()}.webm`);
            }

            selectedPhotos.forEach((photo) => {
                formData.append("photos", photo);
            });

            selectedFiles.forEach((file) => {
                formData.append("files", file);
            });

            const token = localStorage.getItem("token");
            const response = await apiRequest(`/api/crm/customers/${customer._id}/notes`, {
                method: "POST",
                token,
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || "Failed to save contact note");
            }

            const updatedHistory = result.data?.notesHistory || [];
            onCustomerUpdated({
                ...customer,
                notesHistory: updatedHistory
            });

            // Reset form
            setText("");
            deleteVoiceRecording();
            setSelectedPhotos([]);
            setPhotoPreviews([]);
            setSelectedFiles([]);
        } catch (err: any) {
            console.error("Save note error:", err);
            setErrorMsg(err.message || "Failed to save contact note");
        } finally {
            setSubmitting(false);
        }
    };

    const formatSeconds = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const notesHistory = customer.notesHistory || [];

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Modal Header */}
                <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                                Multi-Modal Contact Notes
                            </span>
                            <span className="text-xs text-slate-400">Audio • Photos • Docs</span>
                        </div>
                        <h3 className="font-extrabold text-base mt-1">
                            {customer.name}
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5 font-medium">
                            {customer.contactPerson || "Primary Contact"} {customer.phone && `• ${customer.phone}`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Modal Body: Left column Form, Right column Timeline */}
                <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
                    
                    {/* LEFT COLUMN: Add Interaction Form (5 cols) */}
                    <div className="lg:col-span-5 p-5 border-r border-slate-200 dark:border-slate-800 overflow-y-auto space-y-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            {/* Interaction Type Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Interaction Channel / Type
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {INTERACTION_TYPES.map((t) => {
                                        const Icon = t.icon;
                                        const active = type === t.id;
                                        return (
                                            <button
                                                type="button"
                                                key={t.id}
                                                onClick={() => setType(t.id)}
                                                className={`p-2 rounded-xl text-left border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                    active
                                                        ? `${t.bg} ${t.color} border-current ring-1 ring-current shadow-xs`
                                                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                }`}
                                            >
                                                <Icon size={14} className={t.color} />
                                                <span className="truncate">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Note / Discussion Details Textarea */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Notes & Discussion Summary <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Key points discussed, client feedback, purchase intent, next commitments..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors resize-none"
                                />
                            </div>

                            {/* Audio Voice Recording Section */}
                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Volume2 size={14} className="text-blue-500" />
                                        Voice Note (Recording)
                                    </span>
                                    {isRecording && (
                                        <span className="text-xs font-mono font-extrabold text-rose-500 animate-pulse flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                            {formatSeconds(recordingTime)}
                                        </span>
                                    )}
                                </div>

                                {!audioBlob ? (
                                    <div className="flex items-center gap-2">
                                        {!isRecording ? (
                                            <button
                                                type="button"
                                                onClick={startRecording}
                                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                                            >
                                                <Mic size={14} /> Start Voice Note
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse transition-colors"
                                            >
                                                <MicOff size={14} /> Stop Recording
                                            </button>
                                        )}
                                        <span className="text-[11px] text-slate-400">
                                            {isRecording ? "Recording active..." : "Record client voice memo"}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={togglePlayPreview}
                                                className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                                            >
                                                {isPlayingPreview ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                            </button>
                                            <div>
                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Voice Note Recorded</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{formatSeconds(audioDurationSec)}</div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={deleteVoiceRecording}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                                            title="Delete recording"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Photos & Document Attachments */}
                            <div className="space-y-3">
                                {/* Photos */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <ImageIcon size={14} className="text-emerald-500" />
                                            Photos & Screenshots ({selectedPhotos.length}/5)
                                        </label>
                                        <label className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold cursor-pointer flex items-center gap-1">
                                            <Upload size={12} /> Upload
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>

                                    {photoPreviews.length > 0 && (
                                        <div className="grid grid-cols-4 gap-2 pt-1">
                                            {photoPreviews.map((preview, idx) => (
                                                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square">
                                                    <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhoto(idx)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Documents */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Paperclip size={14} className="text-purple-500" />
                                            Documents & Files ({selectedFiles.length}/5)
                                        </label>
                                        <label className="text-[11px] text-purple-600 hover:text-purple-700 dark:text-purple-400 font-bold cursor-pointer flex items-center gap-1">
                                            <Upload size={12} /> Add Files
                                            <input
                                                type="file"
                                                multiple
                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.zip"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>

                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-1">
                                            {selectedFiles.map((file, idx) => (
                                                <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                                        {file.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(idx)}
                                                        className="text-rose-500 hover:text-rose-700"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                            >
                                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                <span>{submitting ? "Saving Contact Note..." : "Save Contact Note"}</span>
                            </button>
                        </form>
                    </div>

                    {/* RIGHT COLUMN: Contact Notes Timeline (7 cols) */}
                    <div className="lg:col-span-7 p-5 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-900/40">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Contact Interaction History ({notesHistory.length})
                                </h4>
                                <p className="text-[11px] text-slate-400">Chronological history with voice memos & proof attachments</p>
                            </div>

                            {/* Direct WhatsApp & Email Buttons */}
                            <div className="flex items-center gap-1.5">
                                {customer.phone && (
                                    <a
                                        href={`https://wa.me/91${customer.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello ${customer.contactPerson || customer.name}, regarding our discussion...`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <MessageSquare size={11} className="text-emerald-600" /> WhatsApp
                                    </a>
                                )}
                                {customer.email && (
                                    <a
                                        href={`mailto:${customer.email}?subject=${encodeURIComponent(`Binserp Discussion - ${customer.name}`)}`}
                                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <Mail size={11} className="text-amber-600" /> Email
                                    </a>
                                )}
                            </div>
                        </div>

                        {notesHistory.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-semibold">No contact notes logged yet.</p>
                                <p className="text-[11px] mt-0.5">Record a voice note, upload meeting photos, or summarize discussions using the form.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notesHistory.map((note, index) => {
                                    const channelConfig = INTERACTION_TYPES.find(t => t.id === note.type) || INTERACTION_TYPES[4];
                                    const ChannelIcon = channelConfig.icon;

                                    return (
                                        <div
                                            key={note._id || index}
                                            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2.5"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${channelConfig.bg} ${channelConfig.color}`}>
                                                        <ChannelIcon size={11} /> {note.type}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                        {note.createdByName || "Executive"}
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[10px] text-slate-400">
                                                    {note.createdAt ? new Date(note.createdAt).toLocaleString("en-GB") : "-"}
                                                </span>
                                            </div>

                                            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">
                                                {note.text}
                                            </p>

                                            {/* Voice Player */}
                                            {note.voiceUrl && (
                                                <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleTimelineAudio(note.voiceUrl!)}
                                                            className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-2xs"
                                                        >
                                                            {playingTimelineAudio === note.voiceUrl ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                                                        </button>
                                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                                            Voice Recording
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-[10px] text-slate-400">
                                                        {note.voiceDuration ? formatSeconds(note.voiceDuration) : "Audio"}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Photo Previews */}
                                            {note.photos && note.photos.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {note.photos.map((photo, pIdx) => {
                                                        const fullPhotoUrl = photo.startsWith("http") ? photo : `${API_BASE_URL}${photo}`;
                                                        return (
                                                            <div
                                                                key={pIdx}
                                                                onClick={() => setLightboxImage(fullPhotoUrl)}
                                                                className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition-opacity"
                                                            >
                                                                <img src={fullPhotoUrl} alt="Note attachment" className="w-full h-full object-cover" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Document Attachments */}
                                            {note.attachments && note.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {note.attachments.map((doc, dIdx) => {
                                                        const fullDocUrl = doc.url.startsWith("http") ? doc.url : `${API_BASE_URL}${doc.url}`;
                                                        return (
                                                            <a
                                                                key={dIdx}
                                                                href={fullDocUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 rounded-lg border border-slate-200 dark:border-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                                                            >
                                                                <Paperclip size={12} className="text-purple-500" />
                                                                <span className="truncate max-w-[150px]">{doc.name}</span>
                                                                <Download size={11} className="text-slate-400 ml-1" />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lightbox Modal */}
                {lightboxImage && (
                    <div
                        className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
                        onClick={() => setLightboxImage(null)}
                    >
                        <div className="relative max-w-3xl max-h-[90vh]">
                            <img src={lightboxImage} alt="Enlarged" className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
                            <button
                                onClick={() => setLightboxImage(null)}
                                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-lg"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
