"use client";

import type { ReactNode } from "react";
import StoreTabs from "@/src/features/store/components/tabs/StoreTabs";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50/50 dark:bg-slate-950">
      <div className="px-3 sm:px-5 pt-2 sm:pt-2.5 pb-1 shrink-0">
        <StoreTabs />
      </div>
      <div className="flex-1 min-h-0 px-3 sm:px-5 pb-3 sm:pb-3.5 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
