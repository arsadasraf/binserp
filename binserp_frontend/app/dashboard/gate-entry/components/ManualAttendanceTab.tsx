"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/src/utils/config';
import { UserCheck, Search, Clock, RotateCcw, CheckCircle } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function ManualAttendanceTab() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time and fetch fresh data every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
            fetchData(false); // Fetch silently without setting loading=true
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const token = localStorage.getItem('token');
            
            // Fetch active employees
            const empRes = axios.get(`${API_BASE_URL}/api/hr/employee?status=Active`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Fetch today's attendance using local date
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const attRes = axios.get(`${API_BASE_URL}/api/hr/attendance?startDate=${today}&endDate=${today}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const [employeesResponse, attendanceResponse] = await Promise.all([empRes, attRes]);
            
            setEmployees(employeesResponse.data.employees || []);
            
            const attData = attendanceResponse.data.attendance || [];
            const attMap: Record<string, any> = {};
            attData.forEach((att: any) => {
                // Populate employee _id (employee field might be populated object or just _id string)
                const empId = att.employee?._id || att.employee;
                if (empId) {
                    const empIdStr = empId.toString();
                    // Since backend returns sorted by date DESC (newest first), we only keep the first one we see
                    if (!attMap[empIdStr]) {
                        attMap[empIdStr] = att;
                    }
                }
            });
            setAttendanceMap(attMap);

        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAttendance = async (employeeIdStr: string, employeeDbId: string, type: 'checkIn' | 'checkOut' | 'undoCheckIn' | 'undoCheckOut') => {
        try {
            setActionLoading(employeeDbId);
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/hr/attendance`, {
                employeeId: employeeIdStr, 
                type: type,
                location: 'Manual Gate Entry'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh data after action
            await fetchData();
        } catch (error: any) {
            console.error(`Failed to ${type}:`, error);
            alert(error.response?.data?.message || `Failed to record ${type}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderActionButtons = (emp: any) => {
        const att = attendanceMap[emp._id.toString()];

        if (!att || !att.checkIn) {
            // Not checked in at all
            return (
                <button
                    onClick={() => handleAttendance(emp.employeeId, emp._id, 'checkIn')}
                    disabled={actionLoading === emp._id}
                    className="flex items-center justify-center gap-1.5 w-full py-2 bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-sm transition-all border border-green-200 rounded-lg text-sm font-bold"
                >
                    {actionLoading === emp._id ? <LoadingSpinner /> : <Clock size={16} />}
                    Check In
                </button>
            );
        }

        if (att.checkIn && !att.checkOut) {
            // Checked in, but not checked out
            const checkInTime = new Date(att.checkIn.time).getTime();
            const diffMins = (currentTime.getTime() - checkInTime) / 60000;

            if (diffMins <= 5) {
                // Within 5 minutes of checkIn -> Show Undo CheckIn
                return (
                    <button
                        onClick={() => handleAttendance(emp.employeeId, emp._id, 'undoCheckIn')}
                        disabled={actionLoading === emp._id}
                        className="flex items-center justify-center gap-1.5 w-full py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-sm transition-all border border-amber-200 rounded-lg text-sm font-bold"
                    >
                        {actionLoading === emp._id ? <LoadingSpinner /> : <RotateCcw size={16} />}
                        Undo Check-In
                    </button>
                );
            } else {
                // Past 5 minutes -> Show CheckOut
                return (
                    <button
                        onClick={() => handleAttendance(emp.employeeId, emp._id, 'checkOut')}
                        disabled={actionLoading === emp._id}
                        className="flex items-center justify-center gap-1.5 w-full py-2 bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-sm transition-all border border-red-200 rounded-lg text-sm font-bold"
                    >
                        {actionLoading === emp._id ? <LoadingSpinner /> : <Clock size={16} />}
                        Check Out
                    </button>
                );
            }
        }

        if (att.checkOut) {
            // Checked out
            const checkOutTime = new Date(att.checkOut.time).getTime();
            const diffMins = (currentTime.getTime() - checkOutTime) / 60000;

            if (diffMins <= 5) {
                // Within 5 minutes of checkOut -> Show Undo CheckOut
                return (
                    <button
                        onClick={() => handleAttendance(emp.employeeId, emp._id, 'undoCheckOut')}
                        disabled={actionLoading === emp._id}
                        className="flex items-center justify-center gap-1.5 w-full py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-sm transition-all border border-amber-200 rounded-lg text-sm font-bold"
                    >
                        {actionLoading === emp._id ? <LoadingSpinner /> : <RotateCcw size={16} />}
                        Undo Check-Out
                    </button>
                );
            } else {
                // Past 5 minutes -> Done for the day
                return (
                    <div className="flex items-center justify-center gap-1.5 w-full py-2 bg-gray-100 text-gray-500 border border-gray-200 rounded-lg text-sm font-bold cursor-not-allowed">
                        <CheckCircle size={16} className="text-gray-400" />
                        Completed
                    </div>
                );
            }
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <UserCheck className="text-blue-600" />
                        Manual Employee Attendance
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Actions are reversible within 5 minutes of punching.</p>
                </div>
                
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 dark:bg-slate-700 dark:text-white"
                    />
                </div>
            </div>

            <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-900/50">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <LoadingSpinner />
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400">
                        <UserCheck size={32} className="mb-2 opacity-50" />
                        <p>No employees found.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                        {filteredEmployees.map((emp) => (
                            <li key={emp._id} className="p-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    {emp.photo ? (
                                        <img src={emp.photo} alt={emp.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-100 dark:border-slate-700" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center border-2 border-gray-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-bold text-lg">
                                            {emp.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{emp.name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{emp.employeeId}</span>
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{emp.department || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-6 md:w-auto w-full">
                                    {/* Display punch times if any */}
                                    <div className="flex flex-col text-right text-xs font-mono text-gray-500 dark:text-gray-400 min-w-[80px]">
                                        {attendanceMap[emp._id.toString()]?.checkIn?.time && (
                                            <span className="text-green-600 dark:text-green-400">IN: {new Date(attendanceMap[emp._id.toString()].checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        )}
                                        {attendanceMap[emp._id.toString()]?.checkOut?.time && (
                                            <span className="text-red-600 dark:text-red-400">OUT: {new Date(attendanceMap[emp._id.toString()].checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        )}
                                    </div>
                                    
                                    <div className="w-36 flex shrink-0">
                                        {renderActionButtons(emp)}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
