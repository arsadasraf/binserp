"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OutwardRfqTab from '@/src/features/store/components/tabs/OutwardRfqTab';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function OutwardRfqPage() {
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
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      <OutwardRfqTab
        token={token}
        onError={(msg) => setErrorMsg(msg)}
        onSuccess={(msg) => setSuccessMsg(msg)}
      />
    </div>
  );
}
