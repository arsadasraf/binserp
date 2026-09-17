"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PPCTracingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ppc/overview/traceability");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
}
