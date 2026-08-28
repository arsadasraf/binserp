import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/dashboard/admin",
  "/dashboard/hr",
  "/dashboard/store",
  "/dashboard/ppc",
  "/dashboard/accounts",
  "/dashboard/reports",
];

const departmentAccess: Record<string, string[]> = {
  "/dashboard/hr": ["HR", "HR Executive"],
  "/dashboard/store": ["Store", "Store Executive"],
  "/dashboard/ppc": ["PPC", "PPC Executive"],
  "/dashboard/accounts": ["Accounts"],
  "/dashboard/reports": ["Reports"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value || request.cookies.get("saasAdminToken")?.value;
  const userType = request.cookies.get("userType")?.value;
  const department = request.cookies.get("department")?.value;

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !token && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isProtected) {
    if (userType === "company") {
      if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/admin")) {
        return NextResponse.redirect(new URL("/dashboard/admin/overview", request.url));
      }
    } else {
      const upperDept = department?.toUpperCase();
      if (upperDept === "CEO" || upperDept === "MD" || upperDept === "MANAGER") {
        // CEO, MD and Manager have full access, bypass restrictions
      } else {
        for (const [route, allowedDepartments] of Object.entries(departmentAccess)) {
          const allowedUpper = allowedDepartments.map((d) => d.toUpperCase());
          if (pathname.startsWith(route) && upperDept && !allowedUpper.includes(upperDept)) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
        }

        // Admin should only access /dashboard and /dashboard/admin
        if (pathname.startsWith("/dashboard/admin") && upperDept !== "ADMIN") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    }
  }

  // Handle Login page route
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
