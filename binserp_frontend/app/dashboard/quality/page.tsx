"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePermission } from "@/src/hooks/usePermission";
import { QUALITY_TABS } from "./components/QualityTabs";

function QualityRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasTabAccess, userType } = usePermission();

  useEffect(() => {
    const isFullAdmin = userType === "saasadmin" || userType === "company";
    const tabParam = searchParams.get("tab");

    // Map query param to tab ID
    let targetTabId = "";
    if (tabParam === "incoming") targetTabId = "incoming";
    else if (tabParam === "process") targetTabId = "process";
    else if (tabParam === "jobwork" || tabParam === "jobwork-qc") targetTabId = "jobwork-qc";
    else if (tabParam === "fg" || tabParam === "fg-qc") targetTabId = "fg-qc";
    else if (tabParam === "master") targetTabId = "master";
    else if (tabParam === "overview") targetTabId = "overview";

    if (targetTabId && (isFullAdmin || hasTabAccess("Quality", targetTabId))) {
      const found = QUALITY_TABS.find(t => t.id === targetTabId);
      if (found) {
        router.replace(found.href);
        return;
      }
    }

    // Default: find first permitted tab
    const firstAllowed = QUALITY_TABS.find(t => isFullAdmin || hasTabAccess("Quality", t.id));
    if (firstAllowed) {
      router.replace(firstAllowed.href);
    } else {
      router.replace("/dashboard/quality/overview");
    }
  }, [router, searchParams, hasTabAccess, userType]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-pulse text-sm font-semibold text-slate-500">
        Loading Quality Dashboard...
      </div>
    </div>
  );
}

export default function QualityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading...</div>}>
      <QualityRedirectContent />
    </Suspense>
  );
}
