"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePermission } from "@/src/hooks/usePermission";

const HR_TAB_ROUTES = [
  { id: "overview", href: "/dashboard/hr/overview" },
  { id: "kiosk", href: "/dashboard/hr/kiosk" },
  { id: "present", href: "/dashboard/hr/present" },
  { id: "salaries", href: "/dashboard/hr/salaries" },
  { id: "masters", href: "/dashboard/hr/master/employee" },
];

function HRRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasTabAccess, userType } = usePermission();

  useEffect(() => {
    const isFullAdmin = userType === "saasadmin" || userType === "company";
    const tabParam = searchParams.get("tab");

    if (tabParam) {
      if ((tabParam === "kiosk" || tabParam === "attendance") && (isFullAdmin || hasTabAccess("HR", "kiosk"))) {
        router.replace("/dashboard/hr/kiosk");
        return;
      }
      if (tabParam === "present" && (isFullAdmin || hasTabAccess("HR", "present"))) {
        router.replace("/dashboard/hr/present");
        return;
      }
      if ((tabParam === "salaries" || tabParam === "payroll") && (isFullAdmin || hasTabAccess("HR", "salaries"))) {
        router.replace("/dashboard/hr/salaries");
        return;
      }
      if ((tabParam === "masters" || tabParam === "master") && (isFullAdmin || hasTabAccess("HR", "masters"))) {
        router.replace("/dashboard/hr/master/employee");
        return;
      }
      if ((tabParam === "overview" || tabParam === "home") && (isFullAdmin || hasTabAccess("HR", "overview"))) {
        router.replace("/dashboard/hr/overview");
        return;
      }
    }

    // Default: find first permitted tab
    const firstAllowed = HR_TAB_ROUTES.find(t => isFullAdmin || hasTabAccess("HR", t.id));
    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      router.replace("/dashboard/hr/overview");
    }
  }, [router, searchParams, hasTabAccess, userType]);

  return (
    <div className="p-12 flex justify-center items-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function HRRootPage() {
  return (
    <Suspense fallback={
      <div className="p-12 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <HRRedirectContent />
    </Suspense>
  );
}
