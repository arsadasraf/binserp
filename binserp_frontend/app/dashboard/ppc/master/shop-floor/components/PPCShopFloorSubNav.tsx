"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, Cpu, Activity, Tag, MapPin, Users, Clock } from "lucide-react";

export function PPCShopFloorSubNav() {
  const pathname = usePathname();

  const shopFloorTabs = [
    { id: "workstation", label: "Workstation", icon: Factory, href: "/dashboard/ppc/master/shop-floor/workstation" },
    { id: "machines", label: "Machine List", icon: Cpu, href: "/dashboard/ppc/master/shop-floor/machines" },
    { id: "process", label: "Process", icon: Activity, href: "/dashboard/ppc/master/shop-floor/process" },
    { id: "category", label: "Category", icon: Tag, href: "/dashboard/ppc/master/shop-floor/category" },
    { id: "location", label: "Location", icon: MapPin, href: "/dashboard/ppc/master/shop-floor/location" },
    { id: "manpower", label: "Manpower", icon: Users, href: "/dashboard/ppc/master/shop-floor/manpower" },
    { id: "shift", label: "Shift", icon: Clock, href: "/dashboard/ppc/master/shop-floor/shift" },
  ];

  return (
    <div className="flex gap-2 flex-wrap items-center bg-gray-100/80 dark:bg-gray-800/60 p-1.5 rounded-xl w-fit border border-gray-200/50 dark:border-gray-700/50">
      {shopFloorTabs.map(({ id, label, icon: Icon, href }) => {
        const isActive = pathname?.includes(href);

        return (
          <Link
            key={id}
            href={href}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
              isActive
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm border border-gray-200/60 dark:border-gray-600 font-bold"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
