"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { apiGet } from "@/src/lib/api";
import JobWorkRateDirectoryTab, {
  UnifiedVendorOption,
} from "@/src/features/store/components/tabs/JobWorkRateDirectoryTab";

export default function JobWorkRateDirectoryPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [vendors, setVendors] = useState<UnifiedVendorOption[]>([]);
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

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [dirRes, vendorRes, jwSupplierRes] = await Promise.all([
        apiGet("/api/store/job-work/rate-directory", token).catch(() => ({ data: { entries: [] } })),
        apiGet("/api/store/vendor", token).catch(() => ({ data: { vendors: [] } })),
        apiGet("/api/store/job-work-supplier", token).catch(() => ({ data: { suppliers: [] } })),
      ]);

      const dirList =
        dirRes?.data?.entries ||
        dirRes?.entries ||
        (Array.isArray(dirRes?.data) ? dirRes.data : []);
      setEntries(Array.isArray(dirList) ? dirList : []);

      const rawVendors =
        vendorRes?.data?.vendors ||
        vendorRes?.vendors ||
        (Array.isArray(vendorRes?.data) ? vendorRes.data : []);

      const rawSuppliers =
        jwSupplierRes?.data?.suppliers ||
        jwSupplierRes?.suppliers ||
        jwSupplierRes?.data?.jobWorkSuppliers ||
        (Array.isArray(jwSupplierRes?.data) ? jwSupplierRes.data : []);

      const mergedMap = new Map<string, UnifiedVendorOption>();

      (Array.isArray(rawVendors) ? rawVendors : []).forEach((v: any) => {
        if (!v?._id && !v?.name) return;
        const id = String(v._id || v.id || v.name);
        mergedMap.set(`Vendor:${id}`, {
          id,
          source: "Vendor",
          name: v.name || v.companyName || v.vendorName || "Unnamed Vendor",
          contactPerson: v.contactPerson || v.contactName || "",
          phone: v.phone || v.mobile || v.contactNumber || "",
          email: v.email || "",
          gst: v.gstNumber || v.gst || v.gstin || "",
          address: [v.address, v.city, v.state].filter(Boolean).join(", "),
        });
      });

      (Array.isArray(rawSuppliers) ? rawSuppliers : []).forEach((s: any) => {
        if (!s?._id && !s?.name) return;
        const id = String(s._id || s.id || s.name);
        mergedMap.set(`JobWorkSupplier:${id}`, {
          id,
          source: "JobWorkSupplier",
          name: s.name || s.supplierName || s.companyName || "Unnamed JW Supplier",
          contactPerson: s.contactPerson || s.contactName || "",
          phone: s.phone || s.mobile || s.contactNumber || "",
          email: s.email || "",
          gst: s.gstNumber || s.gst || s.gstin || "",
          address: [s.address, s.city, s.state].filter(Boolean).join(", "),
        });
      });

      const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setVendors(mergedList);
    } catch (err) {
      console.error("Failed to load Job Work Rate Directory:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!token) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <JobWorkRateDirectoryTab
        entries={entries}
        vendors={vendors}
        loading={loading}
        token={token}
        onRefresh={fetchData}
      />
    </div>
  );
}
