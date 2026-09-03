"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StoreRejectionRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/quality/rejection-hub');
  }, [router]);

  return null;
}
