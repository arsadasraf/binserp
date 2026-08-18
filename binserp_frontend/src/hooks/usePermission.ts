"use client";

import { useMemo, useState, useEffect } from "react";

export interface UserRolePolicy {
  module: string;
  tabs: (string | { name: string; actions: string[] })[];
}

export interface UserRole {
  _id?: string;
  name?: string;
  policies?: UserRolePolicy[];
}

export interface UserInfo {
  _id?: string;
  userType?: "company" | "user" | "employee" | "saasadmin";
  role?: UserRole;
  roles?: UserRole[];
  [key: string]: any;
}

export function usePermission() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userType, setUserType] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUserType = localStorage.getItem("userType") || "";
      const storedUserInfo = localStorage.getItem("userInfo");
      setUserType(storedUserType);
      if (storedUserInfo) {
        try {
          setUser(JSON.parse(storedUserInfo));
        } catch (e) {
          console.error("Failed to parse userInfo", e);
        }
      }
    }
  }, []);

  // O(1) permission set: "Module:Tab" and "Module:Tab:Action"
  const permissionSet = useMemo(() => {
    const set = new Set<string>();

    const rolesToCheck: UserRole[] = [];
    if (user?.role) rolesToCheck.push(user.role);
    if (Array.isArray(user?.roles)) rolesToCheck.push(...user.roles);

    for (const r of rolesToCheck) {
      if (!r || !Array.isArray(r.policies)) continue;
      for (const p of r.policies) {
        if (!p.module || !Array.isArray(p.tabs)) continue;
        for (const t of p.tabs) {
          if (typeof t === "string") {
            set.add(`${p.module}:${t}`);
            set.add(`${p.module}:${t}:read`);
            set.add(`${p.module}:${t}:create`);
            set.add(`${p.module}:${t}:update`);
            set.add(`${p.module}:${t}:delete`);
            set.add(`${p.module}:${t}:all`);
          } else if (t && typeof t === "object") {
            const tabName = t.name;
            if (tabName) {
              set.add(`${p.module}:${tabName}`);
              if (Array.isArray(t.actions)) {
                for (const act of t.actions) {
                  set.add(`${p.module}:${tabName}:${act}`);
                }
              }
            }
          }
        }
      }
    }

    return set;
  }, [user]);

  /**
   * Check if user has permission for a specific module and tab
   */
  const hasTabAccess = (moduleName: string, tabName: string): boolean => {
    if (userType === "saasadmin") return true;
    if (userType === "company") return true;

    let mod = moduleName.toLowerCase();
    if (mod === "gate-entry" || mod === "gateentry") mod = "security";

    const tab = tabName.toLowerCase();

    // Check GM / Full Access
    const rolesToCheck: UserRole[] = [];
    if (user?.role) rolesToCheck.push(user.role);
    if (Array.isArray(user?.roles)) rolesToCheck.push(...user.roles);
    for (const r of rolesToCheck) {
      if (r?.name === "GM" || r?.name === "Admin Default Role" || r?.name === "Company Management") {
        return true;
      }
    }

    // Direct key matches
    if (
      permissionSet.has(`${moduleName}:${tabName}`) ||
      permissionSet.has(`${moduleName}:${tabName}:all`) ||
      permissionSet.has(`${mod}:${tab}`) ||
      permissionSet.has(`${mod}:${tab}:all`)
    ) {
      return true;
    }

    // Tab Aliases
    // 1. Overview / Home
    if ((tab === "home" || tab === "overview") && (
      permissionSet.has(`${mod}:overview`) ||
      permissionSet.has(`${mod}:home`) ||
      permissionSet.has(`${moduleName}:overview`) ||
      permissionSet.has(`${moduleName}:home`)
    )) {
      return true;
    }

    // 2. Store: Inventory
    if ((tab === "inventory" || tab === "home") && mod === "store" && (
      permissionSet.has("store:inventory") ||
      permissionSet.has("store:home") ||
      permissionSet.has("Store:inventory") ||
      permissionSet.has("Store:home")
    )) {
      return true;
    }

    // 3. HR: Kiosk / Attendance
    if ((tab === "kiosk" || tab === "attendance") && mod === "hr" && (
      permissionSet.has("hr:kiosk") ||
      permissionSet.has("hr:attendance") ||
      permissionSet.has("HR:kiosk") ||
      permissionSet.has("HR:attendance")
    )) {
      return true;
    }

    // 4. Masters / Master
    if ((tab === "masters" || tab === "master") && (
      permissionSet.has(`${mod}:masters`) ||
      permissionSet.has(`${mod}:master`) ||
      permissionSet.has(`${moduleName}:masters`) ||
      permissionSet.has(`${moduleName}:master`)
    )) {
      return true;
    }

    // 5. Security / Gate Entry: Employee Movement
    if ((tab === "employee-movement" || tab === "movement") && (mod === "security" || mod === "gate-entry") && (
      permissionSet.has("security:employee-movement") ||
      permissionSet.has("security:movement") ||
      permissionSet.has("Security:employee-movement")
    )) {
      return true;
    }

    // Sub-route prefix matching (e.g., policy has "inventory" -> allows "inventory/rm-bo-stock", or policy has "purchase/po" -> allows "purchase")
    for (const key of permissionSet) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith(`${mod}:${tab}/`) || lowerKey.startsWith(`${mod}:${tab}:`)) {
        return true;
      }
      const prefix = `${mod}:`;
      if (lowerKey.startsWith(prefix)) {
        const storedTab = lowerKey.replace(prefix, "").split(":")[0];
        if (
          storedTab.startsWith(`${tab}/`) || 
          (tab === "inventory" && storedTab.startsWith("inventory/")) ||
          (tab === "masters" && storedTab.startsWith("master")) ||
          (tab === "kiosk" && (storedTab.startsWith("kiosk/") || storedTab.startsWith("attendance/")))
        ) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * Check if user has permission for a specific module, tab, and action
   */
  const hasPermission = (moduleName: string, tabName: string, action: string = "read"): boolean => {
    if (userType === "saasadmin") return true;
    if (userType === "company") return true;
    if (hasTabAccess(moduleName, tabName)) return true;
    return permissionSet.has(`${moduleName}:${tabName}:${action}`) || permissionSet.has(`${moduleName}:${tabName}`) || permissionSet.has(`${moduleName}:${tabName}:all`);
  };

  /**
   * Check if user is allowed to access any tab in a given module
   */
  const isModuleAllowed = (moduleName: string): boolean => {
    if (userType === "saasadmin") return true;
    if (userType === "company") return true;
    
    for (const key of permissionSet) {
      if (key.startsWith(`${moduleName}:`) || key.startsWith(`${moduleName.toLowerCase()}:`)) return true;
    }
    return false;
  };

  return {
    user,
    userType,
    hasTabAccess,
    hasPermission,
    isModuleAllowed,
    permissionSet,
  };
}
