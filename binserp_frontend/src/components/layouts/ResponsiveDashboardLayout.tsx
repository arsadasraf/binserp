"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import {
  Factory,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Shield,
  Store,
  Users,
  Wallet,
  MoreVertical,
  Truck,
  LayoutGrid,
  UserCheck,
  Wrench,
  CheckCircle,
  Briefcase,
  Target,
  X,
  ShoppingCart,
  Building2,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { clearSession } from "@/src/lib/session";
import { HeaderProvider, useHeader } from "@/src/context/HeaderContext";
import { API_BASE_URL } from "@/src/utils/config";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  priority?: number;
};

// ----------------------------------------------------------------------
// Unified Module Navigation Definitions (Top-Level Module Links)
// ----------------------------------------------------------------------

const companyNav: NavItem[] = [
  { href: "/dashboard/admin/overview", label: "Overview", icon: LayoutDashboard, priority: 1 },
  { href: "/dashboard/admin", label: "User Mgmt", icon: Users, priority: 2 },
  { href: "/dashboard/admin/roles", label: "Roles", icon: Shield, priority: 3 },
];

const departmentNavMap: Record<string, NavItem> = {
  Admin: {
    href: "/dashboard/admin/overview",
    label: "Admin",
    icon: Shield,
    priority: 1,
  },
  HR: {
    href: "/dashboard/hr?tab=home",
    label: "HR",
    icon: Users,
    priority: 2,
  },
  Store: {
    href: "/dashboard/store/inventory/rm-bo-stock",
    label: "Store",
    icon: Store,
    priority: 3,
  },
  PPC: {
    href: "/dashboard/ppc/overview",
    label: "PPC",
    icon: Factory,
    priority: 4,
  },
  Security: {
    href: "/dashboard/gate-entry?tab=overview",
    label: "Gate Entry",
    icon: UserCheck,
    priority: 5,
  },
  MaterialRequests: {
    href: "/dashboard/material-requests",
    label: "Material Requests",
    icon: ShoppingCart,
    priority: 3.5,
  },
  Maintenance: { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench, priority: 6 },
  Quality: { href: "/dashboard/quality", label: "Quality", icon: CheckCircle, priority: 7 },
  CRM: { href: "/dashboard/crm", label: "CRM", icon: Target, priority: 8 },
  Accounts: { href: "/dashboard/accounts", label: "Accounts", icon: Wallet, priority: 9 },
  Reports: { href: "/dashboard/reports", label: "Reports", icon: LineChart, priority: 10 },
};

const employeeNav: NavItem[] = [
  { href: "/dashboard/employee?tab=work", label: "Employee Portal", icon: Briefcase, priority: 1 },
];

const fallbackNav: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, priority: 1 }];

// ----------------------------------------------------------------------
// Route to Module Header Mapping
// ----------------------------------------------------------------------

const ROUTE_HEADER_MAP: Array<{ prefix: string; exact?: boolean; title: string; subtitle: string }> = [
  { prefix: "/dashboard/admin/overview", exact: true, title: "Admin Overview", subtitle: "System & Organization Health" },
  { prefix: "/dashboard/admin/roles", exact: false, title: "Role Management", subtitle: "User Roles & Permissions Policies" },
  { prefix: "/dashboard/admin", exact: true, title: "User Management", subtitle: "Company Users & Staff Accounts" },
  { prefix: "/dashboard/hr", exact: false, title: "HR Management", subtitle: "Human Resources, Attendance & Payroll" },
  { prefix: "/dashboard/store", exact: false, title: "Store & Inventory", subtitle: "Raw Materials, Bought-Outs, Stock & Requisitions" },
  { prefix: "/dashboard/ppc", exact: false, title: "PPC & Production", subtitle: "Production Planning, BOM & Work Orders" },
  { prefix: "/dashboard/gate-entry", exact: false, title: "Gate Entry & Security", subtitle: "Visitor & Material Gate Pass Management" },
  { prefix: "/dashboard/material-requests", exact: false, title: "Material Requests", subtitle: "Internal Requisitions & Item Approvals" },
  { prefix: "/dashboard/maintenance", exact: false, title: "Maintenance", subtitle: "Equipment & Machinery Maintenance Logs" },
  { prefix: "/dashboard/quality", exact: false, title: "Quality Control", subtitle: "Inspections, QC Reports & Compliance" },
  { prefix: "/dashboard/crm", exact: false, title: "CRM & Sales", subtitle: "Customer Relationship & Leads Management" },
  { prefix: "/dashboard/accounts", exact: false, title: "Accounts & Finance", subtitle: "Invoicing, Ledgers & Financial Records" },
  { prefix: "/dashboard/reports", exact: false, title: "Analytics & Reports", subtitle: "Executive Summary & Operational Insights" },
  { prefix: "/dashboard/employee", exact: false, title: "Employee Portal", subtitle: "Self Service, Tasks & Attendance" },
  { prefix: "/dashboard/profile", exact: false, title: "My Profile", subtitle: "User Profile & Account Preferences" },
  { prefix: "/dashboard/settings", exact: false, title: "Settings", subtitle: "System & Account Configurations" },
];

