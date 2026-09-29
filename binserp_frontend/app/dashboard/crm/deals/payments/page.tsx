"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMPaymentsLedger from "@/src/features/crm/components/CRMPaymentsLedger";

export default function CRMPaymentsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Payment Receipts", "Incoming Funds, Transaction Vouchers & Realized Collections");
  }, [setHeader]);

  return <CRMPaymentsLedger />;
}
