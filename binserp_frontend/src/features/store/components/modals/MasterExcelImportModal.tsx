/**
 * MasterExcelImportModal Component
 * 
 * Interactive Modal for importing master data via Excel spreadsheets.
 * Supports download of standard templates, live file drag & drop parsing, 
 * row validation previews, overwrite toggles, and backend batch submission.
 */

import React, { useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertTriangle, FileSpreadsheet, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import { MasterType } from "@/src/features/store/types/store.types";
import { 
    MASTER_EXCEL_CONFIGS, 
    downloadMasterExcelTemplate, 
    parseMasterExcelFile, 
    ParsedMasterExcelResult 
} from '@/src/utils/excelMasterHelper';
import { API_BASE_URL } from '@/src/utils/config';

interface MasterExcelImportModalProps {
    isOpen: boolean;
    masterTab: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function MasterExcelImportModal({ isOpen, masterTab, onClose, onSuccess }: MasterExcelImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parsedResult, setParsedResult] = useState<ParsedMasterExcelResult | null>(null);
    const [viewTab, setViewTab] = useState<'valid' | 'invalid'>('valid');
    const [overwrite, setOverwrite] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const config = MASTER_EXCEL_CONFIGS[masterTab] || MASTER_EXCEL_CONFIGS['rm-bo-item'];

    const handleFileChange = async (selectedFile: File) => {
        if (!selectedFile) return;
        setFile(selectedFile);
        setParsing(true);
        try {
            const result = await parseMasterExcelFile(selectedFile, masterTab);
            setParsedResult(result);
            if (result.validRows.length === 0 && result.invalidRows.length > 0) {
                setViewTab('invalid');
            } else {
                setViewTab('valid');
            }
        } catch (error: any) {
            console.error("Failed to parse Excel file:", error);
            const msg = error?.message ? `Failed to parse Excel file: ${error.message}` : "Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.";
            alert(msg);
        } finally {
            setParsing(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleUploadSubmit = async () => {
        if (!parsedResult || parsedResult.validRows.length === 0) {
            alert("No valid rows to import.");
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/store/masters/bulk-import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    masterTab,
                    items: parsedResult.validRows,
                    overwrite
                })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Successfully imported ${data.insertedCount || parsedResult.validRows.length} items! ${data.updatedCount ? `(${data.updatedCount} updated)` : ''}`);
                onSuccess();
                onClose();
            } else {
                const errJson = await res.json();
                alert(`Bulk import failed: ${errJson.message || 'Server error'}`);
            }
        } catch (error) {
            console.error("Bulk import submission error:", error);
            alert("Error submitting bulk import.");
        } finally {
            setSubmitting(false);
        }
    };

    const resetModal = () => {
        setFile(null);
        setParsedResult(null);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="p-6 bg-gradient-to-r from-emerald-900 to-teal-950 text-white flex justify-between items-center flex-shrink-0 border-b border-emerald-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-800/80 rounded-xl flex items-center justify-center border border-emerald-600">
                            <FileSpreadsheet size={20} className="text-emerald-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold tracking-tight text-emerald-100">Import Master Data via Excel</h2>
                            <p className="text-xs text-emerald-300/80 mt-0.5">{config.title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => downloadMasterExcelTemplate(masterTab)}
                            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 border border-emerald-500/50"
                            title="Download standard Excel template format for this master tab"
                        >
                            <Download size={14} /> Download Template
                        </button>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-emerald-950 hover:bg-emerald-900 flex items-center justify-center text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {!parsedResult ? (
                        /* Step 1: Upload Dropzone */
                        <div className="space-y-4">
                            <div className="bg-emerald-50/60 dark:bg-slate-800/60 p-4 rounded-2xl border border-emerald-200/80 dark:border-slate-700 text-xs flex justify-between items-center">
                                <div>
                                    <span className="font-extrabold text-emerald-800 dark:text-emerald-300 uppercase text-[10px] block">STANDARD EXCEL FORMAT</span>
                                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">Need the correct column structure? Download the pre-formatted Excel template for <b>{masterTab}</b>.</p>
                                </div>
                                <button 
                                    onClick={() => downloadMasterExcelTemplate(masterTab)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <Download size={14} /> Download Standard Excel
                                </button>
                            </div>

                            <div 
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                className="border-2 border-dashed border-emerald-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 rounded-3xl p-10 text-center flex flex-col items-center justify-center transition-all cursor-pointer group"
                            >
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                                    className="hidden" 
                                    id="master-excel-upload-input" 
                                />
                                <label htmlFor="master-excel-upload-input" className="cursor-pointer flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Upload size={28} />
                                    </div>
                                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Drag & drop your Excel file here</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supports .xlsx and .xls spreadsheet files</p>
                                    <span className="mt-4 px-4 py-2 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-slate-700 rounded-xl font-bold text-xs shadow-sm">
                                        Browse Computer File
                                    </span>
                                </label>
                            </div>

                            {parsing && (
                                <div className="text-center py-4 flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs">
                                    <RefreshCw className="animate-spin" size={16} /> Parsing and validating Excel data...
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Step 2: Data Validation & Preview Table */
                        <div className="space-y-4">
                            
                            {/* Summary Banner */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={24} />
                                    <div>
                                        <strong className="text-sm font-extrabold text-slate-900 dark:text-white">{file?.name}</strong>
                                        <div className="text-slate-500 text-[11px] mt-0.5">Total Rows Found: <b>{parsedResult.totalCount}</b></div>
                                    </div>
                                </div>

                                <button 
                                    onClick={resetModal}
                                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-300 transition-colors flex items-center gap-1"
                                >
                                    <RefreshCw size={12} /> Upload Different File
                                </button>
                            </div>

                            {/* View Tabs */}
                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setViewTab('valid')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                            viewTab === 'valid'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <CheckCircle size={14} className="text-emerald-600" />
                                        Valid Rows ({parsedResult.validRows.length})
                                    </button>

                                    <button 
                                        onClick={() => setViewTab('invalid')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                            viewTab === 'invalid'
                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <AlertTriangle size={14} className="text-rose-600" />
                                        Invalid / Rejected ({parsedResult.invalidRows.length})
                                    </button>
                                </div>

                                {/* Overwrite Option */}
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={overwrite}
                                        onChange={(e) => setOverwrite(e.target.checked)}
                                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                    />
                                    <span>Update existing items if code matches</span>
                                </label>
                            </div>

                            {/* Preview Table */}
                            {viewTab === 'valid' ? (
                                parsedResult.validRows.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-slate-400 text-xs">
                                        No valid rows found in the uploaded file.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm max-h-72 overflow-y-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-emerald-50 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 font-bold uppercase sticky top-0">
                                                <tr>
                                                    <th className="p-3 w-10 text-center">#</th>
                                                    {config.columns.map(col => (
                                                        <th key={col.key} className="p-3 whitespace-nowrap">{col.label.replace(/\*/g, '')}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                {parsedResult.validRows.map((row: any, rIdx: number) => (
                                                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="p-3 text-center text-slate-400 font-mono">{rIdx + 1}</td>
                                                        {config.columns.map(col => (
                                                            <td key={col.key} className="p-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                                                                {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                parsedResult.invalidRows.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-emerald-600 font-bold text-xs">
                                        <CheckCircle className="mx-auto mb-1" size={24} />
                                        Zero invalid rows! All rows passed validation checks.
                                    </div>
                                ) : (
                                    <div className="border border-rose-200 dark:border-rose-950/50 rounded-2xl overflow-hidden shadow-sm max-h-72 overflow-y-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 font-bold uppercase sticky top-0">
                                                <tr>
                                                    <th className="p-3 w-14 text-center">Row</th>
                                                    <th className="p-3">Validation Errors</th>
                                                    <th className="p-3">Raw Data Snippet</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                                                {parsedResult.invalidRows.map((inv: any, iIdx: number) => (
                                                    <tr key={iIdx} className="bg-rose-50/40 dark:bg-rose-950/20">
                                                        <td className="p-3 text-center font-mono font-bold text-rose-700 dark:text-rose-400">{inv.rowNumber}</td>
                                                        <td className="p-3 font-semibold text-rose-600 dark:text-rose-400">
                                                            <ul className="list-disc pl-4 space-y-0.5">
                                                                {inv.errors.map((err: string, eIdx: number) => (
                                                                    <li key={eIdx}>{err}</li>
                                                                ))}
                                                            </ul>
                                                        </td>
                                                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-xs">
                                                            {JSON.stringify(inv.data)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )}

                        </div>
                    )}

                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl">
                        Cancel
                    </button>

                    {parsedResult && parsedResult.validRows.length > 0 && (
                        <button 
                            disabled={submitting}
                            onClick={handleUploadSubmit}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw className="animate-spin" size={15} /> Importing Masters...
                                </>
                            ) : (
                                <>
                                    Confirm & Import {parsedResult.validRows.length} Items <ArrowRight size={15} />
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
