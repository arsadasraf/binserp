"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import GateEntryTabs from "./components/GateEntryTabs";
import GateOverviewTab from "./components/GateOverviewTab";
import GateKioskTab from "./components/GateKioskTab";
import GateVisitorTab from "./components/GateVisitorTab";
import GateVehicleTab from "./components/GateVehicleTab";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useHeader } from "@/src/context/HeaderContext";

function GateEntryContent() {
    const searchParams = useSearchParams();
    const { setHeader } = useHeader();
    const activeTab = (searchParams.get("tab") as "overview" | "kiosk" | "visitor" | "vehicle") || "overview";

    useEffect(() => {
        setHeader("Gate Entry", "Manage visitors, vehicles, and security logs");
    }, [setHeader]);

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
            <div className="p-4 max-w-[1600px] mx-auto">

                <GateEntryTabs activeTab={activeTab} />

                <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === "overview" && <GateOverviewTab />}
                    {activeTab === "kiosk" && <GateKioskTab />}
                    {activeTab === "visitor" && <GateVisitorTab />}
                    {activeTab === "vehicle" && <GateVehicleTab />}
                </div>
            </div>
        </div>
    );
}

export default function GateEntryPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <GateEntryContent />
        </Suspense>
    );
}
