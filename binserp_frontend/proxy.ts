import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard"];

// Which departments can access each route prefix.
// Empty array = open to all authenticated users.
const departmentAccess: Record<string, string[]> = {
  "/dashboard/hr": ["HR", "HR EXECUTIVE", "HUMAN RESOURCES"],
  "/dashboard/store": [
    "STORE",
    "STORES",
    "STORE EXECUTIVE",
    "PURCHASE",
    "PURCHASE EXECUTIVE",
    "INVENTORY",
    "WAREHOUSE",
    "GENERAL STORE",
  ],
  "/dashboard/ppc": ["PPC", "PPC EXECUTIVE", "PRODUCTION", "MANUFACTURING"],
  "/dashboard/accounts": ["ACCOUNTS", "FINANCE", "ACCOUNTANT"],
  "/dashboard/reports": ["REPORTS"],
  "/dashboard/maintenance": ["MAINTENANCE", "ENGINEERING"],
  "/dashboard/quality": ["QUALITY", "QA", "QC", "QUALITY ASSURANCE", "QUALITY CONTROL"],
  "/dashboard/gate-entry": ["SECURITY", "GATE", "SECURITY GUARD"],
  "/dashboard/crm": ["CRM", "SALES", "MARKETING"],
  "/dashboard/material-requests": [], // open to all authenticated
};

// Departments with full access across all dashboards
const FULL_ACCESS_DEPTS = new Set([
  "CEO",
  "MD",
  "MANAGING DIRECTOR",
  "DIRECTOR",
  "GM",
  "GENERAL MANAGER",
  "MANAGER",
  "ADMIN",
  "SUPERADMIN",
  "ADMINISTRATOR",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("accessToken")?.value;
  const refreshToken =
    request.cookies.get("refreshToken")?.value ||
    request.cookies.get("saasAdminToken")?.value;
  const userType = request.cookies.get("userType")?.value;
  const department = (
    request.cookies.get("department")?.value || ""
  )
    .toUpperCase()
    .trim();

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // ── 1. Not authenticated → redirect to login ──────────────────────────────
  if (isProtected && !token && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isProtected) {
    // ── 2. Company admin / SaaS admin → admin section only ─────────────────
    if (userType === "company" || userType === "saasadmin") {
      if (
        pathname !== "/dashboard" &&
        !pathname.startsWith("/dashboard/admin")
      ) {
        return NextResponse.redirect(
          new URL("/dashboard/admin/overview", request.url)
        );
      }
      return NextResponse.next();
    }

    // ── 3. Employee type → allow all (dedicated employee section) ──────────
    if (userType === "employee") {
      return NextResponse.next();
    }

    // ── 4. Full-access departments (GM, Admin, CEO…) → allow everything ────
    if (!department || FULL_ACCESS_DEPTS.has(department)) {
      return NextResponse.next();
    }

    // ── 5. Restrict /dashboard/admin to company/saasadmin only ─────────────
    if (pathname.startsWith("/dashboard/admin")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // ── 6. Department-based access control ─────────────────────────────────
    for (const [route, allowedDepts] of Object.entries(departmentAccess)) {
      if (!pathname.startsWith(route)) continue;
      // Empty array means open to all authenticated users
      if (allowedDepts.length === 0) break;
      const isAllowed = allowedDepts.some(
        (allowed) =>
          department === allowed ||
          department.includes(allowed) ||
          allowed.includes(department)
      );
      if (!isAllowed) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      break;
    }
  }

  // ── Handle /login ─────────────────────────────────────────────────────────
  if (pathname.startsWith("/login")) {
    const isLogoutAttempt = request.nextUrl.searchParams.has("logout");
    if (isLogoutAttempt) {
      const response = NextResponse.next();
      response.cookies.delete("accessToken");
      response.cookies.delete("refreshToken");
      response.cookies.delete("saasAdminToken");
      response.cookies.delete("userType");
      response.cookies.delete("department");
      response.cookies.delete("displayName");
      return response;
    }

    if (token && !isLogoutAttempt) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
