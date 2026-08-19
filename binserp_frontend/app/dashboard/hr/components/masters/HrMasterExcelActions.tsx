"use client";

import React, { useState, useRef, useEffect } from "react";
import { FileSpreadsheet, ChevronDown, Download, FileDown, Upload } from "lucide-react";
import { 
    downloadHrMasterExcelTemplate, 
    exportHrMasterDataToExcel 
} from "@/src/utils/excelHrMasterHelper";
import HrMasterExcelImportModal from "./HrMasterExcelImportModal";

interface HrMasterExcelActionsProps {
    masterTab: 'employee' | 'department' | 'designation' | 'employee-type' | 'skill' | 'holiday';
    data: any[];
    onSuccess: () => void;
}

export default function HrMasterExcelActions({ masterTab, data, onSuccess }: HrMasterExcelActionsProps) {
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

    return (
        <>
            <div className="relative inline-block" ref={menuRef}>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-bold transition-all shadow-sm"
                >
                    <FileSpreadsheet size={16} />
                    <span className="hidden sm:inline">Excel Actions</span>
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
                                exportHrMasterDataToExcel(masterTab, data);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors"
                        >
                            <Download size={15} className="text-emerald-600 dark:text-emerald-400" />
                            Export to Excel
                        </button>
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                downloadHrMasterExcelTemplate(masterTab);
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

            <HrMasterExcelImportModal
                isOpen={isImportModalOpen}
                masterTab={masterTab}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    setIsImportModalOpen(false);
                    onSuccess();
                }}
            />
        </>
    );
}
