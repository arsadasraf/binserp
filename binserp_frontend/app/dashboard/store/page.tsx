"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function StoreRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "job-work" || tab === "jobwork") {
      router.replace("/dashboard/store/wip/job-work");
    } else if (tab === "wip" || tab === "material-issue") {
      router.replace("/dashboard/store/wip/requests");
    } else {
      router.replace("/dashboard/store/inventory/rm-bo-stock");
    }
  }, [router, searchParams]);

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
