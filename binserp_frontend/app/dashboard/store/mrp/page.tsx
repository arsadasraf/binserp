"use client";

import React from 'react';
import { MRPDashboard } from '@/src/features/mrp';

export default function StoreMRPPage() {
  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden">
      <MRPDashboard />
    </div>
  );
}
