"use client";

import React from 'react';
import RejectionReworkHub from '@/src/features/store/components/tabs/RejectionReworkHub';

export default function JobWorkRejectionsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <RejectionReworkHub context="wip-jobwork" />
    </div>
  );
}