// ----------------------------------------------------------------------
// Dynamic Nav Item Resolver
// ----------------------------------------------------------------------

function resolveNavItems(userType: string | null, department: string | null, roles: any[]): NavItem[] {
  // 1. Company accounts have access to Overview, User Mgmt, and Roles
  if (userType === "company") {
    return companyNav;
  }

  // 2. Employee portal user type
  if (userType === "employee") {
    return employeeNav;
  }

  // 3. SaaS Admin full system access
  if (userType === "saasadmin") {
    return Object.values(departmentNavMap).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }

  // 4. Role-based resolution for Users / Staff
  if (roles && Array.isArray(roles) && roles.length > 0) {
    let isGM = false;
    const allowedModules = new Set<string>();

    roles.forEach((r) => {
      if (!r) return;
      const roleName = typeof r === "string" ? r : r.name;
      if (roleName === "GM" || roleName === "Admin Default Role" || roleName === "Company Management") {
        isGM = true;
      }
      if (typeof r === "object" && Array.isArray(r.policies)) {
        r.policies.forEach((policy: any) => {
          if (policy && policy.module && policy.module !== "Admin") {
            allowedModules.add(policy.module.toUpperCase());
          }
        });
      }
    });

    if (isGM) {
      // GM gets all operational modules (excludes Admin user/role management)
      return Object.values(departmentNavMap)
        .filter((navObj) => navObj.label !== "Admin")
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    }

    const allowedNav: NavItem[] = [];
    Object.entries(departmentNavMap).forEach(([modName, navObj]) => {
      if (modName !== "Admin" && allowedModules.has(modName.toUpperCase())) {
        allowedNav.push(navObj);
      }
    });

    if (allowedNav.length > 0) {
      return allowedNav.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    }
  }

  // 5. Fallback based on department string (excludes Admin module)
  const upperDept = (department || "").toUpperCase();
  const matchedKey = Object.keys(departmentNavMap).find((key) => key !== "Admin" && upperDept.includes(key.toUpperCase()));
  if (matchedKey && departmentNavMap[matchedKey]) {
    return [departmentNavMap[matchedKey]];
  }

  return Object.values(departmentNavMap)
    .filter((navObj) => navObj.label !== "Admin")
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

// ----------------------------------------------------------------------
// Smart Active NavItem Check
// ----------------------------------------------------------------------

function isNavItemActive(item: NavItem, currentPath: string | null): boolean {
  if (!currentPath) return false;

  const itemPath = item.href.split("?")[0];

  // Exact match
  if (currentPath === itemPath) return true;

  // Specific admin sub-pages for company nav
  if (itemPath === "/dashboard/admin/overview") {
    return currentPath === "/dashboard/admin/overview";
  }
  if (itemPath === "/dashboard/admin/roles") {
    return currentPath.startsWith("/dashboard/admin/roles");
  }
  if (itemPath === "/dashboard/admin") {
    return (
      currentPath === "/dashboard/admin" ||
      (currentPath.startsWith("/dashboard/admin/") &&
        !currentPath.startsWith("/dashboard/admin/roles") &&
        !currentPath.startsWith("/dashboard/admin/overview"))
    );
  }

  // Major modules: match module segments (e.g. /dashboard/store, /dashboard/ppc, /dashboard/material-requests, etc.)
  const itemSegments = itemPath.split("/").filter(Boolean);
  const currentSegments = currentPath.split("/").filter(Boolean);

  if (itemSegments.length >= 2 && currentSegments.length >= 2) {
    if (itemSegments[0] === currentSegments[0] && itemSegments[1] === currentSegments[1]) {
      return true;
    }
  }

  return currentPath.startsWith(itemPath + "/");
}

// ----------------------------------------------------------------------
// Layout Content Component
// ----------------------------------------------------------------------

function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { title, subtitle, setHeader, showBottomNav, setShowBottomNav } = useHeader();

  // State
  const [navItems, setNavItems] = useState<NavItem[]>(fallbackNav);
  const [userName, setUserName] = useState("BinsAnalytics");
  const [userSubtitle, setUserSubtitle] = useState("Dashboard");
  const [companyName, setCompanyName] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pythonOnline, setPythonOnline] = useState<boolean | null>(null);

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setShowBottomNav(true);
  }, [pathname]);

  // Synchronize Module Header on Route Change
  useEffect(() => {
    if (!pathname) return;
    const match = ROUTE_HEADER_MAP.find((entry) => {
      if (entry.exact) return pathname === entry.prefix;
      return pathname === entry.prefix || pathname.startsWith(entry.prefix + "/") || pathname.startsWith(entry.prefix + "?");
    });
    if (match) {
      setHeader(match.title, match.subtitle);
    }
  }, [pathname]);

  // Handle User Info, Company Name & Nav Resolution
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("userType");
    const userInfoStr = localStorage.getItem("userInfo");

    // Strictly redirect to login if no active authentication exists
    if (!token && !userType) {
      router.replace("/login?logout=true");
      return;
    }

    let department: string | null = null;
    let resolvedName = "BinsAnalytics";
    let resolvedSubtitle = "Dashboard";
    let resolvedCompany = "";
    let roles: any[] = [];

    if (userInfoStr) {
      try {
        const parsed = JSON.parse(userInfoStr);
        department = parsed?.department || null;
        if (parsed?.role) {
          roles = [parsed.role];
        } else if (Array.isArray(parsed?.roles)) {
          roles = parsed.roles;
        }

        resolvedName = parsed?.name || parsed?.companyName || resolvedName;
        resolvedCompany = parsed?.company?.companyName || parsed?.companyName || (userType === "company" ? (parsed?.name || parsed?.companyName) : "");

        let roleName = "";
        if (userType === "company") {
          roleName = "Company Admin";
        } else if (userType === "saasadmin") {
          roleName = "SaaS Admin";
        } else if (parsed?.role) {
          roleName = typeof parsed.role === "string" ? parsed.role : parsed.role.name || "";
        } else if (Array.isArray(parsed?.roles) && parsed.roles.length > 0) {
          roleName = typeof parsed.roles[0] === "string" ? parsed.roles[0] : parsed.roles[0].name || "";
        }

        resolvedSubtitle = roleName || parsed?.department || "User";
      } catch (err) {
        console.warn("Failed to parse user info from storage", err);
      }
    } else if (userType === "company") {
      resolvedSubtitle = "Company Admin";
    }

    const items = resolveNavItems(userType, department, roles);
    setNavItems(items);
    setUserName(resolvedName);
    setUserSubtitle(resolvedSubtitle);
    if (resolvedCompany) {
      setCompanyName(resolvedCompany);
    }

    // 🔒 Navigation Guard Logic with Module Prefix Authorization
    if (pathname) {
      const allowedModulePrefixes = items.map((item) => {
        const pathOnly = item.href.split("?")[0];
        const segments = pathOnly.split("/").filter(Boolean);
        return segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : pathOnly;
      });

      const isAuthorized = allowedModulePrefixes.some((prefix) => {
        return pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?");
      });

      const isGlobalRoute =
        pathname === "/dashboard/profile" ||
        pathname === "/dashboard/settings" ||
        pathname === "/login" ||
        pathname === "/" ||
        pathname?.startsWith("/auth");

      if (pathname === "/dashboard") {
        if (items.length > 0) {
          router.replace(items[0].href);
          return;
        }
      } else if (!isAuthorized && !isGlobalRoute) {
        console.warn(`Unauthorized access attempt to ${pathname}. Redirecting...`);
        const fallbackRoute = items.length > 0 ? items[0].href : "/dashboard/admin/overview";
        router.replace(fallbackRoute);
        return;
      }
    }

    setIsCheckingAuth(false);
  }, [pathname, router]);

  // Intercept Browser Back/Forward BFCache Restoration Post-Logout
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      const token = localStorage.getItem("token");
      const userType = localStorage.getItem("userType");
      if (!token && !userType) {
        window.location.replace("/login?logout=true");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Polling AI Python Health Status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = API_BASE_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/hr/python-health`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setPythonOnline(data.status === "online");
        } else {
          setPythonOnline(false);
        }
      } catch (err) {
        setPythonOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await clearSession();
    window.location.replace("/login?logout=true");
  };

  // Mobile Bottom Navigation Items
  const mobileBottomNavItems = useMemo(() => {
    return navItems.slice(0, 4);
  }, [navItems]);

  const mobileOverflowItems = useMemo(() => {
    return navItems.slice(4);
  }, [navItems]);

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Render NavLink Helper
  const renderNavLink = (item: NavItem, isMobile = false) => {
    const Icon = item.icon;
    const isActive = isNavItemActive(item, pathname);

    if (isMobile) {
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => {
            setMobileSidebarOpen(false);
            setMobileMoreOpen(false);
          }}
          className={[
            "group flex flex-col items-center justify-center w-full h-full transition-all",
            isActive ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-gray-500 dark:text-gray-400",
          ].join(" ")}
        >
          <Icon size={22} className={isActive ? "text-indigo-600 dark:text-indigo-400 stroke-[2.5]" : "text-gray-500 dark:text-gray-400"} />
          <span className="text-[10px] mt-0.5 truncate max-w-[64px]">{item.label}</span>
        </Link>
      );
    }

    // Clean Desktop Nav Link
    return (
      <Link
        key={item.label}
        href={item.href}
        className={[
          "group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm w-full",
          isActive
            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-bold shadow-sm"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
        ].join(" ")}
      >
        <Icon
          size={18}
          className={
            isActive
              ? "text-indigo-600 dark:text-indigo-400 stroke-[2.5]"
              : "text-gray-500 group-hover:text-indigo-500 dark:text-gray-400 dark:group-hover:text-indigo-400"
          }
        />
        <span className={desktopSidebarOpen ? "truncate" : "hidden"}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`${
          desktopSidebarOpen ? "w-64" : "hidden lg:flex w-20 overflow-hidden"
        } bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col transition-all duration-300 ease-in-out hidden lg:flex shrink-0`}
      >
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none shrink-0">
            <span className="text-white font-black text-xl">B</span>
          </div>
          <div className={`min-w-0 ${!desktopSidebarOpen && "hidden"}`}>
            <span className="font-bold text-lg text-gray-900 dark:text-white block leading-tight">
              BinsErp
            </span>
            {companyName && (
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                {companyName}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => renderNavLink(item))}
        </div>

        <div className="p-4 border-t border-gray-50 dark:border-gray-800">
          {desktopSidebarOpen ? (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 mb-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{userName}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate">{userSubtitle}</p>
                {companyName && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                    <Building2 size={11} className="shrink-0 text-indigo-500" />
                    <span className="truncate">{companyName}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div
                className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold"
                title={`${userName} (${userSubtitle})${companyName ? ` - ${companyName}` : ''}`}
              >
                {userName.charAt(0)}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${
              desktopSidebarOpen ? "gap-3 px-3" : "justify-center"
            } py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors cursor-pointer`}
            title="Sign Out"
          >
            <LogOut size={18} />
            {desktopSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <div className="hidden lg:flex items-center px-6 py-3.5 bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 shrink-0 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              title={desktopSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Company Name Badge in Header */}
            {companyName && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/60 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200 shadow-2xs">
                <Building2 size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-black tracking-tight truncate max-w-[220px]">
                  {companyName}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{userName}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-md uppercase tracking-wider">
                {userSubtitle}
              </span>
            </div>

            <div
              className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 cursor-help transition-all hover:bg-gray-100 dark:hover:bg-gray-700"
              title={pythonOnline === null ? "Checking AI Status..." : pythonOnline ? "AI Service is Online" : "AI Service is Offline"}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  pythonOnline === null
                    ? "bg-gray-400"
                    : pythonOnline
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                    : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"
                }`}
              ></div>
              <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest hidden sm:inline-block">
                AI
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 -ml-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <LayoutGrid size={22} />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none shrink-0">
              <span className="text-white font-black text-lg">B</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white truncate leading-tight">
                {title || "BinsErp"}
              </span>
              {companyName ? (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 truncate">
                  <Building2 size={10} className="shrink-0" />
                  <span className="truncate max-w-[130px]">{companyName}</span>
                </span>
              ) : subtitle ? (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{subtitle}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[90px]">{userName}</span>
              <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase">{userSubtitle}</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors cursor-pointer" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Route Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto relative bg-slate-50/50 dark:bg-gray-950">
          {isCheckingAuth ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-sm z-50">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Mobile Bottom Navigation Bar - Only shown for top-level / overview pages without dedicated sub-module tabs */}
        {!pathname.startsWith("/dashboard/store") &&
         !pathname.startsWith("/dashboard/ppc") &&
         !pathname.startsWith("/dashboard/quality") &&
         !pathname.startsWith("/dashboard/accounts") &&
         !pathname.startsWith("/dashboard/hr") &&
         !pathname.startsWith("/dashboard/gate-entry") &&
         !pathname.startsWith("/dashboard/material-requests") &&
         !pathname.startsWith("/dashboard/maintenance") && (
          <nav
            className={`lg:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 fixed bottom-0 left-0 right-0 z-30 pb-safe transition-transform duration-300 ease-in-out ${
              showBottomNav ? "translate-y-0 shadow-lg" : "translate-y-full pointer-events-none"
            }`}
          >
            <div className="flex items-center justify-around h-16 px-2">
              {mobileBottomNavItems.map((item) => (
                <div key={item.href} className="flex-1 h-full">
                  {renderNavLink(item, true)}
                </div>
              ))}

              {mobileOverflowItems.length > 0 && (
                <div className="flex-1 h-full relative">
                  <button
                    onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                    className={`flex flex-col items-center justify-center w-full h-full transition-all cursor-pointer ${
                      mobileMoreOpen ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <MoreVertical size={22} />
                    <span className="text-[10px] mt-0.5">More</span>
                  </button>

                  {mobileMoreOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom-2">
                      {mobileOverflowItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMoreOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-800 last:border-0"
                        >
                          <item.icon size={16} className="text-gray-500 dark:text-gray-400" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
        )}
      </div>

      {/* Mobile Off-Canvas Navigation Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-white font-black">B</span>
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-lg text-gray-900 dark:text-white block leading-tight">Navigation</span>
                  {companyName && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                      {companyName}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shadow-xs"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon size={20} className={isActive ? "text-indigo-600 dark:text-indigo-400 stroke-[2.5]" : "text-gray-500 dark:text-gray-400"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold text-sm cursor-pointer"
              >
                <LogOut size={20} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResponsiveDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <HeaderProvider>
      <LayoutContent>{children}</LayoutContent>
    </HeaderProvider>
  );
}

