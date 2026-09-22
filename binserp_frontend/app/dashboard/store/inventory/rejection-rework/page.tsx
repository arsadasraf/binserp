"use client";

import React from 'react';
import RejectionReworkHub from '@/src/features/store/components/tabs/RejectionReworkHub';

export default function StoreRejectionBinPage() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <RejectionReworkHub context="store" />
    </div>
  );
}
