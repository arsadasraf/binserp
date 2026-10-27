"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Factory, History, Layers, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'RM Inventory', href: '/dashboard/store/inventory/rm-stock', icon: Package },
    { name: 'BO Inventory', href: '/dashboard/store/inventory/bo-stock', icon: Package },
    { name: 'Consumable Inventory', href: '/dashboard/store/inventory/consumable-stock', icon: Package },
    { name: 'FG Inventory', href: '/dashboard/store/inventory/inhouse-stock', icon: Factory },
    { name: 'GRN Rejection Bin', href: '/dashboard/store/inventory/rejection-rework', icon: ShieldAlert },
    { name: 'Transaction Ledger', href: '/dashboard/store/inventory/ledger', icon: Layers },
    { name: 'GRN History', href: '/dashboard/store/inventory/grn-history', icon: History },
  ];


  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
      <div className="flex flex-col h-full min-h-0 gap-2 sm:gap-2.5">
        {/* Sub-navigation for Inventory (Sticky & Scrollable on desktop + mobile) */}
        <div className="shrink-0 sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit touch-pan-x">
            {tabs.map(tab => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 ${
                    isActive 
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={15} className={isActive ? "text-white" : "text-slate-500 dark:text-slate-400"} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
