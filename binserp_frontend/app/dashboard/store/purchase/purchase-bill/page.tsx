"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PurchaseBillTable from "@/src/features/store/components/tables/PurchaseBillTable";
import { PurchaseBill, PurchaseBillMetrics } from "@/src/features/purchase/types/purchaseBill.types";
import { API_BASE_URL } from "@/src/utils/config";

export default function PurchaseBillPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [metrics, setMetrics] = useState<PurchaseBillMetrics | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [vendors, setVendors] = useState<any[]>([]);

  // Filter States
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch Vendors
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/store/vendor`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const vList = data?.vendors || data?.data || (Array.isArray(data) ? data : []);
        setVendors(vList);
      })
      .catch(() => {});
  }, [token]);

  // Fetch Purchase Bills
  const fetchBills = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedVendorId && selectedVendorId !== "all") params.set("vendorId", selectedVendorId);
      if (selectedStatus && selectedStatus !== "all") params.set("paymentStatus", selectedStatus);
      if (selectedCategory && selectedCategory !== "all") params.set("grnCategory", selectedCategory);
      if (searchTerm && searchTerm.trim()) params.set("search", searchTerm.trim());

      const res = await fetch(`${API_BASE_URL}/api/purchase/bill?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();

      if (res.ok) {
        const responseData = json?.data;
        if (responseData && Array.isArray(responseData.bills)) {
          setBills(responseData.bills);
          setMetrics(responseData.metrics);
        } else if (Array.isArray(responseData)) {
          setBills(responseData);
        } else if (Array.isArray(json)) {
          setBills(json);
        } else {
          setBills([]);
        }
      } else {
        setBills([]);
      }
    } catch (err) {
      console.error("Failed to fetch purchase bills:", err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, selectedVendorId, selectedStatus, selectedCategory, searchTerm]);

  // Fetch when filters change (with debounce on search)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBills]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <PurchaseBillTable
        bills={bills}
        metrics={metrics}
        loading={loading}
        onRefresh={fetchBills}
        vendors={vendors}
        startDate={startDate}
        endDate={endDate}
        onDateChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        selectedVendorId={selectedVendorId}
        onVendorChange={setSelectedVendorId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
    </div>
  );
}
