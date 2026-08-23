"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, CalendarClock, FileText, Send, Tag, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'MRP', href: '/dashboard/store/purchase/mrp', icon: CalendarClock },
    { name: 'Outward RFQ', href: '/dashboard/store/purchase/rfq', icon: Send },
    { name: 'Inward Quotation', href: '/dashboard/store/purchase/vendor-quotation', icon: FileText },
    { name: 'Outward PO', href: '/dashboard/store/purchase/po', icon: ShoppingCart },
    { name: 'Price List', href: '/dashboard/store/purchase/vendor-price-list', icon: Tag },
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
        {/* Sub-navigation for Purchase (Sticky & Scrollable on desktop + mobile) */}
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
                      ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 shadow-xs font-bold"
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
