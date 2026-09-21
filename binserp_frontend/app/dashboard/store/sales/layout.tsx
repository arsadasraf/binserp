"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, FileText, IndianRupee, Truck, Tag, Inbox, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Inward RFQ', href: '/dashboard/store/sales/rfq', icon: Inbox },
    { name: 'Outward Quotation', href: '/dashboard/store/sales/quotations', icon: FileText },
    { name: 'Customer PO', href: '/dashboard/store/sales/po', icon: FileCheck },
    { name: 'DC', href: '/dashboard/store/sales/dc', icon: Truck },
    { name: 'Invoice', href: '/dashboard/store/sales/billing', icon: IndianRupee },
    { name: 'FG Pricelist', href: '/dashboard/store/sales/price-list', icon: Tag },
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
        {/* Sub-navigation for Sales (Sticky & Scrollable on desktop + mobile) */}
        <div className="shrink-0 sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1 rounded-xl shadow-2xs border border-slate-200/80 dark:border-slate-800 w-full sm:w-fit gap-1 scroll-smooth">
            {tabs.map(tab => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 min-h-[34px] rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-150 active:scale-95 ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 shadow-2xs font-bold"
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
