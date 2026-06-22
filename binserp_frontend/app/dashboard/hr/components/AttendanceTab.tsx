"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { Camera, UserCheck, AlertCircle, Clock, SwitchCamera, Zap } from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";

let faceapi: typeof import("@vladmandic/face-api") | null = null;

// ─── Constants ────────────────────────────────────────────────────────────────
const DETECT_INTERVAL_MS = 80;   // Run EAR check every 80 ms (≈ 12 fps) instead of every rAF (~60 fps)
const WEBCAM_WIDTH  = 480;       // Reduced from full resolution → less data to process
const WEBCAM_HEIGHT = 360;
const CANVAS_W = 320;            // Downscaled canvas for faceapi (faster inference)
const CANVAS_H = 240;
const JPEG_QUALITY = 0.75;       // Compressed screenshot → smaller payload to Python
const TINY_OPTIONS = () =>
    faceapi ? new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }) : null;
//   inputSize 224 is much faster than the default 416; scoreThreshold 0.4 avoids re-processing weak detections

export default function AttendanceTab() {
    const webcamRef     = useRef<Webcam>(null);
    const offCanvasRef  = useRef<HTMLCanvasElement | null>(null); // reused off-screen canvas
    const lastDetectRef = useRef<number>(0);                      // throttle timestamp

    const [lastScanResult, setLastScanResult] = useState<any>(null);
    const [scanning,       setScanning]       = useState(false);
    const [autoMode,       setAutoMode]       = useState(true);
    const [facingMode,     setFacingMode]     = useState<"user" | "environment">("user");
    const [modelsLoaded,   setModelsLoaded]   = useState(false);
    const [blinkDetected,  setBlinkDetected]  = useState(false);
    const [livenessStatus, setLivenessStatus] = useState<string>("Initializing...");
    const animationFrameRef = useRef<number | null>(null);
    const blinkRef          = useRef(false);
    const blinkStartTimeRef = useRef<number>(0);
    const isDetectingRef    = useRef(false);  // guard instead of closure variable

    // ── Capture & send to backend ──────────────────────────────────────────
    const captureAndScan = useCallback(async () => {
        if (scanning) return;

        // Grab screenshot at reduced quality
        const imageSrc = webcamRef.current?.getScreenshot({ width: WEBCAM_WIDTH, height: WEBCAM_HEIGHT });
        if (!imageSrc) return;

        setScanning(true);
        try {
            // Convert base64 → Blob without an extra fetch() round-trip
            const byteString = atob(imageSrc.split(",")[1]);
            const mime       = imageSrc.split(",")[0].split(":")[1].split(";")[0];
            const arr        = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
            const blob = new Blob([arr], { type: mime });

            const formData = new FormData();
            formData.append("file", blob, "capture.jpg");

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

            const speak = (text: string) => {
                if ("speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
                }
            };

            if (result.status === "success") {
                setLastScanResult({ ...result, timestamp: new Date() });
                const action = result.type === "Check-In" ? "Checked In" : "Checked Out";
                speak(`${action}, ${result.employee}`);
            } else if (result.status === "warning") {
                setLastScanResult({ ...result, timestamp: new Date() });
                speak(result.message);
            } else if (result.status === "failed") {
                setLastScanResult({ status: "error", message: result.message || "Attendance failed.", timestamp: new Date() });
                speak("Error marking attendance.");
            } else if (result.status === "unknown") {
                setLastScanResult({ status: "error", message: result.message || "Face not recognized", timestamp: new Date() });
                if (!autoMode) speak("Face not recognized");
            }
        } catch (error: any) {
            const errorMessage =
                error.response?.data?.message ||
                (error.request ? "Cannot connect to server." : error.message) ||
                "Unknown error.";
            setLastScanResult({ status: "error", message: errorMessage, timestamp: new Date() });
        } finally {
            setScanning(false);
            setBlinkDetected(false);
        }
    }, [scanning, autoMode]);

    // ── Load face-api models ───────────────────────────────────────────────
    useEffect(() => {
        const loadModels = async () => {
            try {
                faceapi = await import("@vladmandic/face-api");
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),  // full model (tiny not in /models)
                ]);
                // Pre-create reusable off-screen canvas
                const c = document.createElement("canvas");
                c.width  = CANVAS_W;
                c.height = CANVAS_H;
                offCanvasRef.current = c;
                setModelsLoaded(true);
                setLivenessStatus("Models loaded. Look at camera.");
            } catch (err) {
                console.error("Error loading models", err);
                setLivenessStatus("Failed to load liveness models.");
            }
        };
        loadModels();
    }, []);

    // ── EAR (Eye Aspect Ratio) helper ─────────────────────────────────────
    const getEAR = (eye: { x: number; y: number }[]) => {
        const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            Math.hypot(a.x - b.x, a.y - b.y);
        return (d(eye[1], eye[5]) + d(eye[2], eye[4])) / (2.0 * d(eye[0], eye[3]));
    };

    // ── Detection loop — throttled ────────────────────────────────────────
    useEffect(() => {
        if (!autoMode || !modelsLoaded) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const detectLiveness = async (timestamp: number) => {
            animationFrameRef.current = requestAnimationFrame(detectLiveness);

            // Throttle: only run inference every DETECT_INTERVAL_MS
            if (timestamp - lastDetectRef.current < DETECT_INTERVAL_MS) return;
            lastDetectRef.current = timestamp;

            if (isDetectingRef.current || scanning || !faceapi) return;
            isDetectingRef.current = true;

            try {
                const video = webcamRef.current?.video;
                if (!video || video.readyState !== 4 || video.videoWidth === 0) return;

                const canvas = offCanvasRef.current;
                if (!canvas) return;

                // Draw downscaled frame into the reused canvas
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (ctx) ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);

                const opts = TINY_OPTIONS();
                if (!opts) return;

                const detection = await faceapi
                    .detectSingleFace(canvas, opts)
                    .withFaceLandmarks(); // uses full faceLandmark68Net

                if (detection) {
                    const landmarks = detection.landmarks;
                    const avgEAR = (getEAR(landmarks.getLeftEye()) + getEAR(landmarks.getRightEye())) / 2;

                    if (avgEAR < 0.21) {
                        if (!blinkRef.current) {
                            blinkRef.current = true;
                            blinkStartTimeRef.current = Date.now();
                        }
                        setLivenessStatus("Blink registered! Open your eyes.");
                    } else if (avgEAR >= 0.25 && blinkRef.current) {
                        blinkRef.current = false;
                        const duration = Date.now() - blinkStartTimeRef.current;
                        if (duration >= 80 && duration <= 800) {
                            setBlinkDetected(true);
                            setLivenessStatus("Liveness verified. Scanning...");
                            if (!scanning) captureAndScan();
                        } else {
                            setLivenessStatus("Blink too fast/slow. Please blink normally.");
                        }
                    } else if (!blinkRef.current) {
                        setLivenessStatus("Face detected. BLINK to mark attendance.");
                    }
                } else {
                    setLivenessStatus("No face detected. Position face in frame.");
                }
            } catch { /* suppress non-fatal frame errors */ }
            finally {
                isDetectingRef.current = false;
            }
        };

        animationFrameRef.current = requestAnimationFrame(detectLiveness);
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [autoMode, modelsLoaded, scanning, captureAndScan]);

    // ── Auto-clear result after 5 s ───────────────────────────────────────
    useEffect(() => {
        if (!lastScanResult) return;
        const t = setTimeout(() => setLastScanResult(null), 5000);
        return () => clearTimeout(t);
    }, [lastScanResult]);

    return (
        <div className="bg-gray-900 flex flex-col h-[calc(100vh-200px)] overflow-hidden relative rounded-2xl">
            {/* Camera View */}
            <div className="flex-1 relative">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={JPEG_QUALITY}
                    className="h-full object-cover w-full"
                    videoConstraints={{ facingMode, width: WEBCAM_WIDTH, height: WEBCAM_HEIGHT }}
                />

                {/* Scanner line */}
                {autoMode && scanning && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="animate-scan-y bg-blue-500/50 h-1 shadow-[0_0_20px_rgba(59,130,246,0.8)] w-full" />
                    </div>
                )}

                {/* Liveness status */}
                {autoMode && (
                    <div className="-translate-x-1/2 absolute backdrop-blur-md bg-black/60 border border-white/10 flex font-semibold gap-2 items-center left-1/2 px-4 py-2 rounded-full shadow-xl text-sm text-white top-4 z-10">
                        {modelsLoaded ? (
                            <>
                                <div className={`w-2 h-2 rounded-full ${blinkDetected ? "bg-green-400" : "bg-blue-400"} animate-pulse`} />
                                {livenessStatus}
                            </>
                        ) : (
                            <>
                                <div className="animate-spin border-2 border-t-white border-white/20 h-4 rounded-full w-4" />
                                Loading AI Models...
                            </>
                        )}
                    </div>
                )}

                {/* Result overlay */}
                {lastScanResult && (
                    <div className={`absolute top-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-xl shadow-2xl backdrop-blur-md border-2 animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-4 ${
                        lastScanResult.status === "success"
                            ? "bg-green-500/90 border-green-400 text-white"
                            : lastScanResult.status === "warning"
                                ? "bg-yellow-500/90 border-yellow-400 text-white"
                                : "bg-red-500/90 border-red-400 text-white"
                    }`}>
                        <div className="bg-white/20 p-2 rounded-full">
                            {lastScanResult.status === "success" ? <UserCheck size={32} /> :
                                lastScanResult.status === "warning" ? <Clock size={32} /> : <AlertCircle size={32} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-xl">
                                {lastScanResult.status === "success" ? "Access Granted" :
                                    lastScanResult.status === "warning" ? "Already Marked" : "Access Denied"}
                            </h3>
                            <p className="font-medium text-sm text-white/90">
                                {lastScanResult.employee ? `Welcome, ${lastScanResult.employee}` : lastScanResult.message}
                            </p>
                            {lastScanResult.time && <p className="mt-1 opacity-80 text-xs">{lastScanResult.time}</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Control Bar */}
            <div className="bg-gray-800 flex items-center justify-between p-4 z-10">
                <div className="text-white">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400" /> Attendance Kiosk
                    </h2>
                    <p className="text-gray-400 text-xs">Position your face · Blink to scan</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setAutoMode(!autoMode)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            autoMode ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                    >
                        {autoMode ? "Auto-Scan ON" : "Auto-Scan OFF"}
                    </button>

                    <button
                        onClick={() => setFacingMode(p => p === "user" ? "environment" : "user")}
                        className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg text-gray-300 transition-colors"
                        title="Switch Camera"
                    >
                        <SwitchCamera size={20} />
                    </button>

                    {!autoMode && (
                        <button
                            onClick={captureAndScan}
                            disabled={scanning}
                            className="bg-green-600 disabled:opacity-50 flex gap-2 hover:bg-green-700 items-center px-6 py-2 rounded-lg text-white"
                        >
                            <Camera size={20} /> Scan Now
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes scan-y {
                    0%   { top: 0%;   opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-y { animation: scan-y 3s linear infinite; position: absolute; }
            `}</style>
        </div>
    );
}
