"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, ShieldCheck, Building2, Zap, Target } from "lucide-react";
import type { ReactNode } from "react";

export default function MastersLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isProductsActive = pathname.startsWith("/dashboard/crm/masters/products");
  const isTeamActive = pathname.startsWith("/dashboard/crm/masters/team-access");
  const isCustomersActive = pathname.startsWith("/dashboard/crm/masters/customers");
  const isIntegrationsActive = pathname.startsWith("/dashboard/crm/masters/integrations");
  const isPipelineActive = pathname.startsWith("/dashboard/crm/masters/pipeline");

  const subTabs = [
    {
      id: "products",
      label: "Products & Photos",
      href: "/dashboard/crm/masters/products",
      icon: ShoppingBag,
      isActive: isProductsActive,
    },
    {
      id: "team-access",
      label: "CRM Team Access",
      href: "/dashboard/crm/masters/team-access",
      icon: ShieldCheck,
      isActive: isTeamActive,
    },
    {
      id: "customers",
      label: "Customer Master",
      href: "/dashboard/crm/masters/customers",
      icon: Building2,
      isActive: isCustomersActive,
    },
    {
      id: "integrations",
      label: "API & Tool Credentials",
      href: "/dashboard/crm/masters/integrations",
      icon: Zap,
      isActive: isIntegrationsActive,
    },
    {
      id: "pipeline",
      label: "Pipeline Settings",
      href: "/dashboard/crm/masters/pipeline",
      icon: Target,
      isActive: isPipelineActive,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Masters Sub-navigation Bar */}
      <div className="overflow-x-auto no-scrollbar py-0.5">
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs w-max">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
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
      </div>

      <div>{children}</div>
    </div>
  );
}
