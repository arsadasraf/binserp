"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MaterialRequestTab from "@/src/features/store/components/tabs/MaterialRequestTab";

function MaterialRequestsContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || (searchParams.get('tab') === 'ledger' ? 'ledger' : 'all');

  return (
    <div className="space-y-4">
      <MaterialRequestTab initialType={typeParam} />
    </div>
  );
}

export default function MaterialRequestsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Material Requests...</div>}>
      <MaterialRequestsContent />
    </Suspense>
  );
}
