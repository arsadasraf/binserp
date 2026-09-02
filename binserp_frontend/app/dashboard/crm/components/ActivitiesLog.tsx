"use client";

import React, { useState, useEffect } from "react";
import { 
    Plus, Search, Filter, RefreshCw, Phone, Video, Mail, MessageSquare, 
    Calendar, CheckCircle2, Clock, AlertTriangle, Trash2, Edit2, X, Check, Tag
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/src/lib/api";

interface Activity {
    _id: string;
    type: "Call" | "Meeting" | "Email" | "Note" | "Task" | "Site Visit" | "Demo" | "WhatsApp";
    summary: string;
    description?: string;
    relatedLead?: any;
    relatedCustomer?: any;
    relatedDeal?: any;
    date: string;
    dueDate?: string;
    duration?: number;
    isCompleted: boolean;
    outcome?: string;
    createdBy?: any;
}

export default function ActivitiesLog() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Completed">("All");

    // Schedule Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        type: "Call",
        summary: "",
        description: "",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        duration: 15,
        outcome: ""
    });

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            let url = "/api/crm/activities?";
            if (typeFilter !== "All") url += `type=${encodeURIComponent(typeFilter)}&`;
            if (statusFilter !== "All") url += `isCompleted=${statusFilter === "Completed"}&`;

            const res = await apiGet(url, token);
            setActivities(res.data || []);
        } catch (err) {
            console.error("Failed to load activities", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, [typeFilter, statusFilter]);

    const handleOpenSchedule = () => {
        setFormData({
            type: "Call",
            summary: "",
            description: "",
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
            duration: 15,
            outcome: ""
        });
        setIsModalOpen(true);
    };

    const handleCreateActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            await apiPost("/api/crm/activities", formData, token);
            setIsModalOpen(false);
            fetchActivities();
        } catch (err) {
            console.error("Failed to schedule activity", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleComplete = async (act: Activity) => {
        try {
            const token = localStorage.getItem("token");
            await apiPut(`/api/crm/activities/${act._id}`, {
                isCompleted: !act.isCompleted,
                outcome: !act.isCompleted ? (act.outcome || "Completed successfully") : ""
            }, token);
            fetchActivities();
        } catch (err) {
            console.error("Failed to toggle completion", err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this interaction log?")) return;
        try {
            const token = localStorage.getItem("token");
            await apiDelete(`/api/crm/activities/${id}`, token);
            fetchActivities();
        } catch (err) {
            console.error("Failed to delete activity", err);
        }
    };

    const now = new Date();
    const overdueCount = activities.filter(a => !a.isCompleted && a.dueDate && new Date(a.dueDate) < now).length;

    const getActivityIcon = (type: string) => {
        switch (type) {
            case "Call": return <Phone size={14} className="text-blue-500" />;
            case "Meeting": return <Video size={14} className="text-purple-500" />;
            case "Email": return <Mail size={14} className="text-amber-500" />;
            case "WhatsApp": return <MessageSquare size={14} className="text-emerald-500" />;
            default: return <Calendar size={14} className="text-indigo-500" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Overdue Warning Alert */}
            {overdueCount > 0 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-rose-600" />
                        <span>You have {overdueCount} overdue follow-up task(s) requiring immediate client contact!</span>
                    </div>
                    <button
                        onClick={() => setStatusFilter("Pending")}
                        className="underline hover:text-rose-950"
                    >
                        View Pending
                    </button>
                </div>
            )}

            {/* Top Filter Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="All">All Activity Types</option>
                        <option value="Call">Phone Calls</option>
                        <option value="Meeting">Client Meetings</option>
                        <option value="Site Visit">Site Visits</option>
                        <option value="Demo">Product Demos</option>
                        <option value="Email">Emails</option>
                        <option value="WhatsApp">WhatsApp Chats</option>
                        <option value="Task">General Tasks</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending Follow-ups</option>
                        <option value="Completed">Completed Interactions</option>
                    </select>

                    <button
                        onClick={fetchActivities}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <button
                    onClick={handleOpenSchedule}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                >
                    <Plus size={15} /> Schedule Activity
                </button>
            </div>

            {/* Activities Timeline List */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock size={16} className="text-blue-600" />
                        CRM Follow-up Scheduler & Interaction Ledger
                    </h3>
                    <span className="text-xs font-mono text-slate-400 font-bold">{activities.length} Recorded</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">
                            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                            Loading activities...
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            No follow-ups recorded matching the filters. Click <strong>Schedule Activity</strong> to add one.
                        </div>
                    ) : (
                        activities.map((act) => {
                            const isOverdue = !act.isCompleted && act.dueDate && new Date(act.dueDate) < now;
                            return (
                                <div key={act._id} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <button
                                            onClick={() => handleToggleComplete(act)}
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 transition-colors border ${
                                                act.isCompleted 
                                                    ? "bg-emerald-600 text-white border-emerald-600" 
                                                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-transparent hover:border-blue-500"
                                            }`}
                                            title={act.isCompleted ? "Mark Pending" : "Mark Completed"}
                                        >
                                            <Check size={13} className={act.isCompleted ? "opacity-100" : "opacity-0"} />
                                        </button>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-700">
                                                    {getActivityIcon(act.type)}
                                                </span>
                                                <strong className={`text-xs font-extrabold ${act.isCompleted ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                                                    {act.summary}
                                                </strong>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    {act.type}
                                                </span>
                                                {isOverdue && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                                        Overdue
                                                    </span>
                                                )}
                                            </div>

                                            {act.description && (
                                                <p className="text-xs text-slate-500">{act.description}</p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono pt-1">
                                                {act.dueDate && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={11} /> Due: {new Date(act.dueDate).toLocaleString("en-GB")}
                                                    </span>
                                                )}
                                                {act.relatedLead && (
                                                    <span>Lead: <strong>{act.relatedLead.companyName || act.relatedLead.name}</strong></span>
                                                )}
                                                {act.relatedCustomer && (
                                                    <span>Client: <strong>{act.relatedCustomer.name}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(act._id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors shrink-0"
                                        title="Delete Activity"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* SCHEDULE ACTIVITY MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="font-extrabold text-base">Schedule Activity / Follow-up</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Interaction reminders & call logs</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateActivity} className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Activity Type
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Call">Phone Call</option>
                                        <option value="Meeting">Client Meeting</option>
                                        <option value="Site Visit">Site Visit</option>
                                        <option value="Demo">Product Demo</option>
                                        <option value="Email">Email Follow-up</option>
                                        <option value="WhatsApp">WhatsApp Interaction</option>
                                        <option value="Task">Task / To-Do</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Estimated Duration (Min)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Summary / Subject <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.summary}
                                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                    placeholder="e.g. Discuss revised quote & payment milestones"
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Due Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Detailed Agenda & Action Points
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Meeting notes, client objections, or next action items..."
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {submitting ? "Scheduling..." : "Schedule Activity"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
