import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, DollarSign, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { Employee } from '../../types/hr.types';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { API_BASE_URL } from '@/src/utils/config';

interface GenerateSalaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function GenerateSalaryModal({ isOpen, onClose, onSuccess }: GenerateSalaryModalProps) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Form State
    const [selectedEmployee, setSelectedEmployee] = useState("");
    const [month, setMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [year, setYear] = useState(new Date().getFullYear());
    const [overtimeHours, setOvertimeHours] = useState(0);
    const [incentives, setIncentives] = useState(0);
    const [deductions, setDeductions] = useState(0);

    // Stats State
    const [statsLoading, setStatsLoading] = useState(false);
    const [presentDays, setPresentDays] = useState(0);
    const [absentDays, setAbsentDays] = useState(0);
    const [totalDays, setTotalDays] = useState(30);
    const [dailyStats, setDailyStats] = useState<Record<string, any>>({});

    // Estimation State
    const [estimatedSalary, setEstimatedSalary] = useState(0);

    const backendUrl = API_BASE_URL;

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
        }
    }, [isOpen]);

    // Fetch Stats when Employee, Month or Year changes
    useEffect(() => {
        if (selectedEmployee && month && year) {
            fetchStats();
        }
    }, [selectedEmployee, month, year]);

    // Recalculate Estimated Salary whenever inputs change
    useEffect(() => {
        calculateEstimate();
    }, [presentDays, overtimeHours, incentives, deductions, selectedEmployee, employees]);

    const fetchEmployees = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${backendUrl}/api/hr/employee`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(res.data.employees);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const fetchStats = async () => {
        try {
            setStatsLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${backendUrl}/api/hr/salary/stats`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { employeeId: selectedEmployee, month, year }
            });

            const { presentDays, absentDays, totalDays, totalOvertimeHours, dailyStats } = res.data;
            setPresentDays(presentDays);
            setAbsentDays(absentDays || 0);
            setTotalDays(totalDays || 30);
            setOvertimeHours(totalOvertimeHours); // Auto-fill OT
            setDailyStats(dailyStats);

        } catch (error) {
            console.error("Error fetching stats:", error);
            setPresentDays(0);
            setAbsentDays(0);
            setTotalDays(30);
            setOvertimeHours(0);
            setDailyStats({});
        } finally {
            setStatsLoading(false);
        }
    };

    const calculateEstimate = () => {
        if (!selectedEmployee) return;
        const employee = employees.find(e => e._id === selectedEmployee);
        if (!employee || !employee.salary) return;

        const { basic, hra, conveyance, medical, specialAllowance, pf, professionalTax } = employee.salary;

        // Simple Estimation Logic (matching backend roughly)
        // Standard Days = 30 for calculation denominator usually
        const standardDays = 30;
        const prorateFactor = presentDays / standardDays;

        const earnedBasic = basic * prorateFactor;
        const earnedHra = hra * prorateFactor;
        const earnedConveyance = conveyance * prorateFactor;
        const earnedMedical = medical * prorateFactor;
        const earnedSpecial = specialAllowance * prorateFactor;

        const gross = earnedBasic + earnedHra + earnedConveyance + earnedMedical + earnedSpecial;

        // OT
        const hourlyRate = (basic / 30) / 8;
        const otAmount = hourlyRate * overtimeHours;

        const totalDeductions = (pf || 0) + (professionalTax || 0) + (deductions || 0);

        const net = gross + otAmount + (incentives || 0) - totalDeductions;
        setEstimatedSalary(Math.round(net));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${backendUrl}/api/hr/salary`, {
                employeeId: selectedEmployee,
                month,
                year,
                overtimeHours,
                incentives,
                deductions
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error generating salary:", error);
            const msg = error.response?.data?.message || "Failed to generate salary slip.";
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Helper to render calendar grid
    const renderCalendar = () => {
        const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDay = new Date(year, monthIndex, 1).getDay(); // 0 is Sunday

        const days = [];
        // Empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 md:h-10 bg-gray-50/50 rounded-md"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const stat = dailyStats[dateStr];
            let bgColor = "bg-gray-100 text-gray-400"; // Default / Weekend / No Data

            if (stat) {
                if (stat.status === "Present") bgColor = "bg-green-100 text-green-700 font-semibold border border-green-200";
                else if (stat.status === "HalfDay") bgColor = "bg-yellow-100 text-yellow-700 font-semibold border border-yellow-200";
                else if (stat.status === "Absent") bgColor = "bg-red-50 text-red-400 border border-red-100";
            }

            days.push(
                <div key={d} className={`h-8 md:h-10 flex items-center justify-center rounded-md text-xs md:text-sm ${bgColor} relative group cursor-default transition-all hover:scale-105`}>
                    {d}
                    {stat && (
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded shadow-xl whitespace-nowrap z-10 w-max">
                            <div>Status: {stat.status}</div>
                            {stat.hoursWorked > 0 && <div>Hours: {stat.hoursWorked}h</div>}
                            {stat.checkIn && <div>In: {new Date(stat.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                            {stat.checkOut && <div>Out: {new Date(stat.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                        </div>
                    )}
                </div>
            );
        }

        return days;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">Generate Monthly Salary</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/50">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Left Column: Controls (5 cols) */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Employee</label>
                                    <select
                                        required
                                        value={selectedEmployee}
                                        onChange={(e) => setSelectedEmployee(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none transition-all"
                                    >
                                        <option value="">-- Choose Employee --</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.name} ({emp.department})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Month</label>
                                        <select
                                            value={month}
                                            onChange={(e) => setMonth(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none transition-all"
                                        >
                                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Year</label>
                                        <select
                                            value={year}
                                            onChange={(e) => setYear(Number(e.target.value))}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none transition-all"
                                        >
                                            {[2023, 2024, 2025].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><DollarSign size={16} /> Adjustments</h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="flex justify-between text-sm font-semibold text-gray-700 mb-1.5">
                                            <span>Overtime (Hours)</span>
                                            {selectedEmployee && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-normal cursor-help" title="Calculated from attendance records based on >9hr shifts">Auto-calculated</span>}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={overtimeHours}
                                                onChange={(e) => setOvertimeHours(parseFloat(e.target.value))}
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none transition-all"
                                                placeholder="0"
                                            />
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Incentives (₹)</label>
                                            <input
                                                type="number"
                                                value={incentives}
                                                onChange={(e) => setIncentives(parseFloat(e.target.value))}
                                                className="w-full px-4 py-2.5 bg-green-50/50 border border-transparent focus:bg-white focus:border-green-500 rounded-lg outline-none transition-all text-green-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Deductions (₹)</label>
                                            <input
                                                type="number"
                                                value={deductions}
                                                onChange={(e) => setDeductions(parseFloat(e.target.value))}
                                                className="w-full px-4 py-2.5 bg-red-50/50 border border-transparent focus:bg-white focus:border-red-500 rounded-lg outline-none transition-all text-red-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Payment Card */}
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-xl shadow-lg text-white">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-blue-100">Estimated Net Salary</h4>
                                    <DollarSign className="text-blue-200" size={20} />
                                </div>
                                <div className="text-3xl font-bold mb-1">
                                    ₹ {estimatedSalary.toLocaleString()}
                                </div>
                                <p className="text-xs text-blue-200 opacity-80">
                                    Based on {presentDays} days present & {overtimeHours} OT hours
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Visual Stats (7 cols) */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Stats Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                                    <div className="text-2xl font-bold text-green-600">{presentDays}</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Present Days</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                                    <div className="text-2xl font-bold text-red-500">{absentDays}</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Absent Days</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                                    <div className="text-2xl font-bold text-gray-700">{totalDays}</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Days</div>
                                </div>
                            </div>

                            {/* Calendar */}
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full bg-slate-50">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calendar size={16} /> Monthly Attendance
                                </h4>

                                <div className="flex-1">
                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                            <div key={d} className="text-center text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 md:gap-2">
                                        {!selectedEmployee ? (
                                            <div className="col-span-7 py-12 text-center text-gray-400 text-sm">Select an employee to view attendance.</div>
                                        ) : statsLoading ? (
                                            <div className="col-span-7 py-12 flex justify-center"><LoadingSpinner /></div>
                                        ) : (
                                            renderCalendar()
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !selectedEmployee}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {loading ? <LoadingSpinner /> : <Check size={18} />} Generate Slip
                    </button>
                </div>
            </div>
        </div>
    );
}
