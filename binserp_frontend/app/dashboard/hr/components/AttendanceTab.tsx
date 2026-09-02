"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import {
    Camera, UserCheck, AlertCircle, Clock, SwitchCamera, Zap,
    ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2
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

interface PendingConfirmation {
    employeeId: string;
    employeeName: string;
    workedText: string;
    hoursWorked: number;
    imageBlob?: Blob;
}

export default function AttendanceTab() {
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

    // ── Confirm Early Check-Out Handler ──────────────────────────────────
    const handleConfirmEarlyDeparture = async () => {
        if (!pendingConfirmation) return;
        setConfirmingLoading(true);
        try {
            await captureAndScan(true);
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
        if (!autoMode || pendingConfirmation) {
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
    }, [autoMode, modelsLoaded, scanning, pendingConfirmation, captureAndScan]);

    // ── Auto-clear result after 5 s ───────────────────────────────────────
    useEffect(() => {
        if (!lastScanResult) return;
        const t = setTimeout(() => setLastScanResult(null), 5000);
        return () => clearTimeout(t);
    }, [lastScanResult]);

    return (
        <div className="space-y-4">
            {/* Direct Face Biometric Kiosk */}
            <div className="bg-slate-950 flex flex-col min-h-[520px] lg:h-[calc(100vh-220px)] overflow-hidden relative rounded-2xl border border-slate-800 shadow-2xl">
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
                                        📸 Marked by Face Biometric
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
                                Face Biometric Kiosk
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <ShieldCheck size={11} /> Anti-Spoof Active
                                </span>
                            </h2>
                            <p className="text-slate-400 text-xs hidden sm:block">Align face inside box · 24-Hour Day & Night Shifts Active</p>
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
