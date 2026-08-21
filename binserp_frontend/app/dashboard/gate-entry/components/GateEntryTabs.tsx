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
            <div className="hidden md:flex mb-8 items-center bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 w-fit">
                {tabs.map((tab) => {
                    const isActive = pathname.startsWith(tab.href) || (pathname === "/dashboard/gate-entry" && tab.id === "overview") || activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                                isActive
                                    ? "text-white shadow-md font-semibold"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-slate-700/60"
                            }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabGate"
                                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                            <div className="relative z-10 flex items-center gap-2">
                                <Icon size={18} />
                                {tab.label}
                            </div>
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
