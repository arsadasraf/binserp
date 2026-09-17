"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Users, Package, FileText, Download } from 'lucide-react';
import MachineReports from './components/MachineReports';
import EmployeeReports from './components/EmployeeReports';
import InventoryReports from './components/InventoryReports';

type ReportTab = 'machines' | 'employees' | 'inventory';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>('machines');

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-20">
            <div className="p-4 max-w-[1600px] mx-auto">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
                            <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
                                <FileText size={20} />
                            </span>
                            Operational Intelligence & Reports
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                            Live dynamic performance analytics across Workstations & OEE, Workforce & Productivity, and Complete Store Inventory.
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2 mb-8 p-1.5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-fit shadow-sm">
                    <TabButton
                        id="machines"
                        label="Machines & OEE"
                        icon={Cpu}
                        isActive={activeTab === 'machines'}
                        onClick={() => setActiveTab('machines')}
                    />
                    <TabButton
                        id="employees"
                        label="Workforce & Productivity"
                        icon={Users}
                        isActive={activeTab === 'employees'}
                        onClick={() => setActiveTab('employees')}
                    />
                    <TabButton
                        id="inventory"
                        label="Inventory & Stocks"
                        icon={Package}
                        isActive={activeTab === 'inventory'}
                        onClick={() => setActiveTab('inventory')}
                    />
                </div>

                {/* Content Area */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'machines' && <MachineReports />}
                        {activeTab === 'employees' && <EmployeeReports />}
                        {activeTab === 'inventory' && <InventoryReports />}
                    </motion.div>
                </AnimatePresence>

            </div>
        </div>
    );
}

function TabButton({ id, label, icon: Icon, isActive, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${isActive ? "text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                }`}
        >
            {isActive && (
                <motion.div
                    layoutId="activeReportTab"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/30"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <div className="relative z-10 flex items-center gap-2">
                <Icon size={18} />
                {label}
            </div>
        </button>
    );
}