"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, ShoppingCart, Boxes, Package, History } from 'lucide-react';

export default function WipInventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const subTabs = [
    { name: 'Raw Materials (RM)', href: '/dashboard/store/wip/inventory/rm', icon: Layers },
    { name: 'Bought Out (BO)', href: '/dashboard/store/wip/inventory/bo', icon: ShoppingCart },
    { name: 'FG / Components', href: '/dashboard/store/wip/inventory/fg', icon: Boxes },
    { name: 'MRP WIP Inventory', href: '/dashboard/store/wip/inventory/mrp', icon: Package },
    { name: 'WIP Movement Ledger', href: '/dashboard/store/wip/inventory/ledger', icon: History },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Bar */}
      <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1 scroll-smooth">
        {subTabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon size={15} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Main Page View */}
      {children}
    </div>
  );
}
