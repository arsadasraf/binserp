"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PPCOverviewRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ppc/overview/workstations");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );
}
