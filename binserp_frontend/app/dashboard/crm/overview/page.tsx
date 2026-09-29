"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMOverview from "../components/CRMOverview";

export default function CRMOverviewPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("CRM Overview", "Real-Time Pipeline Analytics, KPIs & Conversion Funnels");
  }, [setHeader]);

  return <CRMOverview />;
}
