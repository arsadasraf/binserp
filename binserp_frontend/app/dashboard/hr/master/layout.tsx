"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HRMasterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const masterTabs = [
    { id: "employee", label: "Employee", href: "/dashboard/hr/master/employee" },
    { id: "employee-type", label: "Employee Type", href: "/dashboard/hr/master/employee-type" },
    { id: "department", label: "Department", href: "/dashboard/hr/master/department" },
    { id: "designation", label: "Designation", href: "/dashboard/hr/master/designation" },
    { id: "face-data", label: "Face Data", href: "/dashboard/hr/master/face-data" },
    { id: "holiday", label: "Holidays", href: "/dashboard/hr/master/holiday" },
    { id: "settings", label: "Settings", href: "/dashboard/hr/master/settings" },
  ];

  return (
    <div className="space-y-6">
      {/* Master Sub-tabs: Modern Pill Design */}
      <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit touch-pan-x">
        {masterTabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
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
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Content Area with premium card styling */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        {children}
      </div>
    </div>
  );
}
