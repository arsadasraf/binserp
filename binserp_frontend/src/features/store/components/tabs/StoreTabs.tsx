"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHeader } from "@/src/context/HeaderContext";
import { Package, Settings, IndianRupee, ShoppingCart, ClipboardList } from "lucide-react";
import { usePermission } from "@/src/hooks/usePermission";

export default function StoreTabs() {
  const { showBottomNav } = useHeader();
  const pathname = usePathname();
  const { hasTabAccess, userType, isModuleAllowed } = usePermission();

  const isSalesActive = pathname.startsWith("/dashboard/store/sales");
  const isPurchaseActive = pathname.startsWith("/dashboard/store/purchase");
  const isMastersActive = pathname.startsWith("/dashboard/store/masters");
  const isWipActive = pathname.startsWith("/dashboard/store/wip");
  const isHomeActive = pathname.startsWith("/dashboard/store/inventory") || pathname === "/dashboard/store";

  const allTabs = [
    { id: "inventory", key: "inventory", label: "Inventory", icon: Package, href: "/dashboard/store/inventory/rm-bo-stock", isActive: isHomeActive },
    { id: "wip", key: "wip", label: "WIP", icon: ClipboardList, href: "/dashboard/store/wip/requests", isActive: isWipActive },
    { id: "sales", key: "sales", label: "Sales", icon: IndianRupee, href: "/dashboard/store/sales/orders", isActive: isSalesActive },
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
      {/* Desktop View: Modern High-Visibility Floating Tabs */}
      <div className="hidden md:flex mb-2 items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
        {tabs.map((tab) => {
          const isActive = tab.isActive;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Mobile View: Fixed Bottom Navigation Bar */}
      <div
        className={`md:hidden fixed bottom-2 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl z-[100] flex justify-around py-3 px-4 transition-all duration-300 ${
          showBottomNav ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.isActive;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 scale-105 font-extrabold"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-all ${
                  isActive ? "bg-blue-50 dark:bg-blue-900/40" : "bg-transparent"
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
