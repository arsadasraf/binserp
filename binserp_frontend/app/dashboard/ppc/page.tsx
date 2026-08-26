"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePermission } from "@/src/hooks/usePermission";

const PPC_TAB_ROUTES = [
  { id: "overview", href: "/dashboard/ppc/overview" },
  { id: "orders", href: "/dashboard/ppc/orders" },
  { id: "planning", href: "/dashboard/ppc/planning" },
  { id: "tracing", href: "/dashboard/ppc/tracing" },
  { id: "masters", href: "/dashboard/ppc/master/shop-floor/workstation" },
];

function PPCRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasTabAccess, userType } = usePermission();

  useEffect(() => {
    const isFullAdmin = userType === "saasadmin" || userType === "company";
    const tabParam = searchParams.get("tab");

    if (tabParam) {
      if (tabParam === "orders" && (isFullAdmin || hasTabAccess("PPC", "orders"))) {
        router.replace("/dashboard/ppc/orders");
        return;
      }
      if (tabParam === "planning" && (isFullAdmin || hasTabAccess("PPC", "planning"))) {
        router.replace("/dashboard/ppc/planning");
        return;
      }
      if ((tabParam === "tracing" || tabParam === "trace") && (isFullAdmin || hasTabAccess("PPC", "tracing"))) {
        router.replace("/dashboard/ppc/tracing");
        return;
      }
      if ((tabParam === "masters" || tabParam === "master") && (isFullAdmin || hasTabAccess("PPC", "masters"))) {
        router.replace("/dashboard/ppc/master/shop-floor/workstation");
        return;
      }
      if (tabParam === "overview" && (isFullAdmin || hasTabAccess("PPC", "overview"))) {
        router.replace("/dashboard/ppc/overview");
        return;
      }
    }

    // Default: find first permitted tab
    const firstAllowed = PPC_TAB_ROUTES.find(t => isFullAdmin || hasTabAccess("PPC", t.id));
    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      router.replace("/dashboard/ppc/overview");
    }
  }, [router, searchParams, hasTabAccess, userType]);

  return (
    <div className="p-12 flex justify-center items-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function PPCIndexPage() {
  return (
    <Suspense fallback={
      <div className="p-12 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PPCRedirectContent />
    </Suspense>
  );
}
