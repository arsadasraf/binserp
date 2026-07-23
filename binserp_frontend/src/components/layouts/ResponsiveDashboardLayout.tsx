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
  Home,
  PackageMinus,
  PackagePlus,
  Receipt,
  MoreVertical,
  // ChevronDown,
  // ChevronRight,
  Truck,
  ShoppingCart,
  Database,
  LayoutGrid,
  Settings,
  CalendarClock,
  Layers,
  ScanFace,
  ClipboardList,
  Banknote,
  UserCheck,
  Wrench,
  CheckCircle,
  Briefcase,
  FileText,
  Target,
  IndianRupee, // Added Target for CRM
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { clearSession } from "@/src/lib/session";
import { HeaderProvider, useHeader } from "@/src/context/HeaderContext";
import ThemeToggle from "@/src/components/ThemeToggle";
import { API_BASE_URL } from "@/src/utils/config";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  priority?: number;
  subItems?: NavItem[];
};

const storeSubItems: NavItem[] = [
  { href: "/dashboard/store?tab=home", label: "Inventory", icon: PackageMinus },
  { href: "/dashboard/store?tab=material-issue", label: "Issue", icon: Layers }, // Changed icon and label to match Tabs
  { href: "/dashboard/store?tab=job-work", label: "Job Work", icon: Factory },
  { href: "/dashboard/store?tab=dc", label: "Bills", icon: IndianRupee },
  { href: "/dashboard/store?tab=masters", label: "Masters", icon: Settings }, // Changed icon to Settings to match Tabs
];

const hrSubItems: NavItem[] = [
  { href: "/dashboard/hr?tab=home", label: "Overview", icon: Home },
  { href: "/dashboard/hr?tab=attendance", label: "Kiosk", icon: ScanFace },
  { href: "/dashboard/hr?tab=present", label: "Present", icon: ClipboardList },
  { href: "/dashboard/hr?tab=salaries", label: "Salaries", icon: Banknote },
  { href: "/dashboard/hr?tab=master", label: "Masters", icon: Database },
];

const ppcSubItems: NavItem[] = [
  { href: "/dashboard/ppc?tab=overview", label: "Overview", icon: Home },
  { href: "/dashboard/ppc?tab=orders&subTab=po-list", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/ppc?tab=planning", label: "Planning", icon: CalendarClock },
  { href: "/dashboard/ppc?tab=master&subTab=machine-list", label: "Masters", icon: Settings },
];

const employeeSubItems: NavItem[] = [
  { href: "/dashboard/employee?tab=work", label: "Job", icon: Briefcase },
  { href: "/dashboard/employee?tab=attendance", label: "Attendance", icon: CalendarClock },
  { href: "/dashboard/employee?tab=payslips", label: "Salaries", icon: FileText }, // Using FileText as icon
];

const companyNav: NavItem[] = [
  { href: "/dashboard/admin/overview", label: "Overview", icon: LayoutDashboard, priority: 1 },
  { href: "/dashboard/admin", label: "User Mgmt", icon: Users, priority: 2 },
];

const departmentNavMap: Record<string, NavItem[]> = {
  HR: [{
    href: "/dashboard/hr",
    label: "HR ",
    icon: Shield,
    priority: 1,
    subItems: hrSubItems
  }],
  Store: [{
    href: "/dashboard/store",
    label: "Store",
    icon: Store,
    priority: 1,
    subItems: storeSubItems
  }],
  PPC: [{
    href: "/dashboard/ppc",
    label: "PPC",
    icon: Factory,
    priority: 1,
    subItems: ppcSubItems
  }],
  Security: [
    {
      href: "/dashboard/gate-entry",
      label: "Gate Entry",
      icon: UserCheck,
      priority: 2,
      subItems: [
        { href: "/dashboard/gate-entry?tab=overview", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/gate-entry?tab=kiosk", label: "Kiosk Mode", icon: ScanFace },
        { href: "/dashboard/gate-entry?tab=visitor", label: "Visitor Log", icon: Users },
        { href: "/dashboard/gate-entry?tab=vehicle", label: "Vehicle Log", icon: Truck },
      ]
    }
  ],
  Maintenance: [{ href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench, priority: 1 }],
  Quality: [{ href: "/dashboard/quality", label: "Quality", icon: CheckCircle, priority: 1 }],
  CRM: [{ href: "/dashboard/crm", label: "CRM", icon: Target, priority: 1 }],
  Accounts: [{ href: "/dashboard/accounts", label: "Accounts", icon: Wallet, priority: 1 }],
  Reports: [{ href: "/dashboard/reports", label: "Reports", icon: LineChart, priority: 1 }],
};

const fallbackNav: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, priority: 1 }];

