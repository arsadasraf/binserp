"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";

function getPrimaryLandingPage(userType: string | null, roles: any[], department: string | null = ""): string {
  if (userType === "company" || userType === "saasadmin") {
    return "/dashboard/admin/overview";
  }

  if (userType === "employee") {
    return "/dashboard/employee?tab=work";
  }

  // Check roles array for Users / Staff
  if (roles && Array.isArray(roles) && roles.length > 0) {
    let isGM = false;
    const allowedModules = new Set<string>();

    roles.forEach((r) => {
      if (!r) return;
      const roleName = typeof r === "string" ? r : r.name;
      if (roleName === "GM" || roleName === "Admin Default Role" || roleName === "Company Management") {
        isGM = true;
      }
      if (typeof r === "object" && Array.isArray(r.policies)) {
        r.policies.forEach((p: any) => {
          if (p && p.module && p.module !== "Admin") {
            allowedModules.add(p.module.toUpperCase());
          }
        });
      }
    });

    // GM has access to all operational modules. Land GM on HR Home.
    if (isGM) {
      return "/dashboard/hr?tab=home";
    }

    if (allowedModules.has("MATERIALREQUESTS")) {
      return "/dashboard/material-requests";
    }
    if (allowedModules.has("HR")) {
      return "/dashboard/hr?tab=home";
    }
    if (allowedModules.has("STORE")) {
      return "/dashboard/store/inventory/rm-bo-stock";
    }
    if (allowedModules.has("PPC")) {
      return "/dashboard/ppc/overview";
    }
    if (allowedModules.has("SECURITY")) {
      return "/dashboard/gate-entry?tab=overview";
    }
    if (allowedModules.has("ACCOUNTS")) {
      return "/dashboard/accounts";
    }
    if (allowedModules.has("MAINTENANCE")) {
      return "/dashboard/maintenance";
    }
    if (allowedModules.has("QUALITY")) {
      return "/dashboard/quality";
    }
    if (allowedModules.has("CRM")) {
      return "/dashboard/crm";
    }
    if (allowedModules.has("REPORTS")) {
      return "/dashboard/reports";
    }
  }

  // Fallback by department string (GM / staff land on operational modules)
  const upperDept = (department || "").toUpperCase();
  if (upperDept.includes("HR")) {
    return "/dashboard/hr?tab=home";
  }
  if (upperDept.includes("STORE")) {
    return "/dashboard/store/inventory/rm-bo-stock";
  }
  if (upperDept.includes("PPC")) {
    return "/dashboard/ppc/overview";
  }
  if (upperDept.includes("SECURITY")) {
    return "/dashboard/gate-entry?tab=overview";
  }
  if (upperDept.includes("ACCOUNTS")) {
    return "/dashboard/accounts";
  }

  return "/dashboard/hr?tab=home";
}

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("userType");
    const userInfoStr = localStorage.getItem("userInfo");

    if (!token) {
      router.push("/login");
      return;
    }

    let department: string | null = null;
    let roles: any[] = [];

    if (userInfoStr) {
      try {
        const user = JSON.parse(userInfoStr);
        department = user.department || null;
        roles = user.roles || (user.role ? [user.role] : []);
      } catch (e) {
        console.error("Failed to parse userInfo for dashboard redirect", e);
      }
    }

    const targetRoute = getPrimaryLandingPage(userType, roles, department);
    router.replace(targetRoute);
  }, [router]);

  return (
    <div className="flex flex-col justify-center items-center h-[70vh] gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-gray-500 font-medium animate-pulse">Routing to module...</p>
    </div>
  );
}
