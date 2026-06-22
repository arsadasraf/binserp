import Link from "next/link";
import { useHeader } from "@/src/context/HeaderContext";

import { LayoutDashboard, ShoppingCart, CalendarClock, Settings, Activity, FileText, Calendar, Sliders, Database, DollarSign, Truck } from "lucide-react"; // Added Truck
import { motion } from "framer-motion";

type PPCTab = "overview" | "orders" | "planning" | "master";

interface PPCTabsProps {
    activeTab: PPCTab;
}

export default function PPCTabs({ activeTab }: PPCTabsProps) {
    const { showBottomNav } = useHeader();
    const tabs = [
        { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/dashboard/ppc?tab=overview" },
        { id: "orders", label: "Orders", icon: FileText, href: "/dashboard/ppc?tab=orders&subTab=new-order" },
        { id: "planning", label: "Planning", icon: Calendar, href: "/dashboard/ppc?tab=planning" },
        { id: "master", label: "Master", icon: Database, href: "/dashboard/ppc?tab=master&subTab=machine-list" },
    ];

    return (
        <>
            {/* Desktop View: Modern Floating Tabs */}
            <div className="hidden md:flex mb-8 items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit mx-auto md:mx-0">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${isActive ? "text-white shadow-md" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabPPC"
                                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl"
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
            <div className={`md:hidden fixed bottom-4 left-4 right-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-2xl rounded-2xl z-[100] flex justify-between py-3 px-6 safe-area-pb transition-all duration-300 ${showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive
                                ? "text-indigo-600 dark:text-indigo-400 scale-110"
                                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                        >
                            <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? "bg-indigo-50 dark:bg-indigo-900/30 shadow-inner" : "bg-transparent"}`}>
                                <Icon size={20} className={isActive ? "stroke-indigo-600 dark:stroke-indigo-400 stroke-[2.5px]" : "stroke-current"} />
                            </div>
                            {isActive && (
                                <motion.span
                                    layoutId="activeTabLabel"
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
