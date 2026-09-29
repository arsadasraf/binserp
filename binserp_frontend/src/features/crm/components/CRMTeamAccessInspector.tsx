"use client";

import React, { useState, useEffect } from "react";
import { 
    ShieldCheck, Users, RefreshCw, Mail, Phone, 
    CheckCircle2, ExternalLink, ShieldAlert, Award, User
} from "lucide-react";
import { apiGet } from "@/src/lib/api";

interface TeamMember {
    _id: string;
    type: "user" | "employee";
    name: string;
    email?: string;
    phone?: string;
    photo?: string;
    department?: string;
    designation?: string;
    roleName: string;
    tabs: string[];
    isFullAccess: boolean;
}

export default function CRMTeamAccessInspector() {
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTeam = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiGet("/api/crm/team-access", token);
            setTeam(res.data || []);
        } catch (err) {
            console.error("Failed to load CRM team access", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, []);

    const ALL_CRM_TABS = [
        { id: "overview", label: "Overview" },
        { id: "leads", label: "Lead Pipeline" },
        { id: "deals", label: "Deals & Revenue" },
        { id: "customers", label: "Customer 360" },
        { id: "masters", label: "CRM Masters" }
    ];

    const hasTab = (member: TeamMember, tabId: string) => {
        if (member.isFullAccess) return true;
        const normalized = member.tabs.map(t => String(t).toLowerCase());
        return normalized.includes(tabId) || normalized.includes("all");
    };

    return (
        <div className="space-y-4">
            {/* Header Banner */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck size={20} className="text-blue-600" />
                        CRM Team Access & Role Permissions
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        List of company staff, executives, and managers authorized to operate CRM & Sales
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={fetchTeam}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>

                    <a
                        href="/dashboard/admin/roles"
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                        <span>Manage Roles (RBAC)</span>
                        <ExternalLink size={13} />
                    </a>
                </div>
            </div>

            {/* Team Grid */}
            {loading ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Checking authorized CRM users...
                </div>
            ) : team.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-700 shadow-xs">
                    No users currently have CRM permissions. Assign CRM policies in Role Management.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {team.map((m) => (
                        <div key={m._id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
                                            {m.photo ? (
                                                <img src={m.photo} alt={m.name} className="w-full h-full object-cover rounded-2xl" />
                                            ) : (
                                                m.name.slice(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <strong className="text-sm font-extrabold text-slate-900 dark:text-white block">{m.name}</strong>
                                            <span className="text-[11px] text-slate-400 block font-medium">
                                                {m.designation || (m.type === "user" ? "Company User" : "Staff Member")}
                                            </span>
                                        </div>
                                    </div>

                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border ${
                                        m.isFullAccess
                                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300"
                                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
                                    }`}>
                                        {m.roleName}
                                    </span>
                                </div>

                                <div className="mt-4 space-y-1 text-xs text-slate-500">
                                    {m.email && (
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Mail size={13} className="shrink-0 text-slate-400" />
                                            <span className="truncate">{m.email}</span>
                                        </div>
                                    )}
                                    {m.phone && (
                                        <div className="flex items-center gap-1.5">
                                            <Phone size={13} className="shrink-0 text-slate-400" />
                                            <span>{m.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Accessible Tabs Breakdown */}
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Granted CRM Tabs
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {ALL_CRM_TABS.map((t) => {
                                        const allowed = hasTab(m, t.id);
                                        return (
                                            <span
                                                key={t.id}
                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                                    allowed
                                                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through opacity-50"
                                                }`}
                                            >
                                                {allowed && <CheckCircle2 size={10} />}
                                                {t.label}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
