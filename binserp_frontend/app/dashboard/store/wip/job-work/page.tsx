"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStoreData } from '@/src/features/store/components/hooks/useStoreData';
import JobWorkStore from '@/src/features/store/components/tabs/JobWorkStore';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function WipJobWorkPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  if (!token) return <LoadingSpinner />;
  
  if (storeData.loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const handleSuccess = (msg: string) => {
    setToast({ type: 'success', message: msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleError = (msg: string) => {
    setToast({ type: 'error', message: msg });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {toast && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}
      <JobWorkStore
        vendors={storeData.vendors}
        jobWorkSuppliers={storeData.jobWorkSuppliers}
        rawMaterials={storeData.rawMaterials}
        boughtOuts={storeData.boughtOuts}
        materials={storeData.materials}
        inventoryList={storeData.inventoryList}
        inHouseItems={storeData.fgItems}
        mrpPlans={storeData.mrpPlans}
        activeTab="wip"
        token={token}
        companyInfo={storeData.companyInfo}
        onError={handleError}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
