"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import {
    Camera, UserCheck, AlertCircle, Clock, SwitchCamera, Zap,
    ShieldCheck, RefreshCw, User, Search, CheckCircle2, XCircle,
    ArrowRight, AlertTriangle, Fingerprint, Calendar
} from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";

let faceapi: typeof import("@vladmandic/face-api") | null = null;

const DETECT_INTERVAL_MS = 100;
const WEBCAM_WIDTH  = 640;
const WEBCAM_HEIGHT = 480;
const CANVAS_W = 320;
const CANVAS_H = 240;
const JPEG_QUALITY = 0.85;

const TINY_OPTIONS = () =>
    faceapi ? new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 }) : null;

interface Employee {
    _id: string;
    name: string;
    employeeId: string;
    department?: { name: string } | string;
    designation?: { name: string } | string;
    photo?: string;
    status?: string;
}

interface PendingConfirmation {
    employeeId: string;
    employeeName: string;
    workedText: string;
    hoursWorked: number;
    method: "face" | "manual";
    manualType?: "checkOut";
    imageBlob?: Blob;
}

export default function AttendanceTab() {
    // Mode: 'face' or 'manual'
    const [mode, setMode] = useState<"face" | "manual">("face");

    // Face Scanner State
    const webcamRef       = useRef<Webcam>(null);
    const offCanvasRef    = useRef<HTMLCanvasElement | null>(null);
    const lastDetectRef   = useRef<number>(0);
    const lastScanTimeRef = useRef<number>(0);

    const [lastScanResult, setLastScanResult] = useState<any>(null);
    const [scanning,       setScanning]       = useState(false);
    const [autoMode,       setAutoMode]       = useState(true);
    const [facingMode,     setFacingMode]     = useState<"user" | "environment">("user");
    const [modelsLoaded,   setModelsLoaded]   = useState(false);
    const [faceDetected,   setFaceDetected]   = useState(false);
    const [livenessStatus, setLivenessStatus] = useState<string>("Align your face in the target box");
    
    // Confirmation Modal for < 4 hours early checkout
    const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
    const [confirmingLoading, setConfirmingLoading]     = useState(false);

    // Manual Attendance State
    const [employees, setEmployees]       = useState<Employee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [searchQuery, setSearchQuery]   = useState("");
    const [manualActionLoading, setManualActionLoading] = useState<string | null>(null);

    const animationFrameRef = useRef<number | null>(null);
    const isDetectingRef    = useRef(false);
    const facePresenceCounterRef = useRef<number>(0);

    // ── Speech Synthesis helper ──────────────────────────────────────────
    const speak = (text: string) => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    };

    // ── Fetch Employee List for Manual Tab ───────────────────────────────
    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/hr/employee`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(res.data.employees || []);
        } catch (err) {
            console.error("Error loading employees:", err);
        } finally {
            setLoadingEmployees(false);
        }
    };

    useEffect(() => {
        if (mode === "manual") {
            fetchEmployees();
        }
    }, [mode]);

    // ── Capture & Send Face Frame ─────────────────────────────────────────
    const captureAndScan = useCallback(async (forceCheckOut = false) => {
        if (scanning) return;
        const now = Date.now();
        if (!forceCheckOut && now - lastScanTimeRef.current < 3500) return;
        lastScanTimeRef.current = now;

        const imageSrc = webcamRef.current?.getScreenshot({ width: WEBCAM_WIDTH, height: WEBCAM_HEIGHT });
        if (!imageSrc) return;

        setScanning(true);
        setLivenessStatus("Scanning face & verifying biometric security...");

        try {
            const byteString = atob(imageSrc.split(",")[1]);
            const mime       = imageSrc.split(",")[0].split(":")[1].split(";")[0];
            const arr        = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
            const blob = new Blob([arr], { type: mime });

            const formData = new FormData();
            formData.append("file", blob, "capture.jpg");
            if (forceCheckOut) {
                formData.append("forceCheckOut", "true");
            }

            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            if (!token) {
                setLastScanResult({ status: "error", message: "Authentication failed. Please login again." });
                return;
            }

            const response = await axios.post(
                `${API_BASE_URL}/api/hr/mark-attendance`,
                formData,
                { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
            );

            const result = response.data;

            // Handle < 4h Early Check-Out Confirmation Modal
            if (result.status === "requires_confirmation" && result.type === "early_checkout") {
                setPendingConfirmation({
                    employeeId: result.employeeId,
                    employeeName: result.employee,
                    workedText: result.workedText || `${result.hoursWorked}h`,
                    hoursWorked: result.hoursWorked,
                    method: "face",
                    imageBlob: blob
                });
                speak(`Early departure alert for ${result.employee}. Please confirm check out.`);
                setLivenessStatus(`Confirmation required: Early departure for ${result.employee}`);
                return;
            }

            if (result.status === "success") {
                setLastScanResult({ ...result, timestamp: new Date() });
                const action = result.type === "Check-In" ? "Checked In" : "Checked Out";
                speak(`${action}, ${result.employee}`);
                setLivenessStatus(`Access Granted: ${result.employee}`);
            } else if (result.status === "spoof_detected" || result.status === "spoof") {
                setLastScanResult({ 
                    status: "spoof", 
                    message: result.message || "Live human face required. Photos/screens are blocked.", 
                    timestamp: new Date() 
                });
                speak("Security Alert: Live human face required.");
                setLivenessStatus("Anti-Spoof Alert: Live human face required.");
            } else if (result.status === "warning") {
                setLastScanResult({ ...result, timestamp: new Date() });
                speak(result.message);
                setLivenessStatus(result.message);
            } else if (result.status === "failed") {
                setLastScanResult({ status: "error", message: result.message || "Attendance failed.", timestamp: new Date() });
                speak("Attendance failed.");
                setLivenessStatus(result.message || "Attendance failed.");
            } else if (result.status === "unknown") {
                setLastScanResult({ status: "error", message: result.message || "Face not recognized", timestamp: new Date() });
                speak("Face not recognized");
                setLivenessStatus("Face not recognized in directory.");
            }
        } catch (error: any) {
            const errorMessage =
                error.response?.data?.message ||
                (error.request ? "Cannot connect to server." : error.message) ||
                "Unknown error.";
            setLastScanResult({ status: "error", message: errorMessage, timestamp: new Date() });
            setLivenessStatus("Network error connecting to backend.");
        } finally {
            setScanning(false);
            facePresenceCounterRef.current = 0;
        }
    }, [scanning]);

    // ── Manual Attendance Action (Check-In / Check-Out by User ID) ────────
    const handleManualAttendance = async (emp: Employee, actionType: "checkIn" | "checkOut", forceCheckOut = false) => {
        setManualActionLoading(emp._id);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(
                `${API_BASE_URL}/api/hr/attendance/record`,
                {
                    employeeId: emp.employeeId,
                    type: actionType,
                    forceCheckOut: forceCheckOut,
                    location: "Manual Kiosk"
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = res.data;

            // Handle < 4 Hours Confirmation Modal
            if (data.status === "requires_confirmation" && data.type === "early_checkout") {
                setPendingConfirmation({
                    employeeId: emp.employeeId,
                    employeeName: emp.name,
                    workedText: data.workedText || `${data.hoursWorked}h`,
                    hoursWorked: data.hoursWorked,
                    method: "manual",
                    manualType: "checkOut"
                });
                speak(`Early departure alert for ${emp.name}. Please confirm.`);
                return;
            }

            const actionLabel = actionType === "checkIn" ? "Checked In" : "Checked Out";
            speak(`${actionLabel}, ${emp.name}`);
            setLastScanResult({
                status: "success",
                type: actionType === "checkIn" ? "Check-In" : "Check-Out",
                employee: emp.name,
                method: "Manual",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                timestamp: new Date()
            });
            fetchEmployees();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to record attendance";
            setLastScanResult({
                status: "error",
                message: msg,
                timestamp: new Date()
            });
            speak(msg);
        } finally {
            setManualActionLoading(null);
        }
    };

    // ── Confirm Early Check-Out Handler ──────────────────────────────────
    const handleConfirmEarlyDeparture = async () => {
        if (!pendingConfirmation) return;
        setConfirmingLoading(true);
        try {
            if (pendingConfirmation.method === "face") {
                await captureAndScan(true);
            } else {
                const emp = employees.find(e => e.employeeId === pendingConfirmation.employeeId || e._id === pendingConfirmation.employeeId);
                if (emp) {
                    await handleManualAttendance(emp, "checkOut", true);
                }
            }
        } finally {
            setConfirmingLoading(false);
            setPendingConfirmation(null);
        }
    };

    // ── Load face-api models ───────────────────────────────────────────────
    useEffect(() => {
        const loadModels = async () => {
            try {
                faceapi = await import("@vladmandic/face-api");
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
                ]);
                const c = document.createElement("canvas");
                c.width  = CANVAS_W;
                c.height = CANVAS_H;
                offCanvasRef.current = c;
                setModelsLoaded(true);
                setLivenessStatus("Position face inside the target box");
            } catch (err) {
                console.error("Error loading client models, fallback to server auto-scan", err);
                setModelsLoaded(false);
                setLivenessStatus("Position face and click Scan Face Now");
            }
        };
        loadModels();
    }, []);

    // ── EAR helper ────────────────────────────────────────────────────────
    const getEAR = (eye: { x: number; y: number }[]) => {
        const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            Math.hypot(a.x - b.x, a.y - b.y);
        return (d(eye[1], eye[5]) + d(eye[2], eye[4])) / (2.0 * d(eye[0], eye[3]));
    };

    // ── Face Presence Detection Loop ──────────────────────────────────────
    useEffect(() => {
        if (!autoMode || mode !== "face" || pendingConfirmation) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const detectPresence = async (timestamp: number) => {
            animationFrameRef.current = requestAnimationFrame(detectPresence);

            if (timestamp - lastDetectRef.current < DETECT_INTERVAL_MS) return;
            lastDetectRef.current = timestamp;

            if (isDetectingRef.current || scanning) return;
            isDetectingRef.current = true;

            try {
                const video = webcamRef.current?.video;
                if (!video || video.readyState !== 4 || video.videoWidth === 0) return;

                if (!faceapi || !modelsLoaded) {
                    facePresenceCounterRef.current += 1;
                    if (facePresenceCounterRef.current >= 30 && !scanning) {
                        facePresenceCounterRef.current = 0;
                        captureAndScan(false);
                    }
                    return;
                }

                const canvas = offCanvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (ctx) ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);

                const opts = TINY_OPTIONS();
                if (!opts) return;

                const detection = await faceapi.detectSingleFace(canvas, opts).withFaceLandmarks();

                if (detection) {
                    setFaceDetected(true);
                    facePresenceCounterRef.current += 1;

                    const landmarks = detection.landmarks;
                    const avgEAR = (getEAR(landmarks.getLeftEye()) + getEAR(landmarks.getRightEye())) / 2;

                    // Trigger 1: Blink detected
                    if (avgEAR < 0.22) {
                        setLivenessStatus("Blink detected! Scanning...");
                        if (!scanning) captureAndScan(false);
                    } 
                    // Trigger 2: Face locked for ~0.6 seconds
                    else if (facePresenceCounterRef.current >= 6) {
                        setLivenessStatus("Face Locked! Verifying attendance...");
                        if (!scanning) captureAndScan(false);
                    } else {
                        setLivenessStatus("Face Detected · Keep looking at camera");
                    }
                } else {
                    setFaceDetected(false);
                    facePresenceCounterRef.current = 0;
                    setLivenessStatus("Align face inside target box");
                }
            } catch {
                /* non-fatal frame drop */
            } finally {
                isDetectingRef.current = false;
            }
        };

        animationFrameRef.current = requestAnimationFrame(detectPresence);
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [autoMode, modelsLoaded, scanning, mode, pendingConfirmation, captureAndScan]);

    // ── Auto-clear result after 5 s ───────────────────────────────────────
    useEffect(() => {
        if (!lastScanResult) return;
        const t = setTimeout(() => setLastScanResult(null), 5000);
        return () => clearTimeout(t);
    }, [lastScanResult]);

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Top Navigation Tabs: Face Kiosk vs Manual User ID */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm">
                <div className="flex w-full sm:w-auto p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl">
                    <button
                        onClick={() => setMode("face")}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                            mode === "face"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }`}
                    >
                        <Camera size={16} />
                        Face Biometric Kiosk
                    </button>
                    <button
                        onClick={() => setMode("manual")}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                            mode === "manual"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }`}
                    >
                        <User size={16} />
                        Manual / User ID Attendance
                    </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                        <Clock size={13} /> 24-Hour Day & Night Shifts Active
                    </span>
                </div>
            </div>

            {/* TAB 1: FACE BIOMETRIC KIOSK */}
            {mode === "face" && (
                <div className="bg-slate-950 flex flex-col min-h-[520px] lg:h-[calc(100vh-250px)] overflow-hidden relative rounded-2xl border border-slate-800 shadow-2xl">
                    {/* Camera Feed Area */}
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={JPEG_QUALITY}
                            videoConstraints={{ facingMode: { ideal: facingMode }, width: WEBCAM_WIDTH, height: WEBCAM_HEIGHT }}
                            onUserMediaError={() => alert("Could not access camera. Please check device permissions.")}
                            className="h-full object-cover w-full"
                        />

                        {/* 🎯 Centered Reticle Target Frame */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className={`relative w-64 h-72 sm:w-80 sm:h-96 rounded-3xl transition-all duration-300 ${
                                scanning 
                                    ? "border-2 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]" 
                                    : faceDetected 
                                        ? "border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]" 
                                        : "border-2 border-blue-400/60 shadow-[0_0_20px_rgba(96,165,250,0.2)]"
                            }`}>
                                {/* Reticle Corners */}
                                <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-xl ${faceDetected ? "border-emerald-400" : "border-blue-400"}`} />
                                <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-xl ${faceDetected ? "border-emerald-400" : "border-blue-400"}`} />
                                <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-xl ${faceDetected ? "border-emerald-400" : "border-blue-400"}`} />
                                <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-xl ${faceDetected ? "border-emerald-400" : "border-blue-400"}`} />

                                {/* Laser Scanning Line */}
                                {scanning && (
                                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-scan-y" />
                                )}

                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-white/20 rounded-full flex items-center justify-center">
                                    <div className={`w-1.5 h-1.5 rounded-full ${faceDetected ? "bg-emerald-400 animate-ping" : "bg-blue-400"}`} />
                                </div>
                            </div>
                        </div>

                        {/* Top Real-time Status Capsule */}
                        <div className="-translate-x-1/2 absolute backdrop-blur-md bg-slate-900/80 border border-slate-700/80 flex font-medium gap-2.5 items-center left-1/2 px-4 sm:px-6 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm text-white top-4 z-10 max-w-[90%] text-center">
                            {scanning ? (
                                <>
                                    <RefreshCw className="animate-spin text-yellow-400 flex-shrink-0" size={16} />
                                    <span className="text-yellow-200 font-semibold">{livenessStatus}</span>
                                </>
                            ) : (
                                <>
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${faceDetected ? "bg-emerald-400 animate-pulse" : "bg-blue-400"}`} />
                                    <span className="text-slate-100">{livenessStatus}</span>
                                </>
                            )}
                        </div>

                        {/* Result Toast Overlay */}
                        {lastScanResult && (
                            <div className={`absolute top-16 left-1/2 -translate-x-1/2 px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-2xl backdrop-blur-xl border-2 animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-4 z-20 max-w-[92%] sm:max-w-md ${
                                lastScanResult.status === "success"
                                    ? "bg-emerald-600/95 border-emerald-400 text-white shadow-emerald-950/60"
                                    : lastScanResult.status === "spoof"
                                        ? "bg-rose-700/95 border-rose-400 text-white shadow-rose-950/60"
                                        : lastScanResult.status === "warning"
                                            ? "bg-amber-600/95 border-amber-400 text-white"
                                            : "bg-red-600/95 border-red-400 text-white shadow-red-950/60"
                            }`}>
                                <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl flex-shrink-0">
                                    {lastScanResult.status === "success" ? <UserCheck size={32} /> :
                                        lastScanResult.status === "warning" ? <Clock size={32} /> : <AlertCircle size={32} />}
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg sm:text-xl tracking-tight">
                                        {lastScanResult.status === "success" ? "Gate Access Granted" :
                                            lastScanResult.status === "spoof" ? "Anti-Spoof Alert" :
                                                lastScanResult.status === "warning" ? "Notice" : "Access Denied"}
                                    </h3>
                                    <p className="font-medium text-xs sm:text-sm text-white/95 mt-0.5">
                                        {lastScanResult.employee ? `${lastScanResult.employee} (${lastScanResult.type || 'Logged'})` : lastScanResult.message}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-white/20 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                                            {lastScanResult.method === "Face" ? "📸 Marked by Face Biometric" : "👤 Marked by User ID (Manual)"}
                                        </span>
                                        {lastScanResult.time && <p className="opacity-80 text-[11px]">at {lastScanResult.time}</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Control Bar */}
                    <div className="bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between p-3.5 sm:p-4 gap-3 z-10">
                        <div className="text-white flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                <Zap size={18} className="text-yellow-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                                    Face Attendance Kiosk
                                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <ShieldCheck size={11} /> Anti-Spoof Active
                                    </span>
                                </h2>
                                <p className="text-slate-400 text-xs hidden sm:block">Align face inside box · Auto-scans with 5m debounce</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
                            <button
                                onClick={() => setAutoMode(!autoMode)}
                                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs transition-all ${
                                    autoMode 
                                        ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40" 
                                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                                }`}
                            >
                                {autoMode ? "⚡ Auto: ON" : "⏸ Auto: OFF"}
                            </button>

                            <button
                                onClick={() => setFacingMode(p => p === "user" ? "environment" : "user")}
                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 sm:p-2.5 rounded-xl text-slate-300 transition-colors"
                                title="Switch Camera"
                            >
                                <SwitchCamera size={18} />
                            </button>

                            <button
                                onClick={() => captureAndScan(false)}
                                disabled={scanning}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 flex gap-1.5 sm:gap-2 font-bold items-center px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl shadow-lg text-xs sm:text-sm text-white transition-all active:scale-95"
                            >
                                {scanning ? <RefreshCw size={16} className="animate-spin" /> : <Camera size={16} />}
                                {scanning ? "Verifying..." : "Scan Face Now"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: MANUAL / USER ID ATTENDANCE */}
            {mode === "manual" && (
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
                    {/* Header & Quick Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                                <Fingerprint className="text-blue-600" size={20} />
                                Manual User ID Attendance
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Mark attendance directly by employee code, name, or ID badge.
                            </p>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Result Banner for Manual Mode */}
                    {lastScanResult && (
                        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                            lastScanResult.status === "success"
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                                : lastScanResult.status === "warning"
                                    ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                                    : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                        }`}>
                            <div className="flex items-center gap-3">
                                {lastScanResult.status === "success" ? (
                                    <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={24} />
                                ) : (
                                    <AlertCircle className="text-rose-600 dark:text-rose-400 flex-shrink-0" size={24} />
                                )}
                                <div>
                                    <h4 className="font-bold text-sm">
                                        {lastScanResult.status === "success"
                                            ? `${lastScanResult.employee} - ${lastScanResult.type} Recorded`
                                            : "Notice"}
                                    </h4>
                                    <p className="text-xs opacity-90">
                                        {lastScanResult.message || `Recorded at ${lastScanResult.time || new Date().toLocaleTimeString()}`}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-white/60 dark:bg-slate-900/60 flex items-center gap-1">
                                {lastScanResult.method === "Face" ? "📸 Face Biometric" : "👤 Manual (User ID)"}
                            </span>
                        </div>
                    )}

                    {/* Employee Attendance Table / Card Grid */}
                    {loadingEmployees ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <RefreshCw className="animate-spin mb-2" size={28} />
                            <p className="text-sm">Loading organization directory...</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                            <User size={36} className="mx-auto mb-2 opacity-30" />
                            <p className="font-medium text-sm">No employees found matching &quot;{searchQuery}&quot;</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                            {filteredEmployees.map((emp) => (
                                <div
                                    key={emp._id}
                                    className="bg-gray-50/80 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all gap-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base flex-shrink-0 overflow-hidden border border-blue-200 dark:border-blue-800">
                                            {emp.photo ? (
                                                <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                                            ) : (
                                                emp.name.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                {emp.name}
                                            </h4>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-semibold">
                                                ID: {emp.employeeId}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                {typeof emp.department === "object" ? emp.department?.name : emp.department || "General"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-slate-700/60">
                                        <button
                                            onClick={() => handleManualAttendance(emp, "checkIn")}
                                            disabled={manualActionLoading === emp._id}
                                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                                        >
                                            {manualActionLoading === emp._id ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                            Check-In
                                        </button>

                                        <button
                                            onClick={() => handleManualAttendance(emp, "checkOut")}
                                            disabled={manualActionLoading === emp._id}
                                            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                                        >
                                            {manualActionLoading === emp._id ? <RefreshCw size={13} className="animate-spin" /> : <XCircle size={14} />}
                                            Check-Out
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ⚠️ EARLY CHECK-OUT (< 4 HOURS) CONFIRMATION MODAL */}
            {pendingConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                            <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-2xl">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-xl text-gray-900 dark:text-white">
                                    Early Departure Warning
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Working duration is under standard shift requirement
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-2 text-sm text-amber-900 dark:text-amber-200">
                            <div className="flex justify-between font-semibold">
                                <span>Employee:</span>
                                <span className="font-bold text-gray-900 dark:text-white">{pendingConfirmation.employeeName}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span>Time Worked:</span>
                                <span className="font-bold text-amber-700 dark:text-amber-300">{pendingConfirmation.workedText}</span>
                            </div>
                            <div className="text-xs text-amber-800 dark:text-amber-300/90 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                                ⚠️ Standard shift is 4+ hours. Checking out now will log an <strong>Early Check-Out</strong> session.
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setPendingConfirmation(null)}
                                disabled={confirmingLoading}
                                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel (Stay Checked-In)
                            </button>

                            <button
                                onClick={handleConfirmEarlyDeparture}
                                disabled={confirmingLoading}
                                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {confirmingLoading ? (
                                    <RefreshCw className="animate-spin" size={16} />
                                ) : (
                                    <CheckCircle2 size={16} />
                                )}
                                Confirm Early Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes scan-y {
                    0%   { top: 0%;   opacity: 0; }
                    15%  { opacity: 1; }
                    85%  { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-y { animation: scan-y 2.2s ease-in-out infinite; position: absolute; }
            `}</style>
        </div>
    );
}
