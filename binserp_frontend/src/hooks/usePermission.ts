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
    if (userType === "company") return moduleName.toLowerCase() === "admin";
    return permissionSet.has(`${moduleName}:${tabName}`) || permissionSet.has(`${moduleName}:${tabName}:all`) || permissionSet.has(`${moduleName.toLowerCase()}:${tabName.toLowerCase()}`);
  };

  /**
   * Check if user has permission for a specific module, tab, and action
   */
  const hasPermission = (moduleName: string, tabName: string, action: string = "read"): boolean => {
    if (userType === "saasadmin") return true;
    if (userType === "company") return moduleName.toLowerCase() === "admin";
    return permissionSet.has(`${moduleName}:${tabName}:${action}`) || permissionSet.has(`${moduleName}:${tabName}`) || permissionSet.has(`${moduleName}:${tabName}:all`);
  };

  /**
   * Check if user is allowed to access any tab in a given module
   */
  const isModuleAllowed = (moduleName: string): boolean => {
    if (userType === "saasadmin") return true;
    if (userType === "company") return moduleName.toLowerCase() === "admin";
    
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
