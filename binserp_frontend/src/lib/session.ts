"use client";

const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours
const getCookieFlags = () => {
  const isSecure = window.location.protocol === "https:";
  return `path=/; SameSite=Lax; ${isSecure ? "Secure" : ""}`;
};

type PersistArgs = {
  token: string;
  userType: "company" | "user" | "employee";
  user?: Record<string, any>;
};

const setCookie = (name: string, value: string, maxAge = COOKIE_MAX_AGE) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; ${getCookieFlags()}`;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; max-age=0; ${getCookieFlags()}`;
};

export const persistSession = ({ token, userType, user }: PersistArgs) => {
  if (typeof window === "undefined") return;

  localStorage.setItem("userType", userType);
  localStorage.setItem("token", token);

  if (user) {
    localStorage.setItem("userInfo", JSON.stringify(user));
    if (user.department) {
      setCookie("department", user.department);
    }
    if (user.name || user.companyName) {
      setCookie("displayName", user.name || user.companyName);
    }
  }

  setCookie("userType", userType);
  setCookie("accessToken", token);
};

export const clearSession = async () => {
  if (typeof window === "undefined") return;

  // Clear LocalStorage & SessionStorage
  localStorage.removeItem("token");
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
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error("Backend logout failed:", err);
  }
};


