"use client";

import React, { useEffect } from "react";
import GateEntryTabs from "./components/GateEntryTabs";
import { useHeader } from "@/src/context/HeaderContext";

export default function GateEntryLayout({ children }: { children: React.ReactNode }) {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Gate Entry", "Manage visitors, vehicles, and security logs");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <GateEntryTabs />
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </div>
    </div>
  );
}
