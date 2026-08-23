"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function RmBoStockPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/store/inventory/rm-stock');
  }, [router]);

  return (
    <div className="flex justify-center items-center h-64">
      <LoadingSpinner />
    </div>
  );
}
