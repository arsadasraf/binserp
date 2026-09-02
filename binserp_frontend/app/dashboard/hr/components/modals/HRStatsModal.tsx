import React, { useState, useEffect } from "react";
import { X, Search, User, Clock } from "lucide-react";

interface DisplayItem {
    id: string;
    name: string;
    empId: string;
    department: string;
    designation: string;
    status: string; // "Check-In Only", "Completed", "Present", "Absent"
    checkIn?: string;
    checkOut?: string;
    checkInBy?: string;
    checkOutBy?: string;
    checkInMethod?: string;
    checkOutMethod?: string;
    photo?: string;
}

interface HRStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: DisplayItem[];
    loading?: boolean;
}

export default function HRStatsModal({
    isOpen,
    onClose,
    title,
    data,
    loading = false,
}: HRStatsModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [filteredData, setFilteredData] = useState<DisplayItem[]>(data);

    useEffect(() => {
        setFilteredData(data);
    }, [data]);

    useEffect(() => {
        let result = data;
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            result = result.filter(
                (item) =>
                    item.name.toLowerCase().includes(query) ||
                    item.empId.toLowerCase().includes(query) ||
                    item.department.toLowerCase().includes(query) ||
                    item.designation.toLowerCase().includes(query)
            );
        }
        if (statusFilter !== "all") {
            const filterKey = statusFilter.toLowerCase();
            result = result.filter((item) => {
                const itemStatus = (item.status || "").toLowerCase();
                if (filterKey === "check-in only" || filterKey === "checkin") {
                    return itemStatus.includes("check-in") || itemStatus.includes("check in") || (Boolean(item.checkIn) && !item.checkOut);
                }
                if (filterKey === "completed") {
                    return itemStatus.includes("complete") || (Boolean(item.checkIn) && Boolean(item.checkOut));
                }
                if (filterKey === "absent") {
                    return itemStatus.includes("absent") || (!item.checkIn && !item.checkOut);
                }
                return itemStatus.includes(filterKey);
            });
        }
        setFilteredData(result);
    }, [searchTerm, statusFilter, data]);

    const renderStatusBadge = (status: string) => {
        const s = (status || "").toLowerCase();
        if (s.includes("check-in") || s.includes("check in") || s === "in_only") {
            return (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    Check-In Only
                </span>
            );
        }
        if (s.includes("complete") || s === "present") {
            return (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    {status}
                </span>
            );
        }
        return (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                {status || "Absent"}
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Showing {filteredData.length} records
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:w-72">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search employee, ID, dept..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                        {["all", "check-in only", "completed", "absent"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                                    statusFilter === status
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {loading ? (
                        <div className="py-20 text-center text-gray-400">Loading...</div>
                    ) : filteredData.length === 0 ? (
                        <div className="py-20 text-center text-gray-400">No records found.</div>
                    ) : (
                        <>
                            {/* Mobile Grid View */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
                                {filteredData.map((item) => (
                                    <div key={item.id} className="bg-white dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold overflow-hidden border border-blue-100 dark:border-blue-800 shadow-sm shrink-0">
                                                    {item.photo ? (
                                                        <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm">{item.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{item.name}</h4>
                                                    <p className="text-[10px] font-mono text-gray-400">{item.empId}</p>
                                                </div>
                                            </div>
                                            {renderStatusBadge(item.status)}
                                        </div>

                                        <div className="space-y-1 mb-4 flex-1">
                                            <p className="text-xs text-gray-500 line-clamp-1">{item.department}</p>
                                            <p className="text-xs text-gray-400 line-clamp-1">{item.designation}</p>
                                        </div>

                                        <div className="pt-3 border-t border-gray-50 dark:border-gray-800/50 grid grid-cols-2 gap-2">
                                            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Check In</span>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${item.checkIn ? 'text-green-600' : 'text-gray-300'}`}>
                                                        {item.checkIn ? <><Clock size={10} /> {item.checkIn}</> : '-'}
                                                    </div>
                                                    {item.checkInMethod && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                                            item.checkInMethod === 'Face' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}>
                                                            {item.checkInMethod === 'Face' ? '📸 Face' : '👤 Manual'}
                                                        </span>
                                                    )}
                                                    {item.checkInBy && <span className="text-[9px] text-gray-400 font-sans tracking-wide leading-tight">by {item.checkInBy}</span>}
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Check Out</span>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${item.checkOut ? 'text-red-500' : 'text-gray-300'}`}>
                                                        {item.checkOut ? <><Clock size={10} /> {item.checkOut}</> : '-'}
                                                    </div>
                                                    {item.checkOutMethod && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                                            item.checkOutMethod === 'Face' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}>
                                                            {item.checkOutMethod === 'Face' ? '📸 Face' : '👤 Manual'}
                                                        </span>
                                                    )}
                                                    {item.checkOutBy && <span className="text-[9px] text-gray-400 font-sans tracking-wide leading-tight">by {item.checkOutBy}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/50 dark:bg-gray-900/50 sticky top-0">
                                        <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <th className="py-3 px-4 font-semibold">Employee</th>
                                            <th className="py-3 px-4 font-semibold">Department & Desig</th>
                                            <th className="py-3 px-4 font-semibold">Status</th>
                                            <th className="py-3 px-4 font-semibold">Check In</th>
                                            <th className="py-3 px-4 font-semibold">Check Out</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                        {filteredData.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold overflow-hidden border border-blue-100 dark:border-blue-800 shadow-sm shrink-0">
                                                            {item.photo ? (
                                                                <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-sm">{item.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{item.name}</h4>
                                                            <p className="text-[10px] font-mono text-gray-400">{item.empId}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.department}</p>
                                                    <p className="text-xs text-gray-400">{item.designation}</p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {renderStatusBadge(item.status)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${item.checkIn ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                                                {item.checkIn ? (
                                                                    <>
                                                                        <Clock size={12} /> {item.checkIn}
                                                                    </>
                                                                ) : '-'}
                                                            </div>
                                                            {item.checkInMethod && (
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                                    item.checkInMethod === 'Face' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300'
                                                                }`}>
                                                                    {item.checkInMethod === 'Face' ? '📸 Face' : '👤 Manual'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.checkInBy && <span className="text-[10px] text-gray-400 dark:text-gray-500">by {item.checkInBy}</span>}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${item.checkOut ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                                                {item.checkOut ? (
                                                                    <>
                                                                        <Clock size={12} /> {item.checkOut}
                                                                    </>
                                                                ) : '-'}
                                                            </div>
                                                            {item.checkOutMethod && (
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                                    item.checkOutMethod === 'Face' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300'
                                                                }`}>
                                                                    {item.checkOutMethod === 'Face' ? '📸 Face' : '👤 Manual'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.checkOutBy && <span className="text-[10px] text-gray-400 dark:text-gray-500">by {item.checkOutBy}</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
