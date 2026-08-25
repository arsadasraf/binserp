"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import QualityTabs from "./components/QualityTabs";

export default function QualityLayout({ children }: { children: ReactNode }) {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Quality Assurance & Control", "Manage Inward SCN, In-Process QC, Finished Goods PDI, and Testing Standards.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 sm:pb-8">
      <div className="p-3 sm:p-4 max-w-[1600px] mx-auto space-y-4">
        {/* URL Route-Based Quality Navigation Tabs */}
        <QualityTabs />

        {/* Active Route Content Area */}
        <div className="bg-transparent min-h-[600px]">
          {children}
        </div>
      </div>
    </div>
  );
}
