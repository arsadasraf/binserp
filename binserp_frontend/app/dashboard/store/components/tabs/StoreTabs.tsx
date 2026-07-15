"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useHeader } from "@/src/context/HeaderContext";

import { Package, Layers, FileText, Settings, IndianRupee, Factory, ShoppingCart, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";
import { TabType } from "../../types/store.types";

interface StoreTabsProps {
    activeTab: TabType;
}

export default function StoreTabs({ activeTab }: StoreTabsProps) {
    const { showBottomNav } = useHeader();
    const isSalesActive = ["sales", "mrp", "order-entry", "quotation", "billing", "dc", "price-list"].includes(activeTab);
    const isPurchaseActive = ["purchase", "po"].includes(activeTab);
    const isMastersActive = activeTab === "masters";
    const isHomeActive = activeTab === "home";
    const isWipActive = ["wip", "material-issue", "job-work"].includes(activeTab);

    const [department, setDepartment] = useState<string>("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const userStr = localStorage.getItem("userInfo");
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    setDepartment(user.department || "");
                } catch (e) {
                    console.error("Failed to parse userInfo", e);
                }
            }
        }
    }, []);

    const isExecutive = department.includes("Executive");

    const tabs = [
        { id: "home", label: "Inventory", icon: Package, href: "/dashboard/store?tab=home", isActive: isHomeActive },
        { id: "wip", label: "WIP", icon: ClipboardList, href: "/dashboard/store?tab=wip", isActive: isWipActive },
        { id: "sales", label: "Sales", icon: IndianRupee, href: "/dashboard/store?tab=sales", isActive: isSalesActive },
        { id: "purchase", label: "Purchase", icon: ShoppingCart, href: "/dashboard/store?tab=purchase", isActive: isPurchaseActive },
        { id: "masters", label: "Masters", icon: Settings, href: "/dashboard/store?tab=masters", isActive: isMastersActive },
    ].filter(tab => !(tab.id === "masters" && isExecutive));

    return (
        <>
            {/* Desktop View: Modern Floating Tabs */}
            <div className="hidden md:flex mb-2 items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
                {tabs.map((tab) => {
                    const isActive = tab.isActive;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`relative flex items-center gap-2 px-8 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${isActive ? "text-white shadow-md" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabStore"
                                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl"
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
            <div className={`md:hidden fixed bottom-2 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-2xl rounded-2xl z-[100] flex justify-around py-3 px-6 safe-area-pb transition-all duration-300 ${showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
                {tabs.map((tab) => {
                    const isActive = tab.isActive;
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
                                    layoutId="activeTabLabelStore"
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
