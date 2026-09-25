"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, MapPin, Box, Briefcase, Hash, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MastersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Vendors', href: '/dashboard/store/masters/vendors', icon: Briefcase },
    { name: 'Customers', href: '/dashboard/store/masters/customers', icon: Users },
    { name: 'Locations', href: '/dashboard/store/masters/locations', icon: MapPin },
    { name: 'Categories', href: '/dashboard/store/masters/categories', icon: Box },
    { name: 'Raw Materials (RM)', href: '/dashboard/store/masters/raw-materials', icon: Box },
    { name: 'Bought Out (BO)', href: '/dashboard/store/masters/bought-out', icon: Box },
    { name: 'Consumables', href: '/dashboard/store/masters/consumables', icon: Box },
    { name: 'FG Items', href: '/dashboard/store/masters/finished-goods', icon: Box },
    { name: 'Store Settings', href: '/dashboard/store/masters/prefix-settings', icon: Hash },
    { name: 'Company Info', href: '/dashboard/store/masters/company-info', icon: Building2 },
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
        {/* Sub-navigation for Masters (Sticky & Scrollable on desktop + mobile) */}
        <div className="shrink-0 sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1 rounded-xl shadow-2xs border border-slate-200/80 dark:border-slate-800 w-full sm:w-fit gap-1 scroll-smooth touch-pan-x">
            {tabs.map(tab => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 min-h-[34px] rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-150 active:scale-95 ${
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon size={14} />
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
