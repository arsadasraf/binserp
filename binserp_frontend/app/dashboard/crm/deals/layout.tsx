"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, FileText, CreditCard } from "lucide-react";
import type { ReactNode } from "react";

export default function DealsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isPipelineActive = pathname === "/dashboard/crm/deals";
  const isProposalsActive = pathname.startsWith("/dashboard/crm/deals/proposals");
  const isPaymentsActive = pathname.startsWith("/dashboard/crm/deals/payments");

  const subTabs = [
    {
      id: "pipeline",
      label: "Deals Pipeline",
      href: "/dashboard/crm/deals",
      icon: TrendingUp,
      isActive: isPipelineActive,
    },
    {
      id: "proposals",
      label: "Proposals & Quotations",
      href: "/dashboard/crm/deals/proposals",
      icon: FileText,
      isActive: isProposalsActive,
    },
    {
      id: "payments",
      label: "Payment Receipts",
      href: "/dashboard/crm/deals/payments",
      icon: CreditCard,
      isActive: isPaymentsActive,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Deals & Revenue Sub-navigation Bar */}
      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs w-fit">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                tab.isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
