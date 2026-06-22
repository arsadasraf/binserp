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
    const [filteredData, setFilteredData] = useState<DisplayItem[]>(data);

    useEffect(() => {
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            setFilteredData(
                data.filter(
                    (item) =>
                        item.name.toLowerCase().includes(lower) ||
                        item.empId.toLowerCase().includes(lower) ||
                        item.department.toLowerCase().includes(lower)
                )
            );
        } else {
            setFilteredData(data);
        }
    }, [searchTerm, data]);

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

                {/* Search Bar */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, ID, or department..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        />
                    </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredData.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col p-4 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-md transition-all hover:border-blue-100 dark:hover:border-blue-900 group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold overflow-hidden border border-blue-100 dark:border-blue-800 shadow-sm">
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
                                        <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-2 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Check In</span>
                                            <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${item.checkIn ? 'text-green-600' : 'text-gray-300'}`}>
                                                {item.checkIn ? (
                                                    <>
                                                        <Clock size={10} /> {item.checkIn}
                                                    </>
                                                ) : '-'}
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-2 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Check Out</span>
                                            <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${item.checkOut ? 'text-red-500' : 'text-gray-300'}`}>
                                                {item.checkOut ? (
                                                    <>
                                                        <Clock size={10} /> {item.checkOut}
                                                    </>
                                                ) : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
