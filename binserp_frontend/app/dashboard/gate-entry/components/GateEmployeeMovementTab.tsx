"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Activity, History, Search, User, CheckCircle2, LogOut, Clock } from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';
import ColumnFilter from '../../store/components/tables/ColumnFilter';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useHeader } from '@/src/context/HeaderContext';
import { X, Save } from 'lucide-react';

import { useRouter } from "next/navigation";

export default function GateEmployeeMovementTab({ initialViewMode = 'active' }: { initialViewMode?: 'active' | 'history' }) {
    const router = useRouter();
    const { setShowBottomNav } = useHeader();
    const [movements, setMovements] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<string, string[]>>({});

    const handleFilterChange = (column: string, values: string[]) => {
        setFilters(prev => ({
            ...prev,
            [column]: values
        }));
    };

    // View Mode: 'active' | 'history'
    const [viewMode, setViewMode] = useState<'active' | 'history'>(initialViewMode);

    useEffect(() => {
        if (initialViewMode) {
            setViewMode(initialViewMode);
        }
    }, [initialViewMode]);
    const [historyFilterType, setHistoryFilterType] = useState<'daywise' | 'monthwise'>('daywise');
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [historyMonth, setHistoryMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    });

    // Modal State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [entryLoading, setEntryLoading] = useState(false);

    // --- Entry Form State ---
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [reason, setReason] = useState('Official Work');
    const [notes, setNotes] = useState('');
    const [approvedBy, setApprovedBy] = useState('');
    
    // --- Employee Search State ---
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

    const loadEmployees = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/hr/employee`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(res.data.employees || []);
        } catch (error) {
            console.error("Load employees failed", error);
        }
    }, []);

    const loadMovements = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/employee-movement/active`;
            let params = {};

            if (viewMode === 'history') {
                url = `${API_BASE_URL}/api/employee-movement`; // Get all (filtered)
                
                if (historyFilterType === 'daywise') {
                    const start = new Date(historyDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(historyDate);
                    end.setHours(23, 59, 59, 999);
                    params = { start: start.toISOString(), end: end.toISOString() };
                } else {
                    const [year, month] = historyMonth.split('-');
                    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
                    const end = new Date(parseInt(year), parseInt(month), 0); // Last day of month
                    end.setHours(23, 59, 59, 999);
                    params = { start: start.toISOString(), end: end.toISOString() };
                }
            }

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            setMovements(res.data.movements || []);
        } catch (error) {
            console.error("Load movements failed", error);
        } finally {
            setLoading(false);
        }
    }, [viewMode, historyDate, historyFilterType, historyMonth]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    useEffect(() => {
        loadMovements();
    }, [loadMovements]);

    useEffect(() => {
        if (isEntryModalOpen) {
            setShowBottomNav(false);
        } else {
            setShowBottomNav(true);
        }
        return () => setShowBottomNav(true);
    }, [isEntryModalOpen, setShowBottomNav]);

    // Check In
    const handleCheckIn = async (id: string) => {
        if (!confirm("Confirm Return?")) return;
        try {
            setCheckoutLoading(id);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/employee-movement/in/${id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (viewMode === 'active') {
                setMovements(prev => prev.filter(m => m._id !== id));
            } else {
                loadMovements();
            }
        } catch (error) {
            console.error("Return recording failed", error);
            alert("Failed to record return.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    // Submit Out Entry
    const handleCheckOut = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || !reason) {
            alert("Please select employee and reason.");
            return;
        }

        try {
            setEntryLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/employee-movement/out`, {
                employee: selectedEmployee,
                reason,
                notes,
                approvedBy
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Employee Exit Recorded Successfully!");
            setSelectedEmployee('');
            setReason('Official Work');
            setNotes('');
            setApprovedBy('');
            setIsEntryModalOpen(false);

            loadMovements();
        } catch (error: any) {
            console.error("Check-out failed", error);
            alert(error.response?.data?.message || "Failed to record exit.");
        } finally {
            setEntryLoading(false);
        }
    };

    const getEmployeeName = (movement: any) => {
        if (!movement.employee) return 'Unknown';
        return movement.employee.name || 'Unknown';
    };

    const filteredMovements = movements.filter(item => {
        const empName = getEmployeeName(item).toLowerCase();
        const matchesSearch = empName.includes(searchTerm.toLowerCase()) ||
            (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        return Object.entries(filters).every(([key, selectedValues]) => {
            if (selectedValues.length === 0) return true;
            let itemValue = '';
            if (key === 'employeeName') {
                itemValue = getEmployeeName(item);
            } else {
                itemValue = String(item[key] || '-');
            }
            return selectedValues.includes(itemValue);
        });
    });

    return (
        <div className="space-y-4 md:space-y-6 -mt-2 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 gap-4">

                {/* Left: Title & Toggles */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg w-full">
                        <button
                            onClick={() => {
                                setViewMode('active');
                                router.push('/dashboard/gate-entry/employee-movement/active');
                            }}
                            className={`flex-1 md:flex-none md:px-6 py-3 rounded-md text-sm font-semibold flex justify-center items-center gap-2 transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <Activity size={16} /> Active
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('history');
                                router.push('/dashboard/gate-entry/employee-movement/history');
                            }}
                            className={`flex-1 md:flex-none md:px-6 py-3 rounded-md text-sm font-semibold flex justify-center items-center gap-2 transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <History size={16} /> History
                        </button>
                    </div>
                </div>

                {/* Right: Controls & Search */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {viewMode === 'history' && (
                        <>
                            <div className="bg-gray-100 dark:bg-slate-700 flex p-1 rounded-lg">
                                <button
                                    onClick={() => setHistoryFilterType("monthwise")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${historyFilterType === "monthwise"
                                        ? "bg-white text-gray-800 dark:bg-slate-800 dark:text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setHistoryFilterType("daywise")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${historyFilterType === "daywise"
                                        ? "bg-white text-gray-800 dark:bg-slate-800 dark:text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        }`}
                                >
                                    Daily
                                </button>
                            </div>

                            {historyFilterType === "monthwise" ? (
                                <input
                                    type="month"
                                    value={historyMonth}
                                    onChange={(e) => setHistoryMonth(e.target.value)}
                                    className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm bg-white dark:bg-slate-800"
                                />
                            ) : (
                                <input
                                    type="date"
                                    value={historyDate}
                                    onChange={(e) => setHistoryDate(e.target.value)}
                                    className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm bg-white dark:bg-slate-800"
                                />
                            )}
                        </>
                    )}

                    <div className="relative flex-1 md:flex-none hidden md:block">
                        <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            className="pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {viewMode === 'active' && (
                        <button
                            onClick={() => setIsEntryModalOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                        >
                            <LogOut size={18} /> Record Exit
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile View: Cards */}
            <div className="grid grid-cols-1 gap-4 animate-in fade-in md:hidden">
                {loading ? <div className="text-center py-12"><LoadingSpinner /></div> : filteredMovements.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed">
                        {searchTerm ? 'No records found matching search.' : (viewMode === 'active' ? 'No employees currently outside.' : 'No movement history for this date.')}
                    </div>
                ) : (
                    filteredMovements.map((v) => (
                        <div
                            key={v._id}
                            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-4 transition-all group ${v.status === 'Inside' ? 'border-gray-100 dark:border-slate-700 opacity-80' : 'border-blue-100 ring-1 ring-blue-50'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{getEmployeeName(v)}</h3>
                                    <div className="text-xs font-semibold text-blue-600 mt-0.5">{v.employee?.designation || 'Employee'}</div>
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Outside' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                    {v.status}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2 text-xs"><Activity size={12} className="text-gray-400" /> Reason: <span className="font-medium text-gray-900 dark:text-white">{v.reason}</span></div>
                                {v.approvedBy && <div className="flex items-center gap-2 text-xs"><CheckCircle2 size={12} className="text-gray-400" /> Approved By: <span className="font-medium text-gray-900 dark:text-white">{v.approvedBy}</span></div>}
                                
                                <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50 dark:border-slate-700">
                                    <div className="flex flex-col gap-0.5 text-orange-500">
                                        <div className="flex items-center gap-1.5">
                                            <LogOut size={12} /> OUT: {new Date(v.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {v.createdBy && <div className="text-[10px] text-gray-400 ml-4">by {v.createdBy.name}</div>}
                                    </div>
                                    {v.inTime ? (
                                        <div className="flex flex-col gap-0.5 text-green-600 items-end">
                                            <div className="flex items-center gap-1.5">
                                                IN: {new Date(v.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {v.checkedInBy && <div className="text-[10px] text-gray-400">by {v.checkedInBy.name}</div>}
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleCheckIn(v._id)} 
                                            disabled={checkoutLoading === v._id}
                                            className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded font-bold text-xs transition-colors"
                                        >
                                            {checkoutLoading === v._id ? 'Processing...' : 'Mark Returned'}
                                        </button>
                                    )}
                                </div>
                                {v.duration && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                        <Clock size={12} /> Duration: <span className="font-bold">{v.duration} min</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                        <thead className="bg-gray-50 dark:bg-slate-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="employeeName"
                                        title="Employee"
                                        data={movements}
                                        currentFilters={filters['employeeName'] || []}
                                        onFilterChange={(vals) => handleFilterChange('employeeName', vals)}
                                        getValue={(item) => getEmployeeName(item)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="reason"
                                        title="Reason"
                                        data={movements}
                                        currentFilters={filters['reason'] || []}
                                        onFilterChange={(vals) => handleFilterChange('reason', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="approvedBy"
                                        title="Approved By"
                                        data={movements}
                                        currentFilters={filters['approvedBy'] || []}
                                        onFilterChange={(vals) => handleFilterChange('approvedBy', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">Out Time</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">In Time</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">Duration</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="status"
                                        title="Status"
                                        data={movements}
                                        currentFilters={filters['status'] || []}
                                        onFilterChange={(vals) => handleFilterChange('status', vals)}
                                    />
                                </th>
                                {viewMode === 'active' && <th className="px-4 py-3 align-top text-right"><div className="font-bold mb-2">Action</div></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12"><LoadingSpinner /></td>
                                </tr>
                            ) : filteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border-dashed">
                                        {searchTerm ? 'No records found matching search.' : (viewMode === 'active' ? 'No employees currently outside.' : 'No movement history for this date.')}
                                    </td>
                                </tr>
                            ) : (
                                filteredMovements.map((v) => (
                                    <tr 
                                        key={v._id} 
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${v.status === 'Inside' ? 'opacity-80' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{getEmployeeName(v)}</td>
                                        <td className="px-4 py-3">{v.reason}</td>
                                        <td className="px-4 py-3">{v.approvedBy || '-'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-orange-500 font-medium">{new Date(v.outTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                            {v.createdBy && <div className="text-xs text-gray-500">by {v.createdBy.name}</div>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {v.inTime ? (
                                                <>
                                                    <div className="text-green-600">{new Date(v.inTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                    {v.checkedInBy && <div className="text-xs text-gray-500">by {v.checkedInBy.name}</div>}
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 font-bold">{v.duration ? `${v.duration} min` : '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Outside' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                                {v.status}
                                            </span>
                                        </td>
                                        {viewMode === 'active' && (
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    onClick={() => handleCheckIn(v._id)}
                                                    disabled={checkoutLoading === v._id}
                                                    className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded font-bold text-xs transition-colors whitespace-nowrap"
                                                >
                                                    {checkoutLoading === v._id ? 'Processing...' : 'Mark Returned'}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Entry Modal */}
            {isEntryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Record Employee Exit</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Log an employee going outside.</p>
                            </div>
                            <button onClick={() => setIsEntryModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors bg-gray-50 dark:bg-slate-800/50 p-2 rounded-full hover:bg-gray-100 dark:bg-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8">
                            <form onSubmit={handleCheckOut} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="relative">
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Select Employee <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={selectedEmployee ? (employees.find(e => e._id === selectedEmployee)?.name || '') : employeeSearchTerm}
                                            onChange={(e) => {
                                                setEmployeeSearchTerm(e.target.value);
                                                setSelectedEmployee('');
                                                setShowEmployeeDropdown(true);
                                            }}
                                            onFocus={() => setShowEmployeeDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                                            placeholder="Search employee by name..."
                                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-800"
                                            required={!selectedEmployee}
                                        />
                                        {showEmployeeDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {employees.filter(emp => (emp.name || '').toLowerCase().includes(employeeSearchTerm.toLowerCase())).map(emp => (
                                                    <div 
                                                        key={emp._id} 
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Prevents input onBlur from firing before selection
                                                            setSelectedEmployee(emp._id);
                                                            setEmployeeSearchTerm('');
                                                            setShowEmployeeDropdown(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm text-gray-900 dark:text-white"
                                                    >
                                                        {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                                                    </div>
                                                ))}
                                                {employees.filter(emp => (emp.name || '').toLowerCase().includes(employeeSearchTerm.toLowerCase())).length === 0 && (
                                                    <div className="px-4 py-2 text-sm text-gray-500 text-center">No employees found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Reason for Exit <span className="text-red-500">*</span></label>
                                        <select 
                                            required 
                                            value={reason} 
                                            onChange={e => setReason(e.target.value)} 
                                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-800"
                                        >
                                            <option value="Official Work">Official Work</option>
                                            <option value="Lunch Break">Lunch Break</option>
                                            <option value="Snacks Break">Snacks Break</option>
                                            <option value="Personal">Personal</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Approved By</label>
                                        <input 
                                            type="text" 
                                            value={approvedBy} 
                                            onChange={e => setApprovedBy(e.target.value)} 
                                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 bg-white dark:bg-slate-800" 
                                            placeholder="e.g. HR Manager / Name" 
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Who authorized this exit?</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Additional Notes</label>
                                        <textarea 
                                            value={notes} 
                                            onChange={e => setNotes(e.target.value)} 
                                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 resize-none h-24 bg-white dark:bg-slate-800" 
                                            placeholder="Enter any additional details..." 
                                        />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsEntryModalOpen(false)} className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:bg-slate-700 rounded-xl transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={entryLoading}
                                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {entryLoading ? <LoadingSpinner /> : <Save size={18} />} Record Exit
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
