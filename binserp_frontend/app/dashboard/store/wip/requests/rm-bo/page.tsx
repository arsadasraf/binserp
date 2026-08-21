"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStoreData } from '@/src/features/store/components/hooks/useStoreData';
import MaterialIssueTab from '@/src/features/store/components/tabs/MaterialIssueTab';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function RmBoRequestsPage() {
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

  const storeData = useStoreData("wip", "vendor", token);

  if (!token || storeData.loading) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-300">
      <MaterialIssueTab
        storeData={storeData}
        token={token}
        activeSubTab="requests"
        requestTypeFilter="bo"
        title="RM / BO Material Requests"
        description="Pending store requests for Raw Materials and Bought Out items"
      />
    </div>
  );
}
