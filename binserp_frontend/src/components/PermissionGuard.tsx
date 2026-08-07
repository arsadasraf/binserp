"use client";

import React, { ReactNode } from "react";
import { usePermission } from "@/src/hooks/usePermission";

interface PermissionGuardProps {
  module: string;
  tab: string;
  action?: "read" | "create" | "update" | "delete" | "all" | string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative component to wrap buttons/tabs/UI elements that require specific permissions.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  module,
  tab,
  action = "read",
  fallback = null,
  children,
}) => {
  const { hasPermission } = usePermission();

  if (hasPermission(module, tab, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
