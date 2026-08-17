"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InwardRfqTab from '@/src/features/store/components/tabs/InwardRfqTab';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function SalesRFQPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  if (!token) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      <InwardRfqTab
        token={token}
        onError={(msg) => setErrorMsg(msg)}
        onSuccess={(msg) => setSuccessMsg(msg)}
      />
    </div>
  );
}
