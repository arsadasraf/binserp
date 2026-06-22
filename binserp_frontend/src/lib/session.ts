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

  localStorage.setItem("token", token);
  localStorage.setItem("userType", userType);

  if (user) {
    localStorage.setItem("userInfo", JSON.stringify(user));
    if (user.department) {
      setCookie("department", user.department);
    }
    if (user.name || user.companyName) {
      setCookie("displayName", user.name || user.companyName);
    }
  }

  setCookie("token", token);
  setCookie("userType", userType);
};

export const clearSession = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  localStorage.removeItem("userType");
  localStorage.removeItem("userInfo");

  ["token", "userType", "department", "displayName"].forEach(deleteCookie);
};


