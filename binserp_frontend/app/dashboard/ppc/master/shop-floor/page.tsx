"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/src/components/LoadingSpinner";

export default function PPCShopFloorIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ppc/master/shop-floor/workstation");
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
