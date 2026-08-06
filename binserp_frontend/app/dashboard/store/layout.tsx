"use client";

import type { ReactNode } from "react";
import StoreTabs from "@/src/features/store/components/tabs/StoreTabs";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <div className="hidden md:block px-6 py-4">
        <StoreTabs />
      </div>
      <div className="md:hidden">
        <StoreTabs />
      </div>
      <div className="flex-1 overflow-auto px-2 md:px-6 pb-24 md:pb-6 pt-2 md:pt-0">
        {children}
      </div>
    </div>
  );
}
