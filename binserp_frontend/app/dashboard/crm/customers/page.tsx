"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CustomerDirectory from "../components/CustomerDirectory";

export default function CRMCustomersPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Customer 360", "Customer Directory, Contact Profiles & Financial Snapshot");
  }, [setHeader]);

  return <CustomerDirectory />;
}
