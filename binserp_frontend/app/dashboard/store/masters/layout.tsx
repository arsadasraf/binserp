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
    { name: 'Rm/Bo Categories', href: '/dashboard/store/masters/categories', icon: Box },
    { name: 'Rm/Bo Items', href: '/dashboard/store/masters/materials', icon: Box },
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
      <div className="flex flex-col h-full bg-gray-50/50 sm:rounded-2xl p-2 sm:p-4 md:p-6 gap-3 sm:gap-6">
        {/* Sub-navigation for Masters */}
        <div className="w-full overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex gap-1 sm:gap-2 bg-white p-1 sm:p-1.5 rounded-xl shadow-sm border border-gray-100 w-max">
            {tabs.map(tab => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-300 whitespace-nowrap ${isActive
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeMasterTab"
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
        </div>

        {/* Page Content */}
        <div className="flex-1 w-full overflow-x-auto">
          {children}
        </div>
      </div>
    </>
  );
}
