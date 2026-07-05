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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const userType = request.cookies.get("userType")?.value;
  const department = request.cookies.get("department")?.value;

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isProtected && userType !== "company") {
    if (department === "CEO" || department === "MD") {
      // CEO and MD have full access, bypass restrictions
    } else {
      for (const [route, allowedDepartments] of Object.entries(departmentAccess)) {
        if (pathname.startsWith(route) && department && !allowedDepartments.includes(department)) {
          return NextResponse.redirect(new URL("/dashboard/reports", request.url));
        }
      }
      
      // Admin should only access /dashboard and /dashboard/admin
      if (pathname.startsWith("/dashboard/admin") && department !== "Admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  if (pathname.startsWith("/login") && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};


