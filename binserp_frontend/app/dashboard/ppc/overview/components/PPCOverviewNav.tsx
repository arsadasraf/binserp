"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Users, PackageCheck } from "lucide-react";

export default function PPCOverviewNav() {
  const pathname = usePathname();

  const isWorkstationsActive = pathname.startsWith("/dashboard/ppc/overview/workstations");
  const isEmployeesActive = pathname.startsWith("/dashboard/ppc/overview/employees");
  const isOrdersActive = pathname.startsWith("/dashboard/ppc/overview/orders");

  const navItems = [
    {
      id: "workstations",
      label: "Workstations",
      href: "/dashboard/ppc/overview/workstations",
      icon: Cpu,
      isActive: isWorkstationsActive,
    },
    {
      id: "employees",
      label: "Employees / Operators",
      href: "/dashboard/ppc/overview/employees",
      icon: Users,
      isActive: isEmployeesActive,
    },
    {
      id: "orders",
      label: "Manufacturing Orders",
      href: "/dashboard/ppc/overview/orders",
      icon: PackageCheck,
      isActive: isOrdersActive,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all ${
                item.isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
