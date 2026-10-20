import React from "react";
import CRMProformaLedger from "@/src/features/crm/components/CRMProformaLedger";

export const metadata = {
  title: "Proforma Invoices (PI) | CRM | Binserp",
  description: "Manage commercial Proforma Invoices, advance payment terms, revisions, and tax invoice conversion."
};

export default function ProformaPage() {
  return <CRMProformaLedger />;
}
