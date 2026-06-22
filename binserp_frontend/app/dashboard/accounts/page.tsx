"use client";

import { useState, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import { motion, AnimatePresence } from "framer-motion";

// Components
import AccountsOverview from "./components/AccountsOverview";
import InvoicesTab from "./components/InvoicesTab";
import ExpensesTab from "./components/ExpensesTab";
import LedgerTab from "./components/LedgerTab";
import AccountsTabs from "./components/AccountsTabs";

type Tab = "overview" | "invoices" | "expenses" | "ledger";

export default function AccountsDashboard() {
    const { setHeader } = useHeader();
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    useEffect(() => {
        setHeader("Accounts & Finance", "Manage Ledgers, Invoices, Expenses, and Cash Flow.");
    }, [setHeader]);

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
            <div className="p-4 max-w-[1600px] mx-auto space-y-6">
                {/* Tab Navigation */}
                <AccountsTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* Content Area */}
                <div className="bg-transparent min-h-[600px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {activeTab === "overview" && <AccountsOverview />}
                            {activeTab === "invoices" && <InvoicesTab />}
                            {activeTab === "expenses" && <ExpensesTab />}
                            {activeTab === "ledger" && <LedgerTab />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
