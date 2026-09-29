"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMMastersManager from "@/app/dashboard/crm/components/CRMMastersManager";

export default function CRMPipelineSettingsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Pipeline Configuration", "Lead Sources, Pipeline Stages, Win Probabilities & Loss Reasons");
  }, [setHeader]);

  return <CRMMastersManager />;
}
