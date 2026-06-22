/**
 * Centralized Application Configuration
 * 
 * Handles dynamic resolution of the API URL to support:
 * 1. Build-time Environment Variables (process.env.NEXT_PUBLIC_API_URL)
 * 2. Runtime Browser Hostname (for Docker deployments where env might be missing)
 * 3. Default Localhost Fallback
 */

export const getApiBaseUrl = () => {
    // 1. Priority: Local Development Override
    // If we're running locally, ignore the baked-in production URL from Docker
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        return `http://${window.location.hostname}:8000`;
    }

    // 2. Priority: Environment Variable (if explicitly set and not empty)
    if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined") {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // 3. Dynamic Runtime: Use current window hostname but port 8000
    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:8000`;
    }

    // 4. Fallback: Localhost (for server-side generated pages or local dev)
    return "http://localhost:8000";
};

export const API_BASE_URL = getApiBaseUrl();
