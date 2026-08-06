"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStoreData } from '@/src/features/store/components/hooks/useStoreData';
import MaterialIssueTab from '@/src/features/store/components/tabs/MaterialIssueTab';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function WipHistoryPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        router.push("/login");
      } else {
        setToken(storedToken);
      }
    }
  }, [router]);

  // Use the existing mega-hook configured for the WIP/Material Issue tab
  const storeData = useStoreData("wip", "vendor", token);

  if (!token) return <LoadingSpinner />;
  
  if (storeData.loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <MaterialIssueTab
        storeData={storeData}
        token={token}
        activeSubTab="history"
      />
    </div>
  );
}
