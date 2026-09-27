"use client";

import React from 'react';
import MRPTab from "@/src/features/store/components/tabs/MRPTab";

export default function MRPDashboard() {
  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col">
      <MRPTab />
    </div>
  );
}
