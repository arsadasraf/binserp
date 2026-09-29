"use client";

import { useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import CRMProductShowcase from "@/src/features/crm/components/CRMProductShowcase";

export default function CRMProductsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader("Product Catalog & Photos", "Commercial Machinery & Offerings with Photos, Specs & Tax Matrices");
  }, [setHeader]);

  return <CRMProductShowcase />;
}
