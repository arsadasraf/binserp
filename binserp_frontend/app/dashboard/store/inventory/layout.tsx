"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Factory, History, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'RM/BO Inventory', href: '/dashboard/store/inventory/rm-bo-stock', icon: Package },
    { name: 'FG Inventory', href: '/dashboard/store/inventory/inhouse-stock', icon: Factory },
    { name: 'Transaction Ledger', href: '/dashboard/store/inventory/ledger', icon: Layers },
    { name: 'BO GRN History', href: '/dashboard/store/inventory/grn-history', icon: History },
    { name: 'FG GRN History', href: '/dashboard/store/inventory/fg-grn-history', icon: History },
  ];


  return (
    <div className="flex flex-col h-full bg-gray-50/50 rounded-2xl p-4 md:p-6 gap-6">
      {/* Sub-navigation for Inventory */}
      <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 w-fit">
        {tabs.map(tab => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                isActive 
                  ? "text-indigo-600" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeInventoryTab"
                  className="absolute inset-0 bg-indigo-50 rounded-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-2">
                <Icon size={16} />
                {tab.name}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Page Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
