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
    { name: 'Prefix Settings', href: '/dashboard/store/masters/prefix-settings', icon: Hash },
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
      <div className="flex flex-col h-full bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-2 sm:p-4 md:p-6 gap-3 sm:gap-4 md:gap-6">
        {/* Sub-navigation for Masters (Sticky & Scrollable on desktop + mobile) */}
        <div className="shrink-0 sticky top-0 z-20 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-md pb-1">
          <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-800 p-1 sm:p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 w-full sm:w-fit gap-1 scroll-smooth">
            {tabs.map(tab => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 shadow-xs font-bold"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </>
  );
}
