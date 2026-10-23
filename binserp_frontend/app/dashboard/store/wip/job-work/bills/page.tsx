"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import JobWorkBillTable from '@/src/features/store/components/tables/JobWorkBillTable';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { apiGet } from '@/src/lib/api';

export default function JobWorkBillsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  const fetchBillsAndVendors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [billsRes, vendorsRes] = await Promise.all([
        apiGet('/api/purchase/bill?billType=job-work-service', token).catch(() => ({ data: { bills: [] } })),
        apiGet('/api/store/vendor', token).catch(() => ({ data: { vendors: [] } }))
      ]);

      const billsData = billsRes?.data?.bills || billsRes?.bills || (Array.isArray(billsRes?.data) ? billsRes.data : []);
      const vendorsData = vendorsRes?.data?.vendors || vendorsRes?.vendors || (Array.isArray(vendorsRes?.data) ? vendorsRes.data : []);

      setBills(Array.isArray(billsData) ? billsData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
    } catch (err) {
      console.error("Failed to load Job Work Bills:", err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBillsAndVendors();
  }, [fetchBillsAndVendors]);

  if (!token) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <JobWorkBillTable
        bills={bills}
        vendors={vendors}
        loading={loading}
        onRefresh={fetchBillsAndVendors}
      />
    </div>
  );
}
