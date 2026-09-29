"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CustomerDirectory from "@/app/dashboard/crm/components/CustomerDirectory";

export default function CRMCustomerMasterPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Customer Master", "Manually Register & Manage Customer Accounts, Tax Details & Contacts");
  }, [setHeader]);

  return <CustomerDirectory />;
}
