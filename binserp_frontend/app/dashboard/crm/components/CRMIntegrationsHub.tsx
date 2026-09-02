"use client";

import React, { useState, useEffect } from "react";
import { 
    Zap, RefreshCw, CheckCircle2, AlertTriangle, Key, Phone, 
    Copy, Check, Globe, ShieldCheck, History, ArrowRight, X, ExternalLink, Play 
} from "lucide-react";
import { apiGet, apiPost } from "@/src/lib/api";

export default function CRMIntegrationsHub() {
    const [integration, setIntegration] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncingIndiaMart, setSyncingIndiaMart] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);
    const [copiedCurl, setCopiedCurl] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form states
    const [indiaMartForm, setIndiaMartForm] = useState({
        glusrMobile: "",
        glusrAuthKey: "",
        autoSync: false,
        defaultSource: "IndiaMART"
    });

    const [tradeIndiaForm, setTradeIndiaForm] = useState({
        userId: "",
        profileId: "",
        authKey: "",
        autoSync: false
    });

    const [webhookForm, setWebhookForm] = useState({
        isActive: true,
        defaultSource: "Website Webhook"
    });

    const fetchIntegrationData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const [intRes, logsRes] = await Promise.all([
                apiGet("/api/crm/integrations", token),
                apiGet("/api/crm/integrations/logs", token)
            ]);

            const data = intRes.data || {};
            setIntegration(data);
            setLogs(logsRes.data || data.syncLogs || []);

            if (data.indiaMart) {
                setIndiaMartForm({
                    glusrMobile: data.indiaMart.glusrMobile || "",
                    glusrAuthKey: data.indiaMart.glusrAuthKey || "",
                    autoSync: Boolean(data.indiaMart.autoSync),
                    defaultSource: data.indiaMart.defaultSource || "IndiaMART"
                });
            }

            if (data.tradeIndia) {
                setTradeIndiaForm({
                    userId: data.tradeIndia.userId || "",
                    profileId: data.tradeIndia.profileId || "",
                    authKey: data.tradeIndia.authKey || "",
                    autoSync: Boolean(data.tradeIndia.autoSync)
                });
            }

            if (data.webhook) {
                setWebhookForm({
                    isActive: data.webhook.isActive !== false,
                    defaultSource: data.webhook.defaultSource || "Website Webhook"
                });
            }
        } catch (err: any) {
            setMsg({ type: "error", text: err.message || "Failed to load integration settings" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrationData();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const token = localStorage.getItem("token");
            await apiPost("/api/crm/integrations/save", {
                indiaMart: indiaMartForm,
                tradeIndia: tradeIndiaForm,
                webhook: webhookForm
            }, token);

            setMsg({ type: "success", text: "Integration settings saved successfully!" });
            fetchIntegrationData();
        } catch (err: any) {
            setMsg({ type: "error", text: err.message || "Failed to save settings" });
        } finally {
            setSaving(false);
        }
    };

    const handleSyncIndiaMart = async () => {
        setSyncingIndiaMart(true);
        setMsg(null);
        try {
            const token = localStorage.getItem("token");
            const res = await apiPost("/api/crm/integrations/sync-indiamart", {}, token);
            setMsg({ type: "success", text: res.message || "IndiaMART inquiries synced successfully!" });
            fetchIntegrationData();
        } catch (err: any) {
            setMsg({ type: "error", text: err.message || "Failed to sync with IndiaMART" });
        } finally {
            setSyncingIndiaMart(false);
        }
    };

    const webhookToken = integration?.webhook?.webhookToken || "your_webhook_token";
    const webhookEndpointUrl = typeof window !== "undefined" 
        ? `${window.location.origin}/api/crm/webhook/${webhookToken}`
        : `https://your-domain.com/api/crm/webhook/${webhookToken}`;

    const curlExample = `curl -X POST "${webhookEndpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Rajesh Kumar",
    "company": "Apex Precision Tools",
    "phone": "+919876543210",
    "email": "rajesh@apexprecision.com",
    "requirements": "Need quote for 2000 units of custom fasteners",
    "source": "Landing Page Ad"
  }'`;

    const handleCopy = (text: string, type: "token" | "curl") => {
        navigator.clipboard.writeText(text);
        if (type === "token") {
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        } else {
            setCopiedCurl(true);
            setTimeout(() => setCopiedCurl(false), 2000);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Alert Message */}
            {msg && (
                <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
                    msg.type === "success" 
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
                }`}>
                    <span>{msg.text}</span>
                    <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* 3 Integration Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. INDIAMART CONNECTOR */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 flex items-center justify-center font-extrabold text-sm border border-sky-200 dark:border-sky-800 shadow-xs">
                                    IM
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">IndiaMART Lead Pull API</h3>
                                    <span className="text-[10px] text-slate-400 block">Direct CRM v2 Ingestion</span>
                                </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                indiaMartForm.glusrAuthKey ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                            }`}>
                                {indiaMartForm.glusrAuthKey ? "Configured" : "Not Set"}
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-500">
                            Automatically ingests buy leads, RFQs, and buyer contact details directly from your IndiaMART seller account.
                        </p>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <Phone size={12} className="text-sky-600" /> Registered Mobile Number (GLUSR_MOBILE)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 9876543210"
                                    value={indiaMartForm.glusrMobile}
                                    onChange={(e) => setIndiaMartForm({ ...indiaMartForm, glusrMobile: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <Key size={12} className="text-sky-600" /> IndiaMART CRM Auth Key (GLUSR_MOBILE_KEY)
                                </label>
                                <input
                                    type="password"
                                    placeholder="Enter your CRM Key..."
                                    value={indiaMartForm.glusrAuthKey}
                                    onChange={(e) => setIndiaMartForm({ ...indiaMartForm, glusrAuthKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                />
                            </div>

                            {integration?.indiaMart?.lastSyncAt && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                    Last Synced: {new Date(integration.indiaMart.lastSyncAt).toLocaleString("en-GB")}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                        <button
                            onClick={handleSyncIndiaMart}
                            disabled={syncingIndiaMart || !indiaMartForm.glusrAuthKey}
                            className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-sky-600/20 flex items-center justify-center gap-1.5"
                        >
                            {syncingIndiaMart ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                            {syncingIndiaMart ? "Syncing Inquiries..." : "Test & Sync Now"}
                        </button>
                    </div>
                </div>

                {/* 2. TRADEINDIA CONNECTOR */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center font-extrabold text-sm border border-amber-200 dark:border-amber-800 shadow-xs">
                                    TI
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">TradeIndia Inquiries</h3>
                                    <span className="text-[10px] text-slate-400 block">B2B Trade Portal Ingestion</span>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500">
                                Optional
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-500">
                            Configure TradeIndia Seller Profile ID and Key to capture buyer requests directly into the Lead Pipeline.
                        </p>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    TradeIndia User / Profile ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1084223"
                                    value={tradeIndiaForm.profileId}
                                    onChange={(e) => setTradeIndiaForm({ ...tradeIndiaForm, profileId: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    API Security Key
                                </label>
                                <input
                                    type="password"
                                    placeholder="Enter TradeIndia Key..."
                                    value={tradeIndiaForm.authKey}
                                    onChange={(e) => setTradeIndiaForm({ ...tradeIndiaForm, authKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={handleSaveSettings}
                            disabled={saving}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all"
                        >
                            Save TradeIndia Settings
                        </button>
                    </div>
                </div>

                {/* 3. INBOUND WEBHOOK CONNECTOR */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center font-extrabold text-sm border border-emerald-200 dark:border-emerald-800 shadow-xs">
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Inbound Webhook API</h3>
                                    <span className="text-[10px] text-slate-400 block">Instant Lead Capture Endpoint</span>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-500">
                            Connect your website contact forms, Google Lead Ads, or Zapier to push inquiries in real-time.
                        </p>

                        <div className="space-y-2 text-xs">
                            <label className="block font-bold text-slate-700 dark:text-slate-300">
                                Your Dedicated Webhook URL:
                            </label>
                            <div className="flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate flex-1 select-all">
                                    {webhookEndpointUrl}
                                </span>
                                <button
                                    onClick={() => handleCopy(webhookEndpointUrl, "token")}
                                    className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg shrink-0 transition-colors"
                                    title="Copy URL"
                                >
                                    {copiedToken ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={() => handleCopy(curlExample, "curl")}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                            {copiedCurl ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            {copiedCurl ? "Copied cURL Example!" : "Copy cURL Payload Example"}
                        </button>
                    </div>
                </div>

            </div>

            {/* Save All Settings Global Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <ShieldCheck size={16} className="text-blue-600" />
                    All API keys are securely hashed and stored in your isolated tenant repository.
                </div>
                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
                >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {saving ? "Saving Changes..." : "Save Integration Settings"}
                </button>
            </div>

            {/* Live Sync Audit Logs Ledger */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <History size={16} className="text-blue-600" />
                        Integration Synchronization Audit Logs
                    </h3>
                    <button
                        onClick={fetchIntegrationData}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                </div>

                <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-500 uppercase sticky top-0 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3.5">Timestamp</th>
                                <th className="p-3.5">Source Channel</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-center">Fetched</th>
                                <th className="p-3.5 text-center">Inserted</th>
                                <th className="p-3.5 text-center">Duplicates Skipped</th>
                                <th className="p-3.5">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        No synchronization events logged yet. Click <strong>Test & Sync Now</strong> to fetch inquiries.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                                        <td className="p-3.5 font-mono text-slate-500">
                                            {log.syncTime ? new Date(log.syncTime).toLocaleString("en-GB") : "-"}
                                        </td>
                                        <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                                            {log.source}
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                log.status === "Success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200" :
                                                "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                                            }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{log.recordsFetched || 0}</td>
                                        <td className="p-3.5 text-center font-mono font-bold text-emerald-600">{log.recordsInserted || 0}</td>
                                        <td className="p-3.5 text-center font-mono font-bold text-amber-600">{log.recordsSkipped || 0}</td>
                                        <td className="p-3.5 text-slate-500 max-w-sm truncate">{log.message || log.errorDetails || "-"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
