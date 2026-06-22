"use client";

import React, { useState } from 'react';
import AttendanceTab from '../../hr/components/AttendanceTab';
import ManualAttendanceTab from './ManualAttendanceTab';
import { UserCheck, ScanFace } from 'lucide-react';

export default function GateKioskTab() {
    const [subTab, setSubTab] = useState<'manual' | 'kiosk'>('manual');

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Tab toggles */}
            <div className="flex space-x-2 border-b border-gray-200 dark:border-slate-700 pb-0">
                <button 
                    onClick={() => setSubTab('manual')}
                    className={`px-6 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 ${subTab === 'manual' ? 'text-blue-600 bg-white dark:bg-slate-800 border-t border-x border-gray-200 dark:border-slate-700 -mb-px shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                >
                    <UserCheck size={18} />
                    Manual Attendance
                </button>
                <button 
                    onClick={() => setSubTab('kiosk')}
                    className={`px-6 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 ${subTab === 'kiosk' ? 'text-blue-600 bg-white dark:bg-slate-800 border-t border-x border-gray-200 dark:border-slate-700 -mb-px shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                >
                    <ScanFace size={18} />
                    Face Kiosk
                </button>
            </div>

            {/* Content */}
            <div className="pt-2">
                {subTab === 'manual' ? <ManualAttendanceTab /> : <AttendanceTab />}
            </div>
        </div>
    );
}
