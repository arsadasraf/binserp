"use client";

import { useState, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Users, Target, Calendar } from "lucide-react";

// Components
import CRMOverview from "./components/CRMOverview";
import LeadKanban from "./components/LeadKanban";
import CustomerDirectory from "./components/CustomerDirectory";
import ActivitiesLog from "./components/ActivitiesLog";

type Tab = "overview" | "leads" | "customers" | "activities";

export default function CRMDashboard() {
    const { setHeader } = useHeader();
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        setHeader("CRM", "Manage Leads, Customers and Sales Pipeline.");
    }, [setHeader]);

    const tabs = [
        { id: "overview", label: "Overview", icon: BarChart3 },
        { id: "leads", label: "Leads Pipeline", icon: Target },
        { id: "customers", label: "Customers", icon: Users },
        { id: "activities", label: "Activities", icon: Calendar },
    ];

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex flex-wrap gap-2 w-fit mx-auto md:mx-0 sticky top-4 z-30">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`
                                relative flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                                ${activeTab === tab.id
                                    ? "text-white shadow-md scale-105"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                                }
                            `}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="activeTabCRM"
                                    className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${activeTab === tab.id ? "text-white" : "text-current"}`} />
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>

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
                        {activeTab === "overview" && <CRMOverview />}
                        {activeTab === "leads" && <LeadKanban />}
                        {activeTab === "customers" && <CustomerDirectory />}
                        {activeTab === "activities" && <ActivitiesLog />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
