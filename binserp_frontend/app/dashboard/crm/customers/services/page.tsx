"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import AfterSalesServicesHub from "@/src/features/crm/components/AfterSalesServicesHub";

export default function CRMAfterSalesServicesPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("After-Sales Services", "Installed Base, Warranty Status & Field Service Support Tickets");
  }, [setHeader]);

  return <AfterSalesServicesHub />;
}
