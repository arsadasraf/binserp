"use client";

import { useState, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
    BarChart3, Users, Target, Calendar, DollarSign, 
    FileSpreadsheet, Zap, Layers 
} from "lucide-react";

// Modern CRM Tab Components
import CRMOverview from "./components/CRMOverview";
import LeadKanban from "./components/LeadKanban";
import DealsPipeline from "./components/DealsPipeline";
import CustomerDirectory from "./components/CustomerDirectory";
import ActivitiesLog from "./components/ActivitiesLog";
import CRMDataHub from "./components/CRMDataHub";
import CRMIntegrationsHub from "./components/CRMIntegrationsHub";
import CRMMastersManager from "./components/CRMMastersManager";

type Tab = "overview" | "leads" | "deals" | "customers" | "activities" | "datahub" | "integrations" | "masters";

export default function CRMDashboard() {
    const { setHeader } = useHeader();
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        setHeader("CRM & Sales", "Lead Ingestion, Deals Pipeline, Customer 360 & Integrations");
    }, [setHeader]);

    const tabs = [
        { id: "overview", label: "Overview", icon: BarChart3 },
        { id: "leads", label: "Leads Pipeline", icon: Target },
        { id: "deals", label: "Deals & Revenue", icon: DollarSign },
        { id: "customers", label: "Customer 360", icon: Users },
        { id: "activities", label: "Follow-ups & Tasks", icon: Calendar },
        { id: "datahub", label: "Data Hub (Excel)", icon: FileSpreadsheet },
        { id: "integrations", label: "Integrations & API", icon: Zap },
        { id: "masters", label: "CRM Masters", icon: Layers },
    ];

    return (
        <div className="space-y-6 pb-12">
            
            {/* Sliding Sub-tab Navigation Bar */}
            <div className="overflow-x-auto no-scrollbar py-1">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-700 p-1.5 flex gap-1.5 w-max mx-auto md:mx-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`
                                    relative flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0
                                    ${isActive
                                        ? "text-white shadow-md shadow-blue-600/20"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50"
                                    }
                                `}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabCRM"
                                        className="absolute inset-0 bg-blue-600 rounded-xl"
                                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5">
                                    <Icon size={14} className={isActive ? "text-white" : "text-current"} />
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-Tab Dynamic Views */}
            <div className="min-h-[650px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                    >
                        {activeTab === "overview" && <CRMOverview />}
                        {activeTab === "leads" && <LeadKanban />}
                        {activeTab === "deals" && <DealsPipeline />}
                        {activeTab === "customers" && <CustomerDirectory />}
                        {activeTab === "activities" && <ActivitiesLog />}
                        {activeTab === "datahub" && <CRMDataHub />}
                        {activeTab === "integrations" && <CRMIntegrationsHub />}
                        {activeTab === "masters" && <CRMMastersManager />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
