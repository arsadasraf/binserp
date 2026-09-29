"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMIntegrationsHub from "@/app/dashboard/crm/components/CRMIntegrationsHub";

export default function CRMIntegrationsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("API & Tool Credentials", "Configure IndiaMART, TradeIndia & Inbound Webhook Credentials in Master");
  }, [setHeader]);

  return <CRMIntegrationsHub />;
}
