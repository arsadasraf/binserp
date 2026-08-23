"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function MaterialsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/store/masters/raw-materials');
  }, [router]);

  return (
    <div className="flex justify-center items-center h-64">
      <LoadingSpinner />
    </div>
  );
}
