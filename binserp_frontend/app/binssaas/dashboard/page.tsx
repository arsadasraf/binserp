"use client";

import React, { useState, useEffect } from "react";
import { saasAdminAuth } from "@/lib/saasAdminAuth";

interface DashboardStats {
    totalCompanies: number;
    verifiedCompanies: number;
    unverifiedCompanies: number;
    totalUsers: number;
    recentCompanies: number;
    companiesByMonth: Array<{ _id: { year: number; month: number }; count: number }>;
    recentRegistrations: Array<any>;
}

interface Company {
    _id: string;
    companyName: string;
    email: string;
    contactNumber: string;
    city: string;
    isVerified: boolean;
    createdAt: string;
    userCount: number;
}

interface User {
    _id: string;
    name: string;
    email: string;
    userId: string;
    department: string;
    company: { _id: string; companyName: string };
    createdAt: string;
}

interface Credentials {
    companyName: string;
    companyId: string;
    userId: string;
    password: string;
    contactNumber: string;
    email?: string;
}

/* ─────────────────────────── Credential Modal ─────────────────────────── */
function CredentialModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const phoneDigits = creds.contactNumber.replace(/\D/g, "");
    const waMsg = encodeURIComponent(
        `🏭 *BinsErp Login Credentials*\n\n` +
        `Company: *${creds.companyName}*\n` +
        `Company ID: *${creds.companyId}*\n` +
        `User ID: *${creds.userId}*\n` +
        `Password: *${creds.password}*\n\n` +
        `🌐 Login at your BinsErp URL\n\n` +
        `_Please save these credentials securely._`
    );
    const waLink = `https://wa.me/91${phoneDigits}?text=${waMsg}`;

    const rows = [
        { label: "Company Name", value: creds.companyName, key: "n" },
        { label: "Company ID", value: creds.companyId, key: "c" },
        { label: "User ID", value: creds.userId, key: "u" },
        { label: "Password", value: creds.password, key: "p" },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                {/* Green header */}
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-t-2xl px-6 py-5 text-white">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">✅</span>
                                <h2 className="text-xl font-bold">Company Created Successfully!</h2>
                            </div>
                            <p className="text-emerald-100 text-sm">
                                ⚠️ These credentials are shown <strong>only once</strong>. Copy and send them now.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-bold transition-colors"
                        >✕</button>
                    </div>
                </div>

                {/* Credential rows */}
                <div className="p-6 space-y-3">
                    {rows.map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{row.label}</p>
                                <p className="font-mono font-bold text-slate-900 text-base break-all">{row.value}</p>
                            </div>
                            <button
                                onClick={() => copy(row.value, row.key)}
                                className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${copied === row.key
                                        ? "bg-green-100 text-green-700 border-green-300"
                                        : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                    }`}
                            >
                                {copied === row.key ? "✓ Copied!" : "Copy"}
                            </button>
                        </div>
                    ))}

                    {/* WhatsApp CTA */}
                    <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 w-full py-4 bg-green-500 hover:bg-green-400 text-white rounded-xl font-bold text-base transition-all hover:shadow-lg hover:shadow-green-200 hover:scale-[1.01] mt-2"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Send Credentials via WhatsApp to {creds.contactNumber}
                    </a>

                    <button
                        onClick={onClose}
                        className="w-full py-3 border border-slate-200 text-slate-500 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        Close — I&apos;ve saved the credentials
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────── Create Company Form ─────────────────────── */
const COMPANY_TYPES = [
    "Job Work / Contract Manufacturing",
    "OEM (Own Product Manufacturer)",
    "Supplier / Component Supplier",
];
const SERVICES = [
    "Sheet Metal Fabrication",
    "CNC Machining",
    "Foundry / Casting",
    "Forging",
    "Plastic Injection Molding",
    "Rubber Molding",
    "Electrical & Electronics Manufacturing",
    "Packaging Manufacturing",
    "Textile & Garment Manufacturing",
    "Surface Treatment & Coating",
];

const inputCls = "w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-sm text-slate-800 bg-white transition-all placeholder:text-slate-400";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

function CreateCompanyTab({ onCreated }: { onCreated: () => void }) {
    const emptyForm = { companyName: "", companyType: "", service: "", email: "", contactNumber: "", city: "", pincode: "", country: "India" };
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [credentials, setCredentials] = useState<Credentials | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const res = await saasAdminAuth.fetchWithAuth("/companies/create", {
                method: "POST",
                body: JSON.stringify(form),
            });
            setCredentials(res.data);
            setForm(emptyForm);
            onCreated();
        } catch (err: any) {
            setError(err.message || "Failed to create company. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {credentials && <CredentialModal creds={credentials} onClose={() => setCredentials(null)} />}

            <div className="max-w-2xl mx-auto">
                {/* Info banner */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-5 mb-5 text-white shadow-lg shadow-purple-200">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
                        <span className="text-xl">🏢</span> Register New Company
                    </h2>
                    <p className="text-purple-100 text-sm leading-relaxed">
                        Fill in the company details below. <strong>Company ID, User ID and Password</strong> will be auto-generated and shown once — you can send them directly via WhatsApp.
                    </p>
                </div>

                {/* Form card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {error && (
                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-xl text-sm">
                                <span className="text-base mt-0.5">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Company Name — full width */}
                        <div>
                            <label className={labelCls}>Company Name <span className="text-red-500">*</span></label>
                            <input name="companyName" value={form.companyName} onChange={handleChange} required
                                placeholder="e.g. Acme Industries Pvt Ltd" className={inputCls} />
                        </div>

                        {/* Row 2: Type + Service */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className={labelCls}>Company Type <span className="text-red-500">*</span></label>
                                <select name="companyType" value={form.companyType} onChange={handleChange} required className={inputCls}>
                                    <option value="">Select type...</option>
                                    {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Service / Industry <span className="text-red-500">*</span></label>
                                <select name="service" value={form.service} onChange={handleChange} required className={inputCls}>
                                    <option value="">Select service...</option>
                                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Row 3: Email + Contact */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className={labelCls}>Company Email <span className="text-red-500">*</span></label>
                                <input name="email" type="email" value={form.email} onChange={handleChange} required
                                    placeholder="company@example.com" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>
                                    Contact Number <span className="text-red-500">*</span>
                                    <span className="ml-1 text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">📱 WhatsApp</span>
                                </label>
                                <input name="contactNumber" value={form.contactNumber} onChange={handleChange} required
                                    placeholder="10-digit mobile number" maxLength={15} className={inputCls} />
                            </div>
                        </div>

                        {/* Row 4: City + Pincode */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className={labelCls}>City <span className="text-red-500">*</span></label>
                                <input name="city" value={form.city} onChange={handleChange} required
                                    placeholder="e.g. Bengaluru" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Pincode</label>
                                <input name="pincode" value={form.pincode} onChange={handleChange}
                                    placeholder="6-digit pincode" className={inputCls} />
                            </div>
                        </div>

                        {/* Country */}
                        <div>
                            <label className={labelCls}>Country</label>
                            <input name="country" value={form.country} onChange={handleChange}
                                placeholder="India" className={inputCls} />
                        </div>

                        {/* Auto-gen notice */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 flex gap-3">
                            <span className="text-lg mt-0.5 flex-shrink-0">⚙️</span>
                            <div className="text-sm text-amber-800">
                                <p className="font-semibold mb-0.5">Auto-generated Credentials</p>
                                <p className="leading-relaxed">After submission, you will see the <strong>Company ID, User ID and Password</strong> in a popup — with a direct button to send them via WhatsApp.</p>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-purple-200 disabled:opacity-60 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Creating Company...
                                </>
                            ) : (
                                <> 🚀 Create Company &amp; Generate Credentials </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}

/* ─────────────────────────── Stat Card ─────────────────────────────────── */
function StatCard({ color, title, value, icon }: { color: string; title: string; value: number; icon: React.ReactNode }) {
    return (
        <div className={`${color} rounded-2xl p-6 text-white shadow-lg`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-white/80 text-sm font-medium">{title}</p>
                    <p className="text-4xl font-extrabold mt-1">{value}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
            </div>
        </div>
    );
}

/* ─────────────────────────── Main Dashboard ─────────────────────────────── */
type TabId = "overview" | "companies" | "users" | "create";

export default function SaasDashboard() {
    const [activeTab, setActiveTab] = useState<TabId>("overview");
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [resetCredentials, setResetCredentials] = useState<Credentials | null>(null);

    useEffect(() => { loadDashboardStats(); }, []);
    useEffect(() => {
        if (activeTab === "companies") loadCompanies();
        if (activeTab === "users") loadUsers();
    }, [activeTab]);

    const loadDashboardStats = async () => {
        setLoading(true);
        try { const r = await saasAdminAuth.fetchWithAuth("/dashboard-stats"); setStats(r.data); }
        catch { /* will show empty state */ }
        finally { setLoading(false); }
    };

    const loadCompanies = async () => {
        setLoading(true);
        try { const r = await saasAdminAuth.fetchWithAuth("/companies"); setCompanies(r.data); }
        catch { setCompanies([]); }
        finally { setLoading(false); }
    };

    const loadUsers = async () => {
        setLoading(true);
        try { const r = await saasAdminAuth.fetchWithAuth("/users"); setUsers(r.data); }
        catch { setUsers([]); }
        finally { setLoading(false); }
    };

    const handleToggleStatus = async (id: string, cur: boolean) => {
        try {
            await saasAdminAuth.fetchWithAuth(`/companies/${id}/status`, { method: "PUT", body: JSON.stringify({ isVerified: !cur }) });
            loadCompanies();
        } catch (e: any) { alert(e.message); }
    };

    const handleResetPassword = async (id: string) => {
        if (!confirm("Reset this company's password? A new password will be generated.")) return;
        try {
            const r = await saasAdminAuth.fetchWithAuth(`/companies/${id}/reset-password`, { method: "PUT" });
            setResetCredentials(r.data);
        } catch (e: any) { alert(e.message); }
    };

    const handleDeleteCompany = async (id: string) => {
        if (!confirm("Delete this company permanently? This cannot be undone.")) return;
        try { await saasAdminAuth.fetchWithAuth(`/companies/${id}`, { method: "DELETE" }); loadCompanies(); loadDashboardStats(); }
        catch (e: any) { alert(e.message); }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm("Delete this user?")) return;
        try { await saasAdminAuth.fetchWithAuth(`/users/${id}`, { method: "DELETE" }); loadUsers(); }
        catch (e: any) { alert(e.message); }
    };

    const filteredCompanies = companies.filter(c =>
        !searchTerm ||
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredUsers = users.filter(u =>
        !searchTerm ||
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.company?.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tabs: { id: TabId; label: string; short: string }[] = [
        { id: "overview", label: "📊 Overview", short: "Overview" },
        { id: "companies", label: "🏢 Companies", short: "Companies" },
        { id: "users", label: "👥 Users", short: "Users" },
        { id: "create", label: "➕ Create Company", short: "Create" },
    ];

    return (
        <div className="space-y-6 pb-10">
            {/* Reset pwd modal */}
            {resetCredentials && <CredentialModal creds={resetCredentials} onClose={() => setResetCredentials(null)} />}

            {/* ─── Tab Bar ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5">
                <div className="grid grid-cols-4 gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            onClick={() => { setActiveTab(tab.id); setSearchTerm(""); }}
                            className={`px-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === tab.id
                                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                }`}
                        >
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.short}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Overview ─── */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {loading && !stats ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : stats ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <StatCard color="bg-gradient-to-br from-blue-500 to-blue-600" title="Total Companies" value={stats.totalCompanies}
                                    icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                                />
                                <StatCard color="bg-gradient-to-br from-green-500 to-emerald-600" title="Active Companies" value={stats.verifiedCompanies}
                                    icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                />
                                <StatCard color="bg-gradient-to-br from-violet-500 to-purple-700" title="Total Users" value={stats.totalUsers}
                                    icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                />
                                <StatCard color="bg-gradient-to-br from-pink-500 to-rose-600" title="New (30 days)" value={stats.recentCompanies}
                                    icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                />
                            </div>

                            {/* Recent Registrations */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                    <h2 className="font-bold text-slate-800 text-base">Recent Registrations</h2>
                                    <button
                                        onClick={() => setActiveTab("create")}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
                                    >
                                        ➕ New Company
                                    </button>
                                </div>
                                {stats.recentRegistrations.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <p className="text-5xl mb-3">🏭</p>
                                        <p className="text-slate-600 font-medium">No companies yet</p>
                                        <p className="text-slate-400 text-sm mt-1">Create your first company using the tab above</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {stats.recentRegistrations.map((c) => (
                                            <div key={c._id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{c.companyName}</p>
                                                    <p className="text-sm text-slate-400">{c.email}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-slate-600 font-medium">{c.city}</p>
                                                    <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString("en-IN")}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Fallback when backend not connected */
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
                            <p className="text-5xl mb-3">📡</p>
                            <p className="text-slate-700 font-semibold text-lg">Could not connect to backend</p>
                            <p className="text-slate-400 text-sm mt-1 mb-5">Make sure the backend server is running</p>
                            <button
                                onClick={loadDashboardStats}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Companies ─── */}
            {activeTab === "companies" && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Search by name, email, or city..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-white"
                        />
                        <button
                            onClick={() => setActiveTab("create")}
                            className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                            ➕ New
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {["Company", "Contact", "Location", "Status", "Registered", "Actions"].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCompanies.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-16 text-center">
                                                <p className="text-4xl mb-2">🏭</p>
                                                <p className="text-slate-500 font-medium">{loading ? "Loading..." : searchTerm ? "No results found" : "No companies yet"}</p>
                                                {!loading && !searchTerm && (
                                                    <button onClick={() => setActiveTab("create")} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                                                        Create First Company
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : filteredCompanies.map(c => (
                                        <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-900 text-sm">{c.companyName}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{c.email}</p>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-600">{c.contactNumber}</td>
                                            <td className="px-5 py-4 text-sm text-slate-600">{c.city}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.isVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${c.isVerified ? "bg-green-500" : "bg-amber-500"}`} />
                                                    {c.isVerified ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => handleToggleStatus(c._id, c.isVerified)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                                                        {c.isVerified ? "Disable" : "Enable"}
                                                    </button>
                                                    <button onClick={() => handleResetPassword(c._id)}
                                                        className="text-amber-600 hover:text-amber-800 text-xs font-semibold hover:underline flex items-center gap-1">
                                                        🔑 Reset Pwd
                                                    </button>
                                                    <button onClick={() => handleDeleteCompany(c._id)}
                                                        className="text-red-500 hover:text-red-700 text-xs font-semibold hover:underline">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Users ─── */}
            {activeTab === "users" && (
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Search users by name, email, or company..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-white"
                    />
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {["User", "Company", "Department", "Registered", "Actions"].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="py-16 text-center text-slate-400 text-sm">{loading ? "Loading..." : "No users found"}</td></tr>
                                    ) : filteredUsers.map(u => (
                                        <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-600">{u.company?.companyName || "—"}</td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{u.department}</span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                                            <td className="px-5 py-4">
                                                <button onClick={() => handleDeleteUser(u._id)} className="text-red-500 hover:text-red-700 text-xs font-semibold hover:underline">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Create Company ─── */}
            {activeTab === "create" && (
                <CreateCompanyTab onCreated={() => { loadDashboardStats(); setActiveTab("companies"); }} />
            )}

            {/* Loading overlay */}
            {loading && (
                <div className="fixed bottom-6 right-6 z-40">
                    <div className="bg-white rounded-xl px-4 py-3 shadow-xl border border-slate-200 flex items-center gap-3">
                        <svg className="animate-spin h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-slate-600 text-sm font-medium">Loading...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
