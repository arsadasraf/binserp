"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStoreData } from '@/src/features/store/components/hooks/useStoreData';
import JobWorkPOTable from '@/src/features/store/components/tables/JobWorkPOTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { apiGet } from '@/src/lib/api';

export default function JobWorkOutwardPOPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [jobWorkPOs, setJobWorkPOs] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState<boolean>(true);

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

  const fetchJobWorkPOs = useCallback(async () => {
    if (!token) return;
    setLoadingPOs(true);
    try {
      const res = await apiGet('/api/purchase/po?poType=jobwork', token);
      const list = res?.pos || res?.data || (Array.isArray(res) ? res : []);
      setJobWorkPOs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch Job Work POs:", err);
      setJobWorkPOs([]);
    } finally {
      setLoadingPOs(false);
    }
  }, [token]);

  useEffect(() => {
    fetchJobWorkPOs();
  }, [fetchJobWorkPOs]);

  if (!token) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <JobWorkPOTable
        data={jobWorkPOs}
        vendors={storeData.vendors}
        materials={storeData.materials}
        inHouseItems={storeData.fgItems}
        rawMaterials={storeData.rawMaterials}
        boughtOuts={storeData.boughtOuts}
        inventoryList={storeData.inventoryList}
        mrpPlans={storeData.mrpPlans}
        companyInfo={storeData.companyInfo}
        loading={loadingPOs}
        onRefresh={fetchJobWorkPOs}
      />
    </div>
  );
}
