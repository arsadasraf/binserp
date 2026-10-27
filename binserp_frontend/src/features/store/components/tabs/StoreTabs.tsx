"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHeader } from "@/src/context/HeaderContext";
import { Package, Settings, IndianRupee, ShoppingCart, ClipboardList, CalendarClock } from "lucide-react";
import { usePermission } from "@/src/hooks/usePermission";

export default function StoreTabs() {
  const { showBottomNav } = useHeader();
  const pathname = usePathname();
  const { hasTabAccess, userType, isModuleAllowed } = usePermission();

  const isSalesActive = pathname.startsWith("/dashboard/store/sales");
  const isMrpActive = pathname.startsWith("/dashboard/store/mrp");
  const isPurchaseActive = pathname.startsWith("/dashboard/store/purchase");
  const isMastersActive = pathname.startsWith("/dashboard/store/masters");
  const isWipActive = pathname.startsWith("/dashboard/store/wip");
  const isHomeActive = pathname.startsWith("/dashboard/store/inventory") || pathname === "/dashboard/store";

  const allTabs = [
    { id: "inventory", key: "inventory", label: "Inventory", icon: Package, href: "/dashboard/store/inventory/rm-stock", isActive: isHomeActive },
    { id: "wip", key: "wip", label: "WIP", icon: ClipboardList, href: "/dashboard/store/wip/requests", isActive: isWipActive },
    { id: "sales", key: "sales", label: "Sales", icon: IndianRupee, href: "/dashboard/store/sales/orders", isActive: isSalesActive },
    { id: "mrp", key: "mrp", label: "MRP", icon: CalendarClock, href: "/dashboard/store/mrp", isActive: isMrpActive },
    { id: "purchase", key: "purchase", label: "Purchase", icon: ShoppingCart, href: "/dashboard/store/purchase/po", isActive: isPurchaseActive },
    { id: "masters", key: "masters", label: "Masters", icon: Settings, href: "/dashboard/store/masters/vendors", isActive: isMastersActive },
  ];

  // Dynamic filter based on role policy permissions
  const tabs = allTabs.filter((tab) => {
    if (userType === "saasadmin" || userType === "company") return true;
    return hasTabAccess("Store", tab.key) || hasTabAccess("Store", tab.id);
  });


  return (
    <>
      {/* Desktop View: Modern High-Visibility Segmented Tabs */}
      <div className="hidden md:flex items-center overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit">
        {tabs.map((tab) => {
          const isActive = tab.isActive;
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

      {/* Mobile View: Fixed Bottom Navigation Bar for Store Module */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 shadow-2xl z-30 flex items-center justify-around h-16 px-2 pb-safe transition-all duration-300 ${
          showBottomNav ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
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
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-transparent"
                }`}
              >
                <Icon size={20} />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
