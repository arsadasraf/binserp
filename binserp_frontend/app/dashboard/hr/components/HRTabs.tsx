"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHeader } from "@/src/context/HeaderContext";
import { usePermission } from "@/src/hooks/usePermission";

import { Home, Database, UserCheck, Banknote, ScanFace, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

interface HRTabsProps {
    activeTab?: string;
}

export default function HRTabs({ activeTab }: HRTabsProps) {
    const { showBottomNav } = useHeader();
    const pathname = usePathname();
    const { hasTabAccess, userType } = usePermission();

    const allTabs = [
        { id: "home", key: "overview", label: "Overview", icon: Home, href: "/dashboard/hr/overview" },
        { id: "attendance", key: "kiosk", label: "Kiosk", icon: ScanFace, href: "/dashboard/hr/kiosk" },
        { id: "present", key: "present", label: "Present", icon: ClipboardList, href: "/dashboard/hr/present" },
        { id: "salaries", key: "salaries", label: "Salaries", icon: Banknote, href: "/dashboard/hr/salaries" },
        { id: "master", key: "masters", label: "Masters", icon: Database, href: "/dashboard/hr/master/employee" },
    ];

    // Filter based on user's granted HR tabs
    const tabs = allTabs.filter(tab => {
        if (userType === "saasadmin" || userType === "company") return true;
        return hasTabAccess("HR", tab.key) || hasTabAccess("HR", tab.id);
    });


    return (
        <>
            {/* Desktop View: Modern Floating Tabs */}
            <div className="hidden md:flex mb-6 items-center overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit">
                {tabs.map((tab) => {
                    const isActive = (tab.id === "master" ? pathname.startsWith("/dashboard/hr/master") : pathname.startsWith(tab.href)) || (pathname === "/dashboard/hr" && tab.id === "home") || activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 ${
                                isActive
                                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            }`}
                        >
                            <Icon size={15} className={isActive ? "text-white" : "text-slate-500 dark:text-slate-400"} />
                            <span>{tab.label}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Mobile View: Glassmorphic Bottom Bar */}
            <div className={`md:hidden fixed bottom-4 left-4 right-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-2xl rounded-2xl z-[100] flex justify-around py-3 px-6 safe-area-pb transition-all duration-300 ${showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
                {tabs.map((tab) => {
                    const isActive = (tab.id === "master" ? pathname.startsWith("/dashboard/hr/master") : pathname.startsWith(tab.href)) || (pathname === "/dashboard/hr" && tab.id === "home") || activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive
                                ? "text-blue-600 dark:text-blue-400 scale-110"
                                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                        >
                            <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? "bg-blue-50 dark:bg-blue-900/30 shadow-inner" : "bg-transparent"}`}>
                                <Icon size={20} className={isActive ? "stroke-blue-600 dark:stroke-blue-400 stroke-[2.5px]" : "stroke-current"} />
                            </div>
                            {isActive && (
                                <motion.span
                                    layoutId="activeTabLabelHR"
                                    className="text-[10px] font-bold tracking-tight"
                                >
                                    {tab.label}
                                </motion.span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </>
    );
}
