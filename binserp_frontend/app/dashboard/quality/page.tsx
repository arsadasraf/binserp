"use client";

import { useState, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import { motion, AnimatePresence } from "framer-motion";

import QualityOverview from "./components/QualityOverview";
import IncomingQC from "./components/IncomingQC";
import ProcessQC from "./components/ProcessQC";
import QualityMaster from "./components/QualityMaster";
import QualityTabs from "./components/QualityTabs";

type Tab = "overview" | "incoming" | "process" | "master";

export default function QualityDashboard() {
    const { setHeader } = useHeader();
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        setHeader("Quality Control", "Manage Inspection Standards, Incoming Material and Process Quality.");
    }, [setHeader]);

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
            <div className="p-4 max-w-[1600px] mx-auto space-y-6">
                {/* Tab Navigation */}
                <QualityTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* Content Area */}
                <div className="bg-transparent min-h-[600px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {activeTab === "overview" && <QualityOverview />}
                            {activeTab === "incoming" && <IncomingQC />}
                            {activeTab === "process" && <ProcessQC />}
                            {activeTab === "master" && <QualityMaster />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
