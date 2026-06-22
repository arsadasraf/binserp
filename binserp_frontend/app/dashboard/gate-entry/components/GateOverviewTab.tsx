"use client";

import React from 'react';
import HRHomeTab from '../../hr/components/HRHomeTab';

export default function GateOverviewTab() {
    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Reusing HR Home Tab for consistent data/ui */}
            <HRHomeTab />
        </div>
    );
}
