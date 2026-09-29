"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import LeadKanban from "../components/LeadKanban";

export default function CRMLeadsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Lead Pipeline", "Kanban Stages, Multi-Platform Ingestion & 1-Click Conversions");
  }, [setHeader]);

  return <LeadKanban />;
}
