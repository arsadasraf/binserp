"use client";

import React, { useState } from "react";
import { 
    FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
    RefreshCw, Filter, Calendar, Users, Target, ArrowRight, X, FileText 
} from "lucide-react";

export default function CRMDataHub() {
    const [importType, setImportType] = useState<"leads" | "customers">("leads");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [importResult, setImportResult] = useState<any | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    // Export Builder State
    const [exportType, setExportType] = useState<"leads" | "customers">("leads");
    const [exportStatus, setExportStatus] = useState<string>("All");
    const [exportSource, setExportSource] = useState<string>("All");
    const [exportWarmth, setExportWarmth] = useState<string>("All");
    const [exportFromDate, setExportFromDate] = useState<string>("");
    const [exportToDate, setExportToDate] = useState<string>("");
    const [exporting, setExporting] = useState(false);

    const handleDownloadTemplate = (type: "leads" | "customers") => {
        const token = localStorage.getItem("token");
        const url = `/api/crm/excel/template/${type}`;
        
        // Trigger download with auth token
        fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.blob())
            .then(blob => {
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = `CRM_${type === "leads" ? "Leads" : "Customers"}_Import_Template.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch(err => console.error("Template download failed", err));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
            setImportError("Please upload an Excel (.xlsx/.xls) or CSV spreadsheet file");
            return;
        }

        setSelectedFile(file);
        setImportError(null);
        setImportResult(null);
    };

    const handleImportSubmit = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setImportError(null);
        setImportResult(null);

        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await fetch(`/api/crm/excel/import/${importType}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "Failed to import spreadsheet data");
            }

            setImportResult(data.data);
            setSelectedFile(null);
        } catch (err: any) {
            setImportError(err.message || "Failed to import file");
        } finally {
            setUploading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const token = localStorage.getItem("token");
            let url = `/api/crm/excel/export/${exportType}?`;

            if (exportType === "leads") {
                if (exportStatus !== "All") url += `status=${encodeURIComponent(exportStatus)}&`;
                if (exportSource !== "All") url += `source=${encodeURIComponent(exportSource)}&`;
                if (exportWarmth !== "All") url += `warmth=${encodeURIComponent(exportWarmth)}&`;
            }
            if (exportFromDate) url += `fromDate=${encodeURIComponent(exportFromDate)}&`;
            if (exportToDate) url += `toDate=${encodeURIComponent(exportToDate)}&`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `CRM_${exportType === "leads" ? "Leads" : "Customers"}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error("Export error", err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Top Cards: Data Hub Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. BULK IMPORT ENGINE */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
                                    <Upload size={20} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Bulk Spreadsheet Importer</h3>
                                    <p className="text-xs text-slate-400">Import hundreds of Leads or Customers in seconds</p>
                                </div>
                            </div>
                            
                            {/* Import Type Toggle */}
                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                <button
                                    onClick={() => { setImportType("leads"); setSelectedFile(null); setImportResult(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        importType === "leads" 
                                            ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" 
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Leads
                                </button>
                                <button
                                    onClick={() => { setImportType("customers"); setSelectedFile(null); setImportResult(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        importType === "customers" 
                                            ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" 
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Customers
                                </button>
                            </div>
                        </div>

                        {/* Step 1: Download Template */}
                        <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div className="text-xs">
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">Step 1: Download Standard Excel Template</span>
                                <span className="text-slate-400">Contains pre-formatted columns, sample data & field guidelines.</span>
                            </div>
                            <button
                                onClick={() => handleDownloadTemplate(importType)}
                                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 shrink-0"
                            >
                                <Download size={14} className="text-blue-600" /> Template (.xlsx)
                            </button>
                        </div>

                        {/* Step 2: Upload Area */}
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Step 2: Upload Filled Spreadsheet
                            </label>
                            
                            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-900/30">
                                <FileSpreadsheet size={32} className="text-blue-600 dark:text-blue-400 mb-2" />
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {selectedFile ? selectedFile.name : "Click to browse or drag & drop Excel file"}
                                </span>
                                <span className="text-[11px] text-slate-400 mt-1">
                                    Supports .xlsx, .xls, .csv up to 20MB
                                </span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Import Error Banner */}
                        {importError && (
                            <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                                <AlertTriangle size={15} className="shrink-0" />
                                <span>{importError}</span>
                            </div>
                        )}

                        {/* Import Result Summary */}
                        {importResult && (
                            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs space-y-2">
                                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                                    <CheckCircle2 size={16} /> Import Completed Successfully
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border">
                                        <span className="text-[10px] text-slate-400 block font-sans">Total Rows</span>
                                        <strong className="text-sm text-slate-800 dark:text-slate-200">{importResult.totalRows}</strong>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-200">
                                        <span className="text-[10px] text-emerald-600 block font-sans">Inserted</span>
                                        <strong className="text-sm text-emerald-600">{importResult.inserted}</strong>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-amber-200">
                                        <span className="text-[10px] text-amber-600 block font-sans">Duplicates Skipped</span>
                                        <strong className="text-sm text-amber-600">{importResult.skipped}</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                        <button
                            onClick={handleImportSubmit}
                            disabled={!selectedFile || uploading}
                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
                        >
                            {uploading ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
                            {uploading ? "Processing Excel File..." : `Import ${importType === "leads" ? "Leads" : "Customers"} Now`}
                        </button>
                    </div>
                </div>

                {/* 2. CUSTOM DATA EXPORTER */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                    <Download size={20} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Custom Excel Data Exporter</h3>
                                    <p className="text-xs text-slate-400">Download filtered CRM datasets into clean .xlsx spreadsheets</p>
                                </div>
                            </div>

                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                <button
                                    onClick={() => setExportType("leads")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        exportType === "leads" 
                                            ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-xs" 
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Leads
                                </button>
                                <button
                                    onClick={() => setExportType("customers")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        exportType === "customers" 
                                            ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-xs" 
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Customers
                                </button>
                            </div>
                        </div>

                        {/* Export Filters Grid */}
                        <div className="mt-5 space-y-4 text-xs">
                            
                            {exportType === "leads" && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Stage Status
                                        </label>
                                        <select
                                            value={exportStatus}
                                            onChange={(e) => setExportStatus(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                        >
                                            <option value="All">All Stages</option>
                                            <option value="New">New</option>
                                            <option value="Contacted">Contacted</option>
                                            <option value="Qualified">Qualified</option>
                                            <option value="Proposal Sent">Proposal Sent</option>
                                            <option value="Negotiation">Negotiation</option>
                                            <option value="Won">Won</option>
                                            <option value="Lost">Lost</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Lead Source
                                        </label>
                                        <select
                                            value={exportSource}
                                            onChange={(e) => setExportSource(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                        >
                                            <option value="All">All Sources</option>
                                            <option value="IndiaMART">IndiaMART</option>
                                            <option value="TradeIndia">TradeIndia</option>
                                            <option value="Website Inquiry">Website</option>
                                            <option value="Direct Referral">Referral</option>
                                            <option value="Cold Call / Outreach">Cold Call</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Warmth Rating
                                        </label>
                                        <select
                                            value={exportWarmth}
                                            onChange={(e) => setExportWarmth(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                        >
                                            <option value="All">All Ratings</option>
                                            <option value="Hot">🔥 Hot</option>
                                            <option value="Warm">☀️ Warm</option>
                                            <option value="Cold">❄️ Cold</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Date Range Selection */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                        <Calendar size={13} /> Created From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={exportFromDate}
                                        onChange={(e) => setExportFromDate(e.target.value)}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                        <Calendar size={13} /> Created To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={exportToDate}
                                        onChange={(e) => setExportToDate(e.target.value)}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-1">
                                <span className="font-extrabold text-emerald-900 dark:text-emerald-300 block">Export Includes:</span>
                                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                                    Complete contact coordinates, company name, requirements, lead warmth score, deal value, assigned sales rep, and creation timestamps formatted for reporting and offline analysis.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                        >
                            {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                            {exporting ? "Generating Spreadsheet..." : `Download ${exportType === "leads" ? "Leads" : "Customers"} Excel`}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
