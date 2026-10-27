"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useHeader } from "@/src/context/HeaderContext";
import { usePermission } from "@/src/hooks/usePermission";

import { LayoutDashboard, ScanFace, Users, Truck, LogOut } from "lucide-react";
import { motion } from "framer-motion";

interface GateEntryTabsProps {
    activeTab?: string;
}

export default function GateEntryTabs({ activeTab }: GateEntryTabsProps) {
    const { showBottomNav } = useHeader();
    const pathname = usePathname();
    const { hasTabAccess, userType } = usePermission();

    const allTabs = [
        { id: "overview", key: "overview", label: "Overview", icon: LayoutDashboard, href: "/dashboard/gate-entry/overview" },
        { id: "kiosk", key: "kiosk", label: "Kiosk Mode", icon: ScanFace, href: "/dashboard/gate-entry/kiosk" },
        { id: "visitor", key: "visitor", label: "Visitor Log", icon: Users, href: "/dashboard/gate-entry/visitor" },
        { id: "vehicle", key: "vehicle", label: "Vehicle Log", icon: Truck, href: "/dashboard/gate-entry/vehicle" },
        { id: "employee-movement", key: "employee-movement", label: "Employee Movement", icon: LogOut, href: "/dashboard/gate-entry/employee-movement" },
    ];

    const tabs = allTabs.filter(tab => {
        if (userType === "saasadmin" || userType === "company") return true;
        return hasTabAccess("Security", tab.key) || hasTabAccess("Security", tab.id) || hasTabAccess("Gate-Entry", tab.key) || hasTabAccess("Gate-Entry", tab.id);
    });


    return (
        <>
            {/* Desktop View: Modern Floating Tabs */}
            <div className="hidden md:flex mb-6 items-center overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit">
                {tabs.map((tab) => {
                    const isActive = pathname.startsWith(tab.href) || (pathname === "/dashboard/gate-entry" && tab.id === "overview") || activeTab === tab.id;
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
            <div className={`md:hidden fixed bottom-4 left-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-slate-700/60 shadow-2xl rounded-2xl z-[100] flex justify-around py-3 px-2 safe-area-pb transition-all duration-300 ${showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 w-full ${isActive
                                ? "text-indigo-600 dark:text-indigo-400 scale-105"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                }`}
                        >
                            <div className={`p-2 rounded-2xl transition-all duration-200 ${isActive ? "bg-indigo-50 dark:bg-indigo-950/60 shadow-inner" : "bg-transparent"}`}>
                                <Icon size={20} className={isActive ? "stroke-indigo-600 dark:stroke-indigo-400 stroke-[2.5px]" : "stroke-current"} />
                            </div>
                            {isActive && (
                                <motion.span
                                    layoutId="activeTabLabelGate"
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
