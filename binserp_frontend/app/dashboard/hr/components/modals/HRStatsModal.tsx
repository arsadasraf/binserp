import React, { useState, useEffect } from "react";
import { X, Search, User, Clock } from "lucide-react";

interface DisplayItem {
    id: string;
    name: string;
    empId: string;
    department: string;
    designation: string;
    status: string; // "Present", "Absent", "Active", "Inactive"
    checkIn?: string;
    checkOut?: string;
    checkInBy?: string;
    checkOutBy?: string;
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
        let filtered = data;

        if (statusFilter === "in_only") {
            filtered = filtered.filter(item => item.checkIn && !item.checkOut);
        } else if (statusFilter === "completed") {
            filtered = filtered.filter(item => item.checkOut);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (item) =>
                    item.name.toLowerCase().includes(lower) ||
                    item.empId.toLowerCase().includes(lower) ||
                    item.department.toLowerCase().includes(lower)
            );
        }

        setFilteredData(filtered);
    }, [searchTerm, statusFilter, data]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-gray-900 rounded-none sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-h-[90vh] max-w-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {data.length} records found
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, ID, or department..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        />
                    </div>
                    {title.includes("Present") && (
                        <div className="relative sm:w-48">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-xl text-sm appearance-none bg-gray-50 dark:bg-gray-800 dark:text-white pr-8"
                            >
                                <option value="all">All Status</option>
                                <option value="in_only">Checked In (No Out)</option>
                                <option value="completed">Completed</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <User size={48} className="mb-3 opacity-20" />
                            <p>No records found</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile/Tablet Card View */}
                            <div className="grid grid-cols-1 md:hidden gap-4">
                                {filteredData.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex flex-col p-4 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-md transition-all hover:border-blue-100 dark:hover:border-blue-900 group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold overflow-hidden border border-blue-100 dark:border-blue-800 shadow-sm shrink-0">
                                                    {item.photo ? (
                                                        <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-lg">{item.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors line-clamp-1" title={item.name}>
                                                        {item.name}
                                                    </h4>
                                                    <p className="text-xs font-mono text-gray-400">{item.empId}</p>
                                                </div>
                                            </div>
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.status === 'Present'
                                                    ? 'bg-green-50 text-green-700 border-green-100'
                                                    : item.status === 'Absent'
                                                        ? 'bg-red-50 text-red-700 border-red-100'
                                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}
                                            >
                                                {item.status}
                                            </span>
                                        </div>
    
                                        <div className="space-y-1 mb-4 flex-1">
                                            <p className="text-xs text-gray-500 line-clamp-1" title={item.department}>{item.department}</p>
                                            <p className="text-xs text-gray-400 line-clamp-1" title={item.designation}>{item.designation}</p>
                                        </div>
    
                                        <div className="pt-3 border-t border-gray-50 dark:border-gray-800/50 grid grid-cols-2 gap-2">
                                            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Check In</span>
                                                <div className={`flex flex-col items-center gap-0.5`}>
                                                    <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${item.checkIn ? 'text-green-600' : 'text-gray-300'}`}>
                                                        {item.checkIn ? (
                                                            <>
                                                                <Clock size={10} /> {item.checkIn}
                                                            </>
                                                        ) : '-'}
                                                    </div>
                                                    {item.checkInBy && <span className="text-[9px] text-gray-400 font-sans tracking-wide leading-tight">by {item.checkInBy}</span>}
                                                </div>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Check Out</span>
                                                <div className={`flex flex-col items-center gap-0.5`}>
                                                    <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${item.checkOut ? 'text-red-500' : 'text-gray-300'}`}>
                                                        {item.checkOut ? (
                                                            <>
                                                                <Clock size={10} /> {item.checkOut}
                                                            </>
                                                        ) : '-'}
                                                    </div>
                                                    {item.checkOutBy && <span className="text-[9px] text-gray-400 font-sans tracking-wide leading-tight">by {item.checkOutBy}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Row/Table View */}
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
                                                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">{item.name}</h4>
                                                            <p className="text-[10px] font-mono text-gray-400">{item.empId}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{item.department}</p>
                                                    <p className="text-xs text-gray-400 whitespace-nowrap">{item.designation}</p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.status === 'Present'
                                                            ? 'bg-green-50 text-green-700 border-green-100'
                                                            : item.status === 'Absent'
                                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                                : 'bg-blue-50 text-blue-700 border-blue-100'
                                                            }`}
                                                    >
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col">
                                                        <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${item.checkIn ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                                            {item.checkIn ? (
                                                                <>
                                                                    <Clock size={12} /> {item.checkIn}
                                                                </>
                                                            ) : '-'}
                                                        </div>
                                                        {item.checkInBy && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">by {item.checkInBy}</span>}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col">
                                                        <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${item.checkOut ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                                            {item.checkOut ? (
                                                                <>
                                                                    <Clock size={12} /> {item.checkOut}
                                                                </>
                                                            ) : '-'}
                                                        </div>
                                                        {item.checkOutBy && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">by {item.checkOutBy}</span>}
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
