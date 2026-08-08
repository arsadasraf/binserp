"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, Package } from "lucide-react";

export function PPCMasterSubNav() {
  const pathname = usePathname();

  const masterSubTabs = [
    { id: "shop-floor", label: "Shop Floor", icon: Factory, href: "/dashboard/ppc/master/shop-floor/workstation" },
    { id: "products", label: "FG & Component Master", icon: Package, href: "/dashboard/ppc/master/products" },
  ];

  return (
    <div className="flex gap-2 flex-wrap items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
      {masterSubTabs.map(({ id, label, icon: Icon, href }) => {
        const isActive = id === "shop-floor" 
          ? pathname?.includes("/dashboard/ppc/master/shop-floor")
          : pathname?.includes("/dashboard/ppc/master/products");

        return (
          <Link
            key={id}
            href={href}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
              isActive
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
