"use client";

import { API_BASE_URL } from "@/src/utils/config";

const BROWSER_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours for Web Browser
const APP_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days sliding for Installed App

const getCookieFlags = () => {
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  return `path=/; SameSite=Lax; ${isSecure ? "Secure" : ""}`;
};

export interface ClientDeviceHint {
  isStandaloneApp: boolean;
  deviceType: "Phone" | "Tablet" | "Desktop";
  os: string;
}

/**
 * Detects whether the user is logging in from an Installed App (PWA / Standalone / WebView / Electron)
 * or a Web Browser, and whether the device is a Phone, Tablet, or Desktop.
 */
export const detectClientDeviceInfo = (): ClientDeviceHint => {
  if (typeof window === "undefined") {
    return { isStandaloneApp: false, deviceType: "Desktop", os: "Unknown" };
  }

  const ua = window.navigator.userAgent || "";
  const isDisplayStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
    window.matchMedia?.("(display-mode: minimal-ui)")?.matches ||
    Boolean((window.navigator as any).standalone) ||
    document.referrer.includes("android-app://");

  const isNativeWrapper =
    Boolean((window as any).ReactNativeWebView) ||
    Boolean((window as any).Capacitor) ||
    Boolean((window as any).electron) ||
    /;\s*wv\)|electron|capacitor|reactnative/i.test(ua);

  const isStandaloneApp = Boolean(isDisplayStandalone || isNativeWrapper);

  let deviceType: "Phone" | "Tablet" | "Desktop" = "Desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    deviceType = "Tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|iemobile|opera mini/i.test(ua)) {
    deviceType = "Phone";
  }

  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/ipad|iphone|ipod/i.test(ua)) os = "iOS";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return {
    isStandaloneApp,
    deviceType,
    os,
  };
};

type PersistArgs = {
  token: string;
  refreshToken?: string;
  accessMode?: "App" | "Browser";
  userType: "company" | "user" | "employee" | "saasadmin";
  user?: Record<string, any>;
};

const setCookie = (name: string, value: string, maxAge = BROWSER_COOKIE_MAX_AGE) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; ${getCookieFlags()}`;
};

export const persistSession = ({ token, refreshToken, accessMode, userType, user }: PersistArgs) => {
  if (typeof window === "undefined") return;

  const detected = detectClientDeviceInfo();
  const resolvedMode = accessMode || user?.deviceInfo?.accessMode || (detected.isStandaloneApp ? "App" : "Browser");
  const cookieMaxAge = resolvedMode === "App" ? APP_COOKIE_MAX_AGE : BROWSER_COOKIE_MAX_AGE;

  localStorage.setItem("userType", userType);
  localStorage.setItem("token", token);
  localStorage.setItem("accessMode", resolvedMode);
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }

  if (user) {
    localStorage.setItem("userInfo", JSON.stringify(user));
    if (user.department) {
      setCookie("department", user.department, cookieMaxAge);
    } else {
      document.cookie = `department=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${getCookieFlags()}`;
    }
    if (user.name || user.companyName) {
      setCookie("displayName", user.name || user.companyName, cookieMaxAge);
    }

    // Persist role-authorized modules cookie so Edge proxy/middleware respects RBAC roles
    const roles = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : user.role
      ? [user.role]
      : [];
    let isFullRole = false;
    const modSet = new Set<string>();
    roles.forEach((r: any) => {
      if (!r || r.isActive === false) return;
      const rName = typeof r === "string" ? r.trim() : (r.name || "").trim();
      const isDefaultRole = typeof r === "object" ? r?.isDefault !== false : true;
      if ((rName === "GM" || rName === "Admin Default Role" || rName === "Company Management") && isDefaultRole) {
        isFullRole = true;
      }
      if (typeof r === "object" && Array.isArray(r.policies)) {
        r.policies.forEach((p: any) => {
          if (p?.module) modSet.add(String(p.module).toUpperCase().trim());
        });
      }
    });
    const allowedModulesValue = isFullRole ? "ALL" : Array.from(modSet).join(",");
    if (allowedModulesValue) {
      setCookie("allowedModules", allowedModulesValue, cookieMaxAge);
    } else {
      document.cookie = `allowedModules=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${getCookieFlags()}`;
    }
  }

  setCookie("userType", userType, cookieMaxAge);
  setCookie("accessToken", token, cookieMaxAge);
};

export const updateRefreshedTokens = (newToken: string, newRefreshToken?: string, accessMode?: string) => {
  if (typeof window === "undefined" || !newToken) return;
  const resolvedMode = accessMode || localStorage.getItem("accessMode") || "Browser";
  const cookieMaxAge = resolvedMode === "App" ? APP_COOKIE_MAX_AGE : BROWSER_COOKIE_MAX_AGE;

  localStorage.setItem("token", newToken);
  if (newRefreshToken) {
    localStorage.setItem("refreshToken", newRefreshToken);
  }
  setCookie("accessToken", newToken, cookieMaxAge);
};

export const clearSession = async () => {
  if (typeof window === "undefined") return;

  const currentToken = localStorage.getItem("token") || localStorage.getItem("refreshToken") || "";

  // Clear LocalStorage & SessionStorage
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("accessMode");
  localStorage.removeItem("userType");
  localStorage.removeItem("userInfo");
  try {
    sessionStorage.clear();
  } catch (e) {}

  // Delete all known client-accessible cookies across multiple path/domain variations
  const keys = [
    "token",
    "userType",
    "department",
    "allowedModules",
    "displayName",
    "accessToken",
    "refreshToken",
    "saasAdminToken",
  ];

  const isSecure = window.location.protocol === "https:";
  keys.forEach((name) => {
    document.cookie = `${name}=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; ${isSecure ? "Secure;" : ""}`;
    document.cookie = `${name}=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${isSecure ? "Secure;" : ""}`;
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error("Backend logout failed:", err);
  }
};
