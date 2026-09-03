"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useHeader } from "@/src/context/HeaderContext";
import { usePermission } from "@/src/hooks/usePermission";
import { 
  ClipboardCheck, Activity as ActivityIcon, Settings, 
  BarChart3, CheckSquare, Wrench, ShieldAlert 
} from "lucide-react";

export const QUALITY_TABS = [
  { id: "overview", label: "Overview", icon: BarChart3, href: "/dashboard/quality/overview" },
  { id: "incoming", label: "Incoming QC", icon: ClipboardCheck, href: "/dashboard/quality/incoming" },
  { id: "process", label: "Process QC", icon: ActivityIcon, href: "/dashboard/quality/process" },
  { id: "jobwork-qc", label: "Job Work QC", icon: Wrench, href: "/dashboard/quality/jobwork-qc" },
  { id: "fg-qc", label: "FG QC & PDI", icon: CheckSquare, href: "/dashboard/quality/fg-qc" },
  { id: "rejection-hub", label: "MRB & Rejection Hub", icon: ShieldAlert, href: "/dashboard/quality/rejection-hub" },
  { id: "master", label: "Master", icon: Settings, href: "/dashboard/quality/master" },
];

export default function QualityTabs() {
  const { showBottomNav } = useHeader();
  const pathname = usePathname();
  const { hasTabAccess, userType } = usePermission();

  const tabs = QUALITY_TABS.filter((tab) => {
    if (userType === "saasadmin" || userType === "company") return true;
    return hasTabAccess("Quality", tab.id);
  });

  return (
    <>
      {/* Desktop View: Modern Floating Navigation Tabs */}
      <div className="hidden md:flex mb-6 items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 w-fit flex-wrap gap-1">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href) || (tab.id === "overview" && pathname === "/dashboard/quality");
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`relative flex items-center gap-2 px-4.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                isActive
                  ? "text-white shadow-md shadow-emerald-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabQuality"
                  className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-2">
                <Icon size={16} />
                <span>{tab.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Mobile View: Glassmorphic Bottom Navigation Bar */}
      <div
        className={`md:hidden fixed bottom-4 left-2 right-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-2xl z-[100] flex justify-around py-2 px-1 safe-area-pb transition-all duration-300 ${
          showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href) || (tab.id === "overview" && pathname === "/dashboard/quality");
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400 scale-105"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/60 shadow-xs"
                    : "bg-transparent"
                }`}
              >
                <Icon
                  size={18}
                  className={
                    isActive
                      ? "stroke-emerald-600 dark:stroke-emerald-400 stroke-[2.5px]"
                      : "stroke-current"
                  }
                />
              </div>
              <span className={`text-[9px] font-bold tracking-tight truncate max-w-[55px] text-center ${
                isActive ? "text-emerald-700 dark:text-emerald-300" : ""
              }`}>
                {tab.id === "jobwork-qc" ? "JW QC" : (tab.id === "fg-qc" ? "FG QC" : tab.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
