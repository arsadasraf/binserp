"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, CalendarClock, FileText, Send, Tag, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Outward PO', href: '/dashboard/store/purchase/po', icon: ShoppingCart },
    { name: 'Outward RFQ', href: '/dashboard/store/purchase/rfq', icon: Send },
    { name: 'Inward Quotation', href: '/dashboard/store/purchase/vendor-quotation', icon: FileText },
    { name: 'Price List', href: '/dashboard/store/purchase/vendor-price-list', icon: Tag },
    { name: 'Purchase Bills', href: '/dashboard/store/purchase/purchase-bill', icon: Building2 },
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
        {/* Sub-navigation for Purchase (Sticky & Scrollable on desktop + mobile) */}
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
                      ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 shadow-2xs font-bold"
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
