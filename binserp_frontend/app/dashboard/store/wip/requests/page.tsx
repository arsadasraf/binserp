"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WipRequestsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/store/wip/requests/rm-bo');
  }, [router]);

  return null;
}
