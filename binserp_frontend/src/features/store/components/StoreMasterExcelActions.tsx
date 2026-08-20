"use client";

import React, { useState, useRef, useEffect } from "react";
import { FileSpreadsheet, ChevronDown, Download, FileDown, Upload } from "lucide-react";
import { downloadMasterExcelTemplate } from "@/src/utils/excelMasterHelper";
import MasterExcelImportModal from "./modals/MasterExcelImportModal";
import * as XLSX from "xlsx";

interface StoreMasterExcelActionsProps {
    masterTab: string;
    onExport?: () => void;
    data?: any[];
    onSuccess?: () => void;
}

export default function StoreMasterExcelActions({
    masterTab,
    onExport,
    data = [],
    onSuccess
}: StoreMasterExcelActionsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleExport = () => {
        if (onExport) {
            onExport();
            return;
        }

        // Default Export fallback if onExport not provided
        if (data && data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Data");
            XLSX.writeFile(wb, `${masterTab}_export_${new Date().toISOString().split("T")[0]}.xlsx`);
        }
    };

    return (
        <>
            <div className="relative inline-block" ref={menuRef}>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    type="button"
                    className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                    title="Excel Import, Export, and Template options"
                >
                    <FileSpreadsheet size={15} />
                    <span>Excel Actions</span>
                    <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`}
                    />
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                handleExport();
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors"
                        >
                            <Download size={15} className="text-emerald-600 dark:text-emerald-400" />
                            Export to Excel
                        </button>
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                downloadMasterExcelTemplate(masterTab);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors"
                        >
                            <FileDown size={15} className="text-indigo-600 dark:text-indigo-400" />
                            Download Sample Template
                        </button>
                        <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                setIsImportModalOpen(true);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-2.5 transition-colors"
                        >
                            <Upload size={15} />
                            Import from Excel
                        </button>
                    </div>
                )}
            </div>

            <MasterExcelImportModal
                isOpen={isImportModalOpen}
                masterTab={masterTab}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    setIsImportModalOpen(false);
                    if (onSuccess) {
                        onSuccess();
                    } else {
                        window.location.reload();
                    }
                }}
            />
        </>
    );
}
