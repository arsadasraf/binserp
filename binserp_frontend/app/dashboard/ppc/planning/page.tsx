"use client";

import React, { useEffect } from 'react';
import PPCTabs from "../components/PPCTabs";
import PPCPlanningTab from "../components/PPCPlanningTab";
import { useHeader } from "@/src/context/HeaderContext";

export default function PPCPlanningPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Production Planning", "Machine job assignments, auto-planning, and scheduling board.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="planning" />

        <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PPCPlanningTab />
        </div>
      </div>
    </div>
  );
}
