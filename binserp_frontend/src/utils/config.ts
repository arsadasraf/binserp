/**
 * Centralized Application Configuration
 * 
 * Handles dynamic resolution of the API URL to support:
 * 1. Build-time Environment Variables (process.env.NEXT_PUBLIC_API_URL)
 * 2. Runtime Browser Hostname (for Docker deployments where env might be missing)
 * 3. Default Localhost Fallback
 */

export const getApiBaseUrl = () => {
    // 1. In browser runtime:
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        // Local machine development
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return `http://${hostname}:8000`;
        }
        // Local network access (LAN / Wi-Fi / Hotspot / VM)
        if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
            return `${window.location.protocol}//${hostname}:8000`;
        }
        // Production domain override (if explicitly configured and not localhost)
        if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined" && !process.env.NEXT_PUBLIC_API_URL.includes("localhost")) {
            return process.env.NEXT_PUBLIC_API_URL;
        }
        return `${window.location.protocol}//${hostname}:8000`;
    }

    // 2. Server-side / Build-time fallback
    if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined") {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    return "http://localhost:8000";
};

export const API_BASE_URL = getApiBaseUrl();
