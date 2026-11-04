import jwt from "jsonwebtoken";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parses request headers & client hints to identify:
 * - deviceType: "Phone" | "Tablet" | "Desktop"
 * - accessMode: "App" | "Browser"
 * - categoryLabel: "Phone App" | "Phone Browser" | "Tablet App" | "Tablet Browser" | "Desktop App" | "Desktop Browser"
 * - os, browser, summary, ipAddress, loggedInAt
 */
export const parseDeviceInfo = (req) => {
  const ua = String(req?.headers?.["user-agent"] || "");
  const clientInfo = req?.body?.clientInfo || {};
  const headerMode = String(req?.headers?.["x-client-mode"] || "").toLowerCase();

  // 1. Detect Operating System
  let os = "Unknown OS";
  if (/windows nt 10\.0/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) {
    const match = ua.match(/Android\s+([\d.]+)/i);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (/ipad|iphone|ipod/i.test(ua)) {
    const match = ua.match(/OS\s+([\d_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS";
  } else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (clientInfo.os) os = String(clientInfo.os);

  // 2. Detect Device Type (Phone / Tablet / Desktop)
  let deviceType = "Desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    deviceType = "Tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|iemobile|opera mini/i.test(ua)) {
    deviceType = "Phone";
  } else if (clientInfo.deviceType && ["Phone", "Tablet", "Desktop"].includes(clientInfo.deviceType)) {
    deviceType = clientInfo.deviceType;
  }

  // 3. Detect Access Mode (App vs. Browser)
  const isAndroidWebView = /;\s*wv\)/i.test(ua) || (/android/i.test(ua) && /version\/[\d.]+/i.test(ua) && /chrome\/[\d.]+/i.test(ua));
  const isIOSWebView = /(iphone|ipod|ipad)/i.test(ua) && !/safari/i.test(ua);
  const isDesktopWrapper = /electron|capacitor|reactnative|binserp/i.test(ua);
  const isStandalonePWA = Boolean(clientInfo.isStandaloneApp) || headerMode === "app";

  const accessMode = (isStandalonePWA || isAndroidWebView || isIOSWebView || isDesktopWrapper)
    ? "App"
    : "Browser";

  // 4. Detect Browser / Runtime Name
  let browser = accessMode === "App" ? "Installed App" : "Browser";
  if (/edg\//i.test(ua)) browser = accessMode === "App" ? "Edge App" : "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/chrome|crios/i.test(ua)) browser = accessMode === "App" ? "Chrome App" : "Chrome";
  else if (/safari/i.test(ua)) browser = accessMode === "App" ? "Safari App" : "Safari";

  const categoryLabel = `${deviceType} ${accessMode}`;
  const summary = `${categoryLabel} • ${browser} on ${os}`;
  const rawIp = req?.headers?.["x-forwarded-for"] || req?.ip || req?.socket?.remoteAddress || "Unknown";
  const ipAddress = String(rawIp).split(",")[0].trim();

  return {
    deviceType,
    accessMode,
    categoryLabel,
    os,
    browser,
    summary,
    ipAddress,
    loggedInAt: new Date(),
  };
};

export const generateTokens = (id, type, companyId = null, tokenVersion = 0, accessMode = "Browser") => {
  const isApp = accessMode === "App";
  const payload = { id, type, tokenVersion, accessMode: isApp ? "App" : "Browser" };
  if (companyId) {
    payload.companyId = companyId;
  }

  // App mode: 30d access token + 365d sliding refresh token (permanent until logout or another device login)
  // Browser mode: 24h access token + 24h refresh token (strict 24-hour max expiry on browsers)
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: isApp ? "30d" : "24h",
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, {
    expiresIn: isApp ? "365d" : "24h",
  });

  return { accessToken, refreshToken };
};

export const setTokenCookies = (res, accessToken, refreshToken, accessMode = "Browser") => {
  const isApp = accessMode === "App";
  const accessMaxAge = isApp ? 30 * DAY_MS : 1 * DAY_MS;
  const refreshMaxAge = isApp ? 365 * DAY_MS : 1 * DAY_MS;

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
};

