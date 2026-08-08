"use client";

import React, { useEffect } from 'react';
import PPCTabs from "../components/PPCTabs";
import PPCStoreTab from "../components/PPCStoreTab";
import { useHeader } from "@/src/context/HeaderContext";

export default function PPCOverviewPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Production Control", "Manage manufacturing, live shop floor status, and shop floor operations.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="overview" />

        <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Shop Floor Live Status</h2>
            <PPCStoreTab />
          </div>
        </div>
      </div>
    </div>
  );
}