const employeeNav: NavItem[] = [
  { href: "/dashboard/employee", label: "Dashboard", icon: LayoutDashboard, priority: 1, subItems: employeeSubItems },
];

function resolveNavItems(userType: string | null, department: string | null) {
  if (userType === "employee") {
    return employeeNav;
  }

  if (department === "Admin") {
    return companyNav;
  }

  const allModulesNav = [
    // { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, priority: 1 },
    ...(departmentNavMap.Reports || []),
    ...(departmentNavMap.HR || []),
    ...(departmentNavMap.Store || []),
    ...(departmentNavMap.PPC || []),
    ...(departmentNavMap.Security || []),
    ...(departmentNavMap.Maintenance || []),
    ...(departmentNavMap.Quality || []),
    ...(departmentNavMap.CRM || []),
    ...(departmentNavMap.Accounts || []),
  ];

  const upperDept = department?.toUpperCase();
  if (upperDept === "CEO" || upperDept === "MD" || upperDept === "MANAGER") {
    return [...allModulesNav].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }

  const matchedDepartmentNav = department
    ? Object.entries(departmentNavMap).find(([k]) => k.toUpperCase() === department.toUpperCase())?.[1]
    : null;

  const list =
    userType === "company"
      ? companyNav
      : matchedDepartmentNav
        ? matchedDepartmentNav
        : fallbackNav;

  return [...list].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { title, subtitle, showBottomNav, setShowBottomNav } = useHeader();

  // State
  const [navItems, setNavItems] = useState<NavItem[]>(fallbackNav);
  const [userName, setUserName] = useState("BinsAnalytics");
  const [userSubtitle, setUserSubtitle] = useState("Dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // New state for desktop toggle
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  // const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  // const [ppcMenuOpen, setPpcMenuOpen] = useState(false);
  const [pythonOnline, setPythonOnline] = useState<boolean | null>(null);

  // Scroll and route-based visibility for mobile bottom navigation
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setShowBottomNav(true);
  }, [pathname]);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let lastScrollTop = 0;

    const handleScroll = () => {
      const scrollTop = mainEl.scrollTop;
      const scrollHeight = mainEl.scrollHeight;
      const clientHeight = mainEl.clientHeight;

      const hasScroll = scrollHeight > clientHeight;
      const isAtBottom = hasScroll && (scrollHeight - scrollTop - clientHeight <= 15);

      if (scrollTop <= 10) {
        setShowBottomNav(true);
      } else if (isAtBottom) {
        setShowBottomNav(false);
      } else if (scrollTop < lastScrollTop || !hasScroll) {
        setShowBottomNav(true);
      }

      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    };

    mainEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      mainEl.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Check if we are in the Store or PPC module
  const isStoreModule = pathname?.startsWith("/dashboard/store");
  const isPPCModule = pathname?.startsWith("/dashboard/ppc");
  const isEmployeeModule = pathname?.startsWith("/dashboard/employee");

  useEffect(() => {
    const userType = localStorage.getItem("userType");
    const userInfoStr = localStorage.getItem("userInfo");
    let department: string | null = null;
    let resolvedName = "BinsAnalytics";
    let resolvedSubtitle = "Dashboard";

    if (userInfoStr) {
      try {
        const parsed = JSON.parse(userInfoStr);
        department = parsed?.department || null;
        resolvedName = parsed?.name || parsed?.companyName || resolvedName;
        resolvedSubtitle = parsed?.department || (userType === "company" ? "Company Admin" : resolvedSubtitle);
      } catch (err) {
        console.warn("Failed to parse user info from storage", err);
      }
    } else if (userType === "company") {
      resolvedSubtitle = "Company Admin";
    }

    const items = resolveNavItems(userType, department);
    setNavItems(items);
    setUserName(resolvedName);
    setUserSubtitle(resolvedSubtitle);

    // 🔒 Navigation Guard Logic
    if (pathname) {
      const isAuthorized = items.some(item => 
        pathname === item.href || pathname.startsWith(item.href + "/")
      );

      // Allow some global routes just in case they exist
      const isGlobalRoute = pathname === "/dashboard/profile" || pathname === "/dashboard/settings";

      if (!isAuthorized && !isGlobalRoute && pathname !== "/dashboard") {
        console.warn(`Unauthorized access attempt to ${pathname}. Redirecting...`);
        const fallbackRoute = items.length > 0 ? items[0].href : "/dashboard";
        router.replace(fallbackRoute);
        return; // Wait for redirect to finish
      }

      // If they are on the root /dashboard but it's not in their allowed items, redirect to their default home
      if (pathname === "/dashboard") {
        const hasDashboard = items.some(item => item.href === "/dashboard");
        if (!hasDashboard && items.length > 0) {
          router.replace(items[0].href);
          return;
        }
      }
    }

    setIsCheckingAuth(false);
  }, [pathname, router]);

  // Polling Python Health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = API_BASE_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/hr/python-health`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          }
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

    // Initial check
    checkHealth();
    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  // Mobile Bottom Nav Logic
  const mobileBottomNavItems = useMemo(() => {
    if (isStoreModule) {
      // For Store: Home, Material Issue, Bills
      return [
        storeSubItems[0], // Home
        storeSubItems[1], // Material Issue  
        storeSubItems[2], // Bills (parent with sub-items)
      ];
    }
    if (isPPCModule) {
      // For PPC: Home, PO List, Create PO, Create Work Order (First 4)
      return ppcSubItems.slice(0, 4);
    }
    if (isEmployeeModule) {
      return employeeSubItems;
    }
    // Default global nav (first 4)
    return navItems.slice(0, 4);
  }, [isStoreModule, isPPCModule, isEmployeeModule, navItems]);

  const mobileOverflowItems = useMemo(() => {
    if (isStoreModule) {
      // Remaining Store items: Masters only
      return [storeSubItems[3]]; // Masters
    }
    if (isPPCModule) {
      // Remaining PPC items
      return ppcSubItems.slice(4);
    }
    if (isEmployeeModule) {
      return [];
    }
    return navItems.slice(4);
  }, [isStoreModule, isPPCModule, isEmployeeModule, navItems]);

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Re-added renderNavLink function
  const renderNavLink = (item: NavItem, isMobile = false, isSubItem = false) => {
    const Icon = item.icon;
    // Check active state
    let isActive = false;
    if (item.href.includes("?")) {
      // For query param links (Store/PPC sub-items)
      const itemUrl = new URL(item.href, "http://dummy.com"); // helper for parsing
      const itemRecTab = itemUrl.searchParams.get("tab");
      const itemRecSubTab = itemUrl.searchParams.get("subTab");

      const currentTab = searchParams.get("tab") || "home";
      const currentSubTab = searchParams.get("subTab");

      const pathMatch = pathname === itemUrl.pathname;
      const tabMatch = itemRecTab === currentTab;
      // If the link has a subTab, it must match. If it doesn't, we only care about the tab.
      const subTabMatch = itemRecSubTab ? itemRecSubTab === currentSubTab : true;

      isActive = pathMatch && tabMatch && subTabMatch;
    } else {
      // For path links
      isActive = pathname === item.href || (!!pathname && pathname.startsWith(item.href + "/"));
    }

    const hasSubItems = item.subItems && item.subItems.length > 0;
    // const isStoreExpanded = item.label === "Store" && storeMenuOpen;
    // const isPPCExpanded = item.label === "PPC" && ppcMenuOpen;
    // const isExpanded = isStoreExpanded || isPPCExpanded;

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
            isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400",
          ].join(" ")}
        >
          <Icon size={24} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"} />
        </Link>
      );
    }

    // Desktop Sidebar Item
    return (
      <div key={item.label}>
        <Link
          href={item.href}
          onClick={(e) => {
            // if (hasSubItems) {
            //   // If clicking the parent item, toggle expansion
            //   if (item.label === "Store") {
            //     setStoreMenuOpen(!storeMenuOpen);
            //   } else if (item.label === "PPC") {
            //     setPpcMenuOpen(!ppcMenuOpen);
            //   }
            // }
          }}
          className={[
            "group flex items-center justify-between rounded-xl transition-all",
            isSubItem ? "pl-10 pr-3 py-2 text-sm" : "px-3 py-2 text-sm font-medium",
            isActive && !hasSubItems
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <Icon size={isSubItem ? 16 : 18} className={isActive && !hasSubItems ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 group-hover:text-indigo-500 dark:text-gray-500 dark:group-hover:text-indigo-400"} />
            <span className={desktopSidebarOpen ? "" : "hidden"}>{item.label}</span>
          </div>
          {hasSubItems && desktopSidebarOpen && (
            <div onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // if (item.label === "Store") {
              //   setStoreMenuOpen(!storeMenuOpen);
              // } else if (item.label === "PPC") {
              //   setPpcMenuOpen(!ppcMenuOpen);
              // }
            }}>
              {/* {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />} */}
            </div>
          )}
        </Link>
        {/* Render Sub-items */}
        {/* {hasSubItems && isExpanded && desktopSidebarOpen && (
          <div className="mt-1 flex flex-col gap-1">
            {item.subItems!.map(sub => renderNavLink(sub, false, true))}
          </div>
        )} */}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`${desktopSidebarOpen ? "w-64" : "hidden lg:block w-0 opacity-0 overflow-hidden"
          } bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col transition-all duration-300 ease-in-out hidden lg:flex`}
      >
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <span className={`font-bold text-xl text-gray-900 dark:text-white ${!desktopSidebarOpen && "hidden"}`}>
            BinsErp
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => renderNavLink(item))}
        </div>

        <div className="p-4 border-t border-gray-50 dark:border-gray-800">
          {desktopSidebarOpen ? (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 mb-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                {userName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userSubtitle}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold" title={userName}>
                {userName.charAt(0)}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${desktopSidebarOpen ? "gap-3 px-3" : "justify-center"} py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors`}
            title="Sign Out"
          >
            <LogOut size={18} />
            {desktopSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <div className="hidden lg:flex items-center px-4 py-3 bg-white dark:bg-gray-900/80 dark:backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 shrink-0">
          <button
            onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-3"
            title={desktopSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu size={20} />
          </button>

          {/* Dynamic Header Title */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{subtitle}</p>}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 cursor-help transition-all hover:bg-gray-100 dark:hover:bg-gray-700"
              title={pythonOnline === null ? "Checking AI Status..." : pythonOnline ? "AI Service is Online" : "AI Service is Offline"}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${pythonOnline === null ? "bg-gray-400" : pythonOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"}`}></div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest hidden sm:inline-block">AI</span>
            </div>

            {/* <ThemeToggle /> */}
          </div>
        </div>

        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Open Menu"
            >
              <LayoutGrid size={24} />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">B</span>
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">BinsErp</span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center p-1 cursor-help"
              title={pythonOnline === null ? "Checking AI Status..." : pythonOnline ? "AI Service is Online" : "AI Service is Offline"}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${pythonOnline === null ? "bg-gray-400" : pythonOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"}`}></div>
            </div>

            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{userName}</span>
            <button
              onClick={handleLogout}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto relative">
          {isCheckingAuth ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-950/50 backdrop-blur-sm z-50">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className={`lg:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 fixed bottom-0 left-0 right-0 z-30 pb-safe transition-transform duration-300 ease-in-out ${
          showBottomNav ? "translate-y-0" : "translate-y-full shadow-none pointer-events-none"
        }`}>
          <div className="flex items-center justify-around h-16 px-2">
            {mobileBottomNavItems.map((item) => (
              <div key={item.href} className="flex-1 h-full">
                {renderNavLink(item, true)}
              </div>
            ))}

            {/* More Button */}
            {mobileOverflowItems.length > 0 && (
              <div className="flex-1 h-full relative">
                <button
                  onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                  className={`flex flex-col items-center justify-center w-full h-full transition-all ${mobileMoreOpen ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"
                    }`}
                >
                  <MoreVertical size={24} />
                </button>

                {/* Overflow Menu */}
                {mobileMoreOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom-2">
                    {mobileOverflowItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMoreOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-800 last:border-0"
                      >
                        <item.icon size={18} className="text-gray-500 dark:text-gray-400" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Mobile Sidebar Drawer (for global nav) */}
      {
        mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
              <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <span className="font-bold text-xl text-gray-900 dark:text-white">Menu</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  {/* <ChevronDown className="rotate-90" size={20} /> */}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {navItems.map((item) => (
                  <div key={item.label}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                    >
                      <item.icon size={20} />
                      {item.label}
                    </Link>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-50 dark:border-gray-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )
      }

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
