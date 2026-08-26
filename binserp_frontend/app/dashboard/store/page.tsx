"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePermission } from "@/src/hooks/usePermission";

const STORE_TAB_ROUTES = [
  { id: "inventory", href: "/dashboard/store/inventory/rm-bo-stock" },
  { id: "wip", href: "/dashboard/store/wip/requests" },
  { id: "purchase", href: "/dashboard/store/purchase/po" },
  { id: "sales", href: "/dashboard/store/sales/orders" },
  { id: "masters", href: "/dashboard/store/masters/vendors" },
];

function StoreRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasTabAccess, userType } = usePermission();

  useEffect(() => {
    const isFullAdmin = userType === "saasadmin" || userType === "company";
    const tabParam = searchParams.get("tab");

    if (tabParam) {
      if ((tabParam === "job-work" || tabParam === "jobwork" || tabParam === "wip" || tabParam === "material-issue") && (isFullAdmin || hasTabAccess("Store", "wip"))) {
        router.replace(tabParam.includes("job") ? "/dashboard/store/wip/job-work" : "/dashboard/store/wip/requests");
        return;
      }
      if ((tabParam === "purchase" || tabParam === "po" || tabParam === "mrp") && (isFullAdmin || hasTabAccess("Store", "purchase"))) {
        router.replace(tabParam === "mrp" ? "/dashboard/store/purchase/mrp" : "/dashboard/store/purchase/po");
        return;
      }
      if ((tabParam === "sales" || tabParam === "orders") && (isFullAdmin || hasTabAccess("Store", "sales"))) {
        router.replace("/dashboard/store/sales/orders");
        return;
      }
      if ((tabParam === "masters" || tabParam === "master") && (isFullAdmin || hasTabAccess("Store", "masters"))) {
        router.replace("/dashboard/store/masters/vendors");
        return;
      }
      if (tabParam === "inventory" && (isFullAdmin || hasTabAccess("Store", "inventory"))) {
        router.replace("/dashboard/store/inventory/rm-bo-stock");
        return;
      }
    }

    // Default: find first permitted tab
    const firstAllowed = STORE_TAB_ROUTES.find(t => isFullAdmin || hasTabAccess("Store", t.id));
    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      router.replace("/dashboard/store/inventory/rm-bo-stock");
    }
  }, [router, searchParams, hasTabAccess, userType]);

  return (
    <div className="p-12 flex justify-center items-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function StoreRootPage() {
  return (
    <Suspense fallback={
      <div className="p-12 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <StoreRedirectContent />
    </Suspense>
  );
}
