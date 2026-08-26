"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePermission } from "@/src/hooks/usePermission";

const GATE_TAB_ROUTES = [
  { id: "overview", href: "/dashboard/gate-entry/overview" },
  { id: "kiosk", href: "/dashboard/gate-entry/kiosk" },
  { id: "visitor", href: "/dashboard/gate-entry/visitor" },
  { id: "vehicle", href: "/dashboard/gate-entry/vehicle" },
  { id: "employee-movement", href: "/dashboard/gate-entry/employee-movement" },
];

function GateEntryRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasTabAccess, userType } = usePermission();

  useEffect(() => {
    const isFullAdmin = userType === "saasadmin" || userType === "company";
    const tabParam = searchParams.get("tab");

    if (tabParam) {
      if (tabParam === "kiosk" && (isFullAdmin || hasTabAccess("Security", "kiosk"))) {
        router.replace("/dashboard/gate-entry/kiosk");
        return;
      }
      if (tabParam === "visitor" && (isFullAdmin || hasTabAccess("Security", "visitor"))) {
        router.replace("/dashboard/gate-entry/visitor");
        return;
      }
      if (tabParam === "vehicle" && (isFullAdmin || hasTabAccess("Security", "vehicle"))) {
        router.replace("/dashboard/gate-entry/vehicle");
        return;
      }
      if ((tabParam === "employee-movement" || tabParam === "movement") && (isFullAdmin || hasTabAccess("Security", "employee-movement"))) {
        router.replace("/dashboard/gate-entry/employee-movement");
        return;
      }
      if (tabParam === "overview" && (isFullAdmin || hasTabAccess("Security", "overview"))) {
        router.replace("/dashboard/gate-entry/overview");
        return;
      }
    }

    // Default: find first permitted tab
    const firstAllowed = GATE_TAB_ROUTES.find(t => isFullAdmin || hasTabAccess("Security", t.id));
    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      router.replace("/dashboard/gate-entry/overview");
    }
  }, [router, searchParams, hasTabAccess, userType]);

  return (
    <div className="p-12 flex justify-center items-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function GateEntryRootPage() {
  return (
    <Suspense fallback={
      <div className="p-12 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <GateEntryRedirectContent />
    </Suspense>
  );
}
