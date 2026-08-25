"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function QualityRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "incoming") {
      router.replace("/dashboard/quality/incoming");
    } else if (tab === "process") {
      router.replace("/dashboard/quality/process");
    } else if (tab === "jobwork" || tab === "jobwork-qc") {
      router.replace("/dashboard/quality/jobwork-qc");
    } else if (tab === "fg" || tab === "fg-qc") {
      router.replace("/dashboard/quality/fg-qc");
    } else if (tab === "master") {
      router.replace("/dashboard/quality/master");
    } else {
      router.replace("/dashboard/quality/overview");
    }
  }, [router, searchParams]);

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
