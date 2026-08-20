/**
 * HrMasterExcelImportModal Component
 * 
 * Interactive Modal for importing HR master data via Excel spreadsheets.
 * Supports download of standard templates, live file drag & drop parsing, 
 * row validation previews, overwrite toggles, and backend batch submission.
 */

import React, { useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertTriangle, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import { 
    HR_MASTER_EXCEL_CONFIGS, 
    downloadHrMasterExcelTemplate, 
    parseHrMasterExcelFile, 
    ParsedHrMasterExcelResult 
} from '@/src/utils/excelHrMasterHelper';
import { API_BASE_URL } from '@/src/utils/config';

interface HrMasterExcelImportModalProps {
    isOpen: boolean;
    masterTab: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function HrMasterExcelImportModal({ isOpen, masterTab, onClose, onSuccess }: HrMasterExcelImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parsedResult, setParsedResult] = useState<ParsedHrMasterExcelResult | null>(null);
    const [viewTab, setViewTab] = useState<'valid' | 'invalid'>('valid');
    const [overwrite, setOverwrite] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const config = HR_MASTER_EXCEL_CONFIGS[masterTab] || HR_MASTER_EXCEL_CONFIGS['employee'];

    const handleFileChange = async (selectedFile: File) => {
        if (!selectedFile) return;
        setFile(selectedFile);
        setParsing(true);
        try {
            const result = await parseHrMasterExcelFile(selectedFile, masterTab);
            setParsedResult(result);
            if (result.validRows.length === 0 && result.invalidRows.length > 0) {
                setViewTab('invalid');
            } else {
                setViewTab('valid');
            }
        } catch (error) {
            console.error("Failed to parse Excel file:", error);
            alert("Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.");
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
            const res = await fetch(`${API_BASE_URL}/api/hr/masters/bulk-import`, {
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
                const resultData = data.data || {};
                const inserted = resultData.insertedCount || 0;
                const updated = resultData.updatedCount || 0;
                const skipped = resultData.skippedCount || 0;
                const skippedItems = resultData.skippedItems || [];

                if (inserted === 0 && updated === 0 && skipped > 0) {
                    const sampleList = skippedItems.slice(0, 5).join('\n• ');
                    const more = skippedItems.length > 5 ? `\n...and ${skippedItems.length - 5} more` : '';
                    alert(`⚠️ No new items imported.\n\nAll ${skipped} item(s) already exist in the database:\n• ${sampleList}${more}\n\n💡 Tip: Enable the "Update existing items if ID / Name matches" checkbox before importing if you wish to overwrite existing records.`);
                } else {
                    let msg = `Successfully processed import!\n• Inserted: ${inserted}\n• Updated: ${updated}`;
                    if (skipped > 0) {
                        const sampleList = skippedItems.slice(0, 3).join(', ');
                        const more = skippedItems.length > 3 ? ` and ${skippedItems.length - 3} more` : '';
                        msg += `\n• Skipped (${skipped} already exist): ${sampleList}${more}`;
                    }
                    alert(msg);
                    onSuccess();
                    onClose();
                }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-900 to-purple-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-800/80 rounded-xl flex items-center justify-center border border-indigo-600">
                            <FileSpreadsheet size={20} className="text-indigo-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold tracking-tight text-indigo-100">Import HR Master via Excel</h2>
                            <p className="text-xs text-indigo-300/80 mt-0.5">{config.title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => downloadHrMasterExcelTemplate(masterTab)}
                            className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 border border-indigo-500/50"
                            title="Download standard Excel template format"
                        >
                            <Download size={14} /> Download Template
                        </button>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-indigo-950 hover:bg-indigo-900 flex items-center justify-center text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {!parsedResult ? (
                        /* Step 1: Upload Dropzone */
                        <div className="space-y-4">
                            <div className="bg-indigo-50/60 dark:bg-slate-800/60 p-4 rounded-2xl border border-indigo-200/80 dark:border-slate-700 text-xs flex justify-between items-center">
                                <div>
                                    <span className="font-extrabold text-indigo-800 dark:text-indigo-300 uppercase text-[10px] block">STANDARD EXCEL FORMAT</span>
                                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">Need the correct column structure? Download the pre-formatted Excel template for <b>{masterTab}</b>.</p>
                                </div>
                                <button 
                                    onClick={() => downloadHrMasterExcelTemplate(masterTab)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <Download size={14} /> Download Standard Excel
                                </button>
                            </div>

                            <div 
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                className="border-2 border-dashed border-indigo-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 rounded-3xl p-10 text-center flex flex-col items-center justify-center transition-all cursor-pointer group"
                            >
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                                    className="hidden" 
                                    id="hr-master-excel-upload-input" 
                                />
                                <label htmlFor="hr-master-excel-upload-input" className="cursor-pointer flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Upload size={28} />
                                    </div>
                                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Drag & drop your Excel file here</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supports .xlsx and .xls spreadsheet files</p>
                                    <span className="mt-4 px-4 py-2 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 rounded-xl font-bold text-xs shadow-sm">
                                        Browse Computer File
                                    </span>
                                </label>
                            </div>

                            {parsing && (
                                <div className="text-center py-4 flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs">
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
                                    <FileSpreadsheet className="text-indigo-600 dark:text-indigo-400" size={24} />
                                    <div>
                                        <strong className="text-sm font-extrabold text-slate-900 dark:text-white">{file?.name}</strong>
                                        <div className="text-slate-500 text-[11px] mt-0.5">Total Rows Found: <b>{parsedResult.totalRows}</b></div>
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
                                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <CheckCircle size={14} className="text-indigo-600" />
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
                                        Invalid / Errors ({parsedResult.invalidRows.length})
                                    </button>
                                </div>

                                {/* Overwrite Option */}
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={overwrite}
                                        onChange={(e) => setOverwrite(e.target.checked)}
                                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                    />
                                    <span>Update existing items if ID / Name matches</span>
                                </label>
                            </div>

                            {/* Table Display */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner max-h-[350px] overflow-y-auto">
                                {viewTab === 'valid' ? (
                                    parsedResult.validRows.length > 0 ? (
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 font-bold border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="p-3 w-12 text-center">#</th>
                                                    {config.columns.map(col => (
                                                        <th key={col.key} className="p-3 whitespace-nowrap">{col.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                                                {parsedResult.validRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                        {config.columns.map(col => (
                                                            <td key={col.key} className="p-3 whitespace-nowrap">
                                                                {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs">No valid rows found in uploaded file.</div>
                                    )
                                ) : (
                                    parsedResult.invalidRows.length > 0 ? (
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 sticky top-0 font-bold border-b border-rose-200 dark:border-rose-900">
                                                <tr>
                                                    <th className="p-3 w-16 text-center">Row</th>
                                                    <th className="p-3">Identified Errors</th>
                                                    {config.columns.slice(0, 3).map(col => (
                                                        <th key={col.key} className="p-3 whitespace-nowrap">{col.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-rose-100 dark:divide-rose-900/30 text-slate-600 dark:text-slate-300">
                                                {parsedResult.invalidRows.map((inv, idx) => (
                                                    <tr key={idx} className="bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60 transition-colors">
                                                        <td className="p-3 text-center font-bold text-rose-700 dark:text-rose-400 font-mono">{inv.rowNumber}</td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col gap-1">
                                                                {inv.errors.map((err, eIdx) => (
                                                                    <span key={eIdx} className="text-rose-600 dark:text-rose-400 font-medium text-[11px] flex items-center gap-1">
                                                                        • {err}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        {config.columns.slice(0, 3).map(col => (
                                                            <td key={col.key} className="p-3 whitespace-nowrap text-slate-500">
                                                                {inv.data[col.key] || '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs">No rejected rows! All rows passed validation.</div>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
                    >
                        Cancel
                    </button>

                    {parsedResult && parsedResult.validRows.length > 0 && (
                        <button
                            onClick={handleUploadSubmit}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw className="animate-spin" size={14} />
                                    Importing {parsedResult.validRows.length} Items...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={16} />
                                    Confirm & Import ({parsedResult.validRows.length} Valid Rows)
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
