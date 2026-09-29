"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHeader } from "@/src/context/HeaderContext";
import { BarChart3, Target, IndianRupee, Users, Layers } from "lucide-react";
import { usePermission } from "@/src/hooks/usePermission";

export default function CRMTabs() {
  const { showBottomNav } = useHeader();
  const pathname = usePathname();
  const { hasTabAccess, userType } = usePermission();

  const isOverviewActive = pathname === "/dashboard/crm" || pathname.startsWith("/dashboard/crm/overview");
  const isLeadsActive = pathname.startsWith("/dashboard/crm/leads");
  const isDealsActive = pathname.startsWith("/dashboard/crm/deals");
  const isCustomersActive = pathname.startsWith("/dashboard/crm/customers");
  const isMastersActive = pathname.startsWith("/dashboard/crm/masters");

  const allTabs = [
    {
      id: "overview",
      key: "overview",
      label: "Overview",
      shortLabel: "Overview",
      icon: BarChart3,
      href: "/dashboard/crm/overview",
      isActive: isOverviewActive,
    },
    {
      id: "leads",
      key: "leads",
      label: "Lead Pipeline",
      shortLabel: "Leads",
      icon: Target,
      href: "/dashboard/crm/leads",
      isActive: isLeadsActive,
    },
    {
      id: "deals",
      key: "deals",
      label: "Deals & Revenue",
      shortLabel: "Deals",
      icon: IndianRupee,
      href: "/dashboard/crm/deals",
      isActive: isDealsActive,
    },
    {
      id: "customers",
      key: "customers",
      label: "Customer 360",
      shortLabel: "Customers",
      icon: Users,
      href: "/dashboard/crm/customers",
      isActive: isCustomersActive,
    },
    {
      id: "masters",
      key: "masters",
      label: "CRM Masters",
      shortLabel: "Masters",
      icon: Layers,
      href: "/dashboard/crm/masters/products",
      isActive: isMastersActive,
    },
  ];

  // RBAC Filtering matching Store standard
  const tabs = allTabs.filter((tab) => {
    if (userType === "saasadmin" || userType === "company") return true;
    return hasTabAccess("CRM", tab.key) || hasTabAccess("CRM", tab.id);
  });

  return (
    <>
      {/* Desktop View: Modern High-Visibility Segmented Tabs */}
      <div className="hidden md:flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 w-fit gap-1">
        {tabs.map((tab) => {
          const isActive = tab.isActive;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Mobile View: Fixed Sticky Bottom Navigation Bar */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex items-center justify-around h-16 px-2 pb-safe transition-all duration-300 ${
          showBottomNav !== false ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.isActive;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-all ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-transparent"
                }`}
              >
                <Icon size={19} />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5">{tab.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
