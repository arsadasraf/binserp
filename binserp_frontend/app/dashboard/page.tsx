"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { useGetCompanyProfileQuery } from "@/src/store/services/companyService";
import { useGetUsersQuery } from "@/src/store/services/userService";
import { clearSession } from "@/src/lib/session";

export default function Dashboard() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [shouldFetchProfile, setShouldFetchProfile] = useState(false);
  const { data, isFetching } = useGetCompanyProfileQuery(undefined, {
    skip: !shouldFetchProfile,
  });

  const { data: usersData, isFetching: fetchingUsers } = useGetUsersQuery(undefined, {
    skip: !shouldFetchProfile,
  });

  const userStats = useMemo(() => {
    if (!usersData) return {};
    const stats: Record<string, number> = {};
    usersData.forEach((u: any) => {
      const dept = u.department || 'Unknown';
      stats[dept] = (stats[dept] || 0) + 1;
    });
    return stats;
  }, [usersData]);

  const totalUsers = usersData ? usersData.length : 0;

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("userType");

    if (!token) {
      router.push("/login");
      return;
    }

    if (userType === "company") {
      router.push("/dashboard/admin");
      return;
    }

    if (userType === "user") {
      const userInfoStr = localStorage.getItem("userInfo");
      if (userInfoStr) {
        const user = JSON.parse(userInfoStr);
        const department = user.department;
        setUserRole(department);

        if (department === "HR") {
          router.push("/dashboard/hr");
        } else if (department === "Store") {
          router.push("/dashboard/store");
        } else if (department === "PPC") {
          router.push("/dashboard/ppc");
        } else if (department === "Accounts") {
          router.push("/dashboard/accounts");
        } else if (department === "Security") {
          router.push("/dashboard/gate-entry");
        } else if (department === "CRM") {
          router.push("/dashboard/crm");
        } else if (department === "Quality") {
          router.push("/dashboard/quality");
        } else if (department === "Maintenance") {
          router.push("/dashboard/maintenance");
        } else if (department === "Employee") {
          router.push("/dashboard/employee");
        }
      }
      setLoading(false);
      return;
    }

    setShouldFetchProfile(true);
  }, []);

  useEffect(() => {
    if (data) {
      setUserInfo(data);
    }
    if (!isFetching && !fetchingUsers && shouldFetchProfile) {
      setLoading(false);
    }
  }, [data, isFetching, fetchingUsers, shouldFetchProfile]);

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  const dashboardCards = [
    {
      title: "User Management",
      description: "Create and manage users with different roles (HR, Store, PPC, etc.)",
      href: "/dashboard/admin",
      departmentKey: "Admin",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      gradient: "from-blue-600 via-indigo-600 to-purple-600",
      bgLight: "bg-indigo-50",
      textLight: "text-indigo-600",
      delay: "delay-0",
    },
    {
      title: "HR Management",
      description: "Manage employees, attendance with face recognition, and skills",
      href: "/dashboard/hr",
      departmentKey: "HR",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: "from-fuchsia-600 via-pink-600 to-rose-600",
      bgLight: "bg-pink-50",
      textLight: "text-pink-600",
      delay: "delay-75",
    },
    {
      title: "Store Management",
      description: "Manage inventory, GRN (with photos), DC, Invoice, Material Issues",
      href: "/dashboard/store",
      departmentKey: "Store",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      bgLight: "bg-teal-50",
      textLight: "text-teal-600",
      delay: "delay-100",
    },
    {
      title: "PPC Management",
      description: "Production planning, orders, route cards, jobs, and auto-scheduling",
      href: "/dashboard/ppc",
      departmentKey: "PPC",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      gradient: "from-orange-500 via-amber-500 to-yellow-500",
      bgLight: "bg-orange-50",
      textLight: "text-orange-600",
      delay: "delay-150",
    },
    {
      title: "Accounts",
      description: "Manage finances, transactions, and accounting",
      href: "/dashboard/accounts",
      departmentKey: "Accounts",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-blue-500 via-cyan-500 to-sky-500",
      bgLight: "bg-cyan-50",
      textLight: "text-cyan-600",
      delay: "delay-200",
    },
    {
      title: "Reports",
      description: "View analytics, generate reports, and insights",
      href: "/dashboard/reports",
      departmentKey: "Reports",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: "from-violet-600 via-purple-600 to-indigo-600",
      bgLight: "bg-violet-50",
      textLight: "text-violet-600",
      delay: "delay-300",
    },
    {
      title: "Quality",
      description: "Manage quality checks, inspections, and assurance.",
      href: "/dashboard/quality",
      departmentKey: "Quality",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-green-500 via-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50",
      textLight: "text-emerald-600",
      delay: "delay-400",
    },
    {
      title: "Maintenance",
      description: "Track equipment, service requests, and facility upkeep.",
      href: "/dashboard/maintenance",
      departmentKey: "Maintenance",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      gradient: "from-slate-500 via-gray-500 to-zinc-500",
      bgLight: "bg-slate-50",
      textLight: "text-slate-600",
      delay: "delay-500",
    },
    {
      title: "CRM",
      description: "Manage client relations, sales pipelines, and support.",
      href: "/dashboard/crm",
      departmentKey: "CRM",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: "from-rose-500 via-red-500 to-orange-500",
      bgLight: "bg-rose-50",
      textLight: "text-rose-600",
      delay: "delay-600",
    },
    {
      title: "Gate Entry",
      description: "Manage visitor logs, security clearances, and shipments.",
      href: "/dashboard/gate-entry",
      departmentKey: "Security",
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      ),
      gradient: "from-amber-600 via-yellow-600 to-orange-600",
      bgLight: "bg-amber-50",
      textLight: "text-amber-700",
      delay: "delay-700",
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-500 animate-pulse">Loading Dashboard...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in-up">
            {/* Welcome Banner */}
            {userInfo && (
              <div className="relative group overflow-hidden rounded-3xl bg-transparent p-1 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/20">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-80 blur-xl group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-3xl rounded-[1.4rem] p-8 md:p-10 shadow-sm border border-white/50 dark:border-gray-700/50">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="text-center md:text-left">
                      <h2 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight mb-2">
                        Welcome Back! 👋
                      </h2>
                      <p className="text-gray-600 dark:text-gray-300 text-lg font-medium flex items-center justify-center md:justify-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {userInfo.companyName}
                      </p>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                      <div className="flex -space-x-3">
                        {/* Placeholder avatars since we don't have real user images handy */}
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300">U{i}</div>
                        ))}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                        <strong className="text-indigo-600 dark:text-indigo-400 text-lg mr-1">{totalUsers}</strong> Active Team Members
                      </div>
                    </div>
                  </div>

                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
                </div>
              </div>
            )}

            {/* Dashboard Modules */}
            <div>
              <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">User Management</h3>
              </div>

              {/* Functional User Management Card */}
              {userRole === "Admin" && (() => {
                const adminCard = dashboardCards.find(c => c.title === "User Management");
                return adminCard && (
                  <Link
                    href={adminCard.href}
                    className="block group relative overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-1 shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-1 mb-12"
                  >
                    <div className="relative bg-white dark:bg-gray-900 rounded-[1.4rem] p-8 md:flex md:items-center md:gap-8 hover:bg-white/95 dark:hover:bg-gray-900/95 transition-colors">
                      <div className={`w-20 h-20 ${adminCard.bgLight} dark:bg-indigo-900/50 ${adminCard.textLight} dark:text-indigo-400 rounded-2xl flex items-center justify-center flex-shrink-0 mb-6 md:mb-0 shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                        {adminCard.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600 transition-all">
                            {adminCard.title}
                          </h3>
                          <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                            Admin Action
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                          Create User IDs and Passwords to grant your team access to specific system modules.
                        </p>
                        <div className="mt-5 flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/30 w-fit px-5 py-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
                           <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm shadow cursor-default">
                             {totalUsers}
                           </div>
                           <span className="text-indigo-700 dark:text-indigo-300 font-bold tracking-wide">
                             Total Core Users Registered
                           </span>
                        </div>
                      </div>
                      <div className="mt-6 md:mt-0 flex-shrink-0 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-2 transition-transform">
                        Manage Users
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })()}

              <div className="flex items-center justify-between mb-6 px-1 mt-10">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">System Modules</h3>
                  <p className="text-sm text-gray-500 mt-1">Available modules in your BinsErp system. Use User Management to grant access.</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3 py-1 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm hidden sm:inline-block">
                  {dashboardCards.length - 1} Modules Available
                </span>
              </div>

              {/* Other Modules (Visual Only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardCards
                  .filter(c => c.title !== "User Management")
                  .filter(c => {
                    if (["CEO", "MD", "Manager"].includes(userRole)) {
                      // Executives see Reports AND CRM
                      return c.departmentKey === "Reports" || c.departmentKey === "CRM";
                    }
                    if (userRole === "Admin") {
                      return false;
                    }
                    // Individual department users only see their own module card
                    if (["HR", "Store", "PPC", "Accounts", "Security", "CRM", "Quality", "Maintenance", "Employee"].includes(userRole)) {
                      return c.departmentKey === userRole;
                    }
                    return true;
                  })
                  .map((card, index) => (
                  <Link
                    href={card.href}
                    key={index}
                    className="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col h-full opacity-90 transition-all hover:opacity-100 hover:shadow-md cursor-pointer block hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className={`w-14 h-14 ${card.bgLight} dark:bg-gray-800 ${card.textLight} rounded-2xl flex items-center justify-center shadow-inner`}>
                        {card.icon}
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-semibold px-2 py-1 rounded">
                        Module
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {card.title}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                        {card.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${card.bgLight} dark:bg-gray-800 border border-white dark:border-gray-700 ${card.textLight} font-black text-sm shadow-sm ring-2 ring-gray-50 dark:ring-gray-900 scale-110 group-hover:scale-125 transition-transform duration-300`}>
                        {userStats[card.departmentKey || ""] || 0}
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Active Users Assigned
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
