"use client";

const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours
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

  try {
    // Attempt to log out from backend (silently)
    // We use fetch directly since we just need a simple POST with credentials
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error("Backend logout failed:", err);
  }

  localStorage.removeItem("token");
  localStorage.removeItem("userType");
  localStorage.removeItem("userInfo");

  ["token", "userType", "department", "displayName"].forEach(deleteCookie);
  
  // Extra safety for new token names
  document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "saasAdminToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};


