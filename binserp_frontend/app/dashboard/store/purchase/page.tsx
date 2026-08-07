"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PurchaseRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/store/purchase/po");
  }, [router]);

  return (
    <div className="p-12 flex justify-center items-center">
      <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
