"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMProposalsLedger from "@/src/features/crm/components/CRMProposalsLedger";

export default function CRMProposalsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Proposals & Quotations", "Sent Commercial Offers, Price Estimates & Acceptance Status");
  }, [setHeader]);

  return <CRMProposalsLedger />;
}
