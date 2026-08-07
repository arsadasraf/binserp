"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KioskRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/gate-entry/kiosk/manual");
  }, [router]);

  return (
    <div className="p-12 flex justify-center items-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
