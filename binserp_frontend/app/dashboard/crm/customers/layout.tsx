"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Wrench } from "lucide-react";
import type { ReactNode } from "react";

export default function CustomersLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isDirectoryActive = pathname === "/dashboard/crm/customers";
  const isServicesActive = pathname.startsWith("/dashboard/crm/customers/services");

  const subTabs = [
    {
      id: "directory",
      label: "Customer Directory 360",
      href: "/dashboard/crm/customers",
      icon: Users,
      isActive: isDirectoryActive,
    },
    {
      id: "services",
      label: "After-Sales Services & Installed Base",
      href: "/dashboard/crm/customers/services",
      icon: Wrench,
      isActive: isServicesActive,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Customer 360 Sub-navigation Bar */}
      <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit touch-pan-x">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 ${
                tab.isActive
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon size={15} className={tab.isActive ? "text-white" : "text-slate-500 dark:text-slate-400"} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
