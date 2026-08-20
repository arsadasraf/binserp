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
      <div className="flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
        {masterTabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
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
