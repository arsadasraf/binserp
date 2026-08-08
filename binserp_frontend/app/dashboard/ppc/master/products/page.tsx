"use client";

import React, { useEffect } from "react";
import PPCTabs from "../../components/PPCTabs";
import FGProductsTab from "../../components/FGProductsTab";
import { PPCMasterSubNav } from "../components/PPCMasterSubNav";
import { useHeader } from "@/src/context/HeaderContext";

export default function PPCProductsMasterPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("FG & Component Master", "Manage finished goods, sub-assemblies, raw component definitions, and process routings.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="master" />

        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PPCMasterSubNav />

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
            <FGProductsTab />
          </div>
        </div>
      </div>
    </div>
  );
}
