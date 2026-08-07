"use client";

import React, { useEffect } from "react";
import HRTabs from "./components/HRTabs";
import { useHeader } from "@/src/context/HeaderContext";

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("HR Dashboard", "Manage employees, departments, and attendance");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-20 sm:pb-8">
      <div className="p-2 max-w-[1600px] mx-auto">
        <HRTabs />
        <div className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </div>
    </div>
  );
}
