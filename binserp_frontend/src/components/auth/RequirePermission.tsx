"use client";

import { useEffect, useState, ReactNode } from "react";

interface RequirePermissionProps {
  module: string;
  tab: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ module, tab, action, children, fallback = null }: RequirePermissionProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkPermission = () => {
      const userType = localStorage.getItem("userType");
      if (userType === "company") {
        setHasPermission(module.toLowerCase() === "admin");
        setIsChecking(false);
        return;
      }
      if (userType === "saasadmin") {
        setHasPermission(true);
        setIsChecking(false);
        return;
      }

      const userInfoStr = localStorage.getItem("userInfo");
      if (!userInfoStr) {
        setHasPermission(false);
        setIsChecking(false);
        return;
      }

      try {
        const userInfo = JSON.parse(userInfoStr);
        const rolesToCheck = [];
        if (userInfo.role) {
          rolesToCheck.push(userInfo.role);
        }
        if (Array.isArray(userInfo.roles)) {
          rolesToCheck.push(...userInfo.roles);
        }

        let granted = false;
        for (const role of rolesToCheck) {
          if (!role || !role.isActive) continue;

          const policy = role.policies?.find((p: any) => p.module === module);
          if (policy) {
            const tabPolicy = policy.tabs?.find((t: any) => t.name === tab);
            if (tabPolicy && (tabPolicy.actions.includes(action) || tabPolicy.actions.includes("all"))) {
              granted = true;
              break;
            }
          }
        }

        setHasPermission(granted);
      } catch (err) {
        setHasPermission(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkPermission();
  }, [module, tab, action]);

  if (isChecking) {
    return null; // Or a small loading spinner if preferred
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
