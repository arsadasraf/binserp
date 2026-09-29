"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMTeamAccessInspector from "@/src/features/crm/components/CRMTeamAccessInspector";

export default function CRMTeamAccessPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("CRM Team & User Access", "Inspect Staff Accounts, Assigned Roles & Granted CRM Tab Permissions");
  }, [setHeader]);

  return <CRMTeamAccessInspector />;
}
