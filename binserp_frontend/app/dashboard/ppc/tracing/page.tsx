"use client";

import React, { useEffect } from 'react';
import PPCTabs from "../components/PPCTabs";
import PPCTraceTab from "../components/PPCTraceTab";
import { useHeader } from "@/src/context/HeaderContext";

export default function PPCTracingPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Production Traceability", "Trace each process, component, work order, and manufacturing order in real time.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="tracing" />

        <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PPCTraceTab />
        </div>
      </div>
    </div>
  );
}
