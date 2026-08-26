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
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 overflow-x-auto no-scrollbar flex-1 sm:flex-none">
          {subTabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={15} />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Page View */}
      {children}
    </div>
  );
}
