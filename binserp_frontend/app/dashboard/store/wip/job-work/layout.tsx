"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, FileCheck2, IndianRupee, ShieldAlert } from 'lucide-react';

export default function JobWorkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const subTabs = [
    { 
      name: 'Job Work Challans', 
      href: '/dashboard/store/wip/job-work', 
      icon: Truck,
      isActive: pathname === '/dashboard/store/wip/job-work'
    },
    { 
      name: 'Job Work Outward PO', 
      href: '/dashboard/store/wip/job-work/outward-po', 
      icon: FileCheck2,
      isActive: pathname.startsWith('/dashboard/store/wip/job-work/outward-po')
    },
    { 
      name: 'Job Work Bills', 
      href: '/dashboard/store/wip/job-work/bills', 
      icon: IndianRupee,
      isActive: pathname.startsWith('/dashboard/store/wip/job-work/bills')
    },
    { 
      name: 'Rejection Bins', 
      href: '/dashboard/store/wip/job-work/rejections', 
      icon: ShieldAlert,
      isActive: pathname.startsWith('/dashboard/store/wip/job-work/rejections')
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* Sub-tab Navigation Bar for Job Work (Sticky & Scrollable) */}
      <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit touch-pan-x">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 ${
                tab.isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon size={15} className={tab.isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Tab Page Content */}
      <div className="min-h-0">
        {children}
      </div>
    </div>
  );
}
