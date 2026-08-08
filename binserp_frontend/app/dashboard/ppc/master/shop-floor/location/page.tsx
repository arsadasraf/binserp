"use client";

import React, { useEffect } from "react";
import PPCTabs from "../../../components/PPCTabs";
import PPCMachinesTab from "../../../components/PPCMachinesTab";
import { PPCMasterSubNav } from "../../components/PPCMasterSubNav";
import { PPCShopFloorSubNav } from "../components/PPCShopFloorSubNav";
import { useHeader } from "@/src/context/HeaderContext";

export default function PPCShopFloorLocationPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Shop Floor Location Master", "Manage shop floor work areas, bays, machine locations, and cell positioning.");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="master" />

        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PPCMasterSubNav />
          <PPCShopFloorSubNav />

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
            <PPCMachinesTab initialTab="location" />
          </div>
        </div>
      </div>
    </div>
  );
}
