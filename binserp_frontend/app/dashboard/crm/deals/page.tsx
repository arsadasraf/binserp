"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import DealsPipeline from "../components/DealsPipeline";

export default function CRMDealsPipelinePage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Deals & Opportunities", "Sales Stages, Win Probability & Pipeline Velocity");
  }, [setHeader]);

  return <DealsPipeline />;
}
