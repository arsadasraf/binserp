"use client";

import React from 'react';
import MRPTab from "../../components/tabs/MRPTab";
import { useStoreData } from "../../components/hooks/useStoreData";
import LoadingSpinner from "@/src/components/LoadingSpinner";

export default function PurchaseMRPPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const { data: mrpData, loading, refetch } = useStoreData("mrp", "vendor", token);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">MRP & Material Planning</h1>
        <p className="text-xs text-gray-500">Material Requirements Planning based on BOM and inventory stock</p>
      </div>

      <MRPTab />
    </div>
  );
}
