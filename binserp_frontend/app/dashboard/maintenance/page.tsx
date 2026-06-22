"use client";

import { useState, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";

import MaintenanceOverview from "./components/MaintenanceOverview";
import BreakdownManagement from "./components/BreakdownManagement";
import PreventiveMaintenance from "./components/PreventiveMaintenance";
import SparePartsInventory from "./components/SparePartsInventory";
import MaintenanceMaster from "./components/MaintenanceMaster";
import MaintenanceTabs from "./components/MaintenanceTabs";

type Tab = "overview" | "detail" | "preventive" | "inventory" | "master";

export default function MaintenanceDashboard() {
    const { setHeader } = useHeader();
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        setHeader("Maintenance Hub", "Manage machine health, schedules, and spare parts.");
    }, [setHeader]);

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
            <div className="p-4 max-w-[1600px] mx-auto">
                {/* Tab Navigation */}
                <MaintenanceTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* Content Area */}
                <div className="mt-4">
                    {activeTab === "overview" && <MaintenanceOverview />}
                    {activeTab === "detail" && <BreakdownManagement />}
                    {activeTab === "preventive" && <PreventiveMaintenance />}
                    {activeTab === "inventory" && <SparePartsInventory />}
                    {activeTab === "master" && <MaintenanceMaster />}
                </div>
            </div>
        </div>
    );
}
