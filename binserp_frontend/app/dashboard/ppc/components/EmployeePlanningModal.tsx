import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Trash2, Wrench, CheckSquare, Square } from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';

interface EmployeePlanningModalProps {
    isOpen: boolean;
    employee: any;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface Allotment {
    _id?: string;
    machines: any[];
    shift: string;
    date: string;
    startTime?: string;
    endTime?: string;
    remarks?: string;
}

export default function EmployeePlanningModal({ isOpen, employee, onClose, onSuccess }: EmployeePlanningModalProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [schedules, setSchedules] = useState<Map<string, Allotment[]>>(new Map());
    const [loading, setLoading] = useState(false);
    const [machines, setMachines] = useState<any[]>([]);

    // Assignment form state
    const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
    const [selectedShift, setSelectedShift] = useState('Day');
    const [customStartTime, setCustomStartTime] = useState('09:00');
    const [customEndTime, setCustomEndTime] = useState('18:00');

    // Machine Plan State
    const [machinePlans, setMachinePlans] = useState<Map<string, any[]>>(new Map());
    const [showAllMachines, setShowAllMachines] = useState(true);

    // Shift Presets
    // Shift Presets
    const [shiftPresets, setShiftPresets] = useState<Record<string, { start: string, end: string }>>({
        'Custom': { start: '09:00', end: '18:00' }
    });
    const [availableShifts, setAvailableShifts] = useState<any[]>([]);

    useEffect(() => {
        const fetchShifts = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/ppc/shift`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const shifts = data.shifts || [];
                    setAvailableShifts(shifts);

                    const newPresets: Record<string, { start: string, end: string }> = { ...shiftPresets };
                    shifts.forEach((s: any) => {
                        newPresets[s.name] = { start: s.startTime, end: s.endTime };
                    });
                    setShiftPresets(newPresets);
                }
            } catch (e) {
                console.error("Error fetching shifts:", e);
            }
        };
        fetchShifts();
    }, []);

    useEffect(() => {
        if (selectedShift && shiftPresets[selectedShift]) {
            setCustomStartTime(shiftPresets[selectedShift].start);
            setCustomEndTime(shiftPresets[selectedShift].end);
        }
    }, [selectedShift, shiftPresets]);



    useEffect(() => {
        if (isOpen && employee) {
            fetchMachines();
            fetchAllotments();
        }
    }, [isOpen, employee, currentDate]);

    useEffect(() => {
        if (selectedDate) {
            fetchMachinePlans(selectedDate);
        } else {
            setMachinePlans(new Map());
        }
    }, [selectedDate]);

    const fetchMachinePlans = async (date: Date) => {
        try {
            const token = localStorage.getItem("token");
            const dateStr = date.toISOString();
            const res = await fetch(`${API_BASE_URL}/api/ppc/machine-plan?startDate=${dateStr}&endDate=${dateStr}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const pMap = new Map<string, any[]>();
                (data.plans || []).forEach((plan: any) => {
                    const mId = typeof plan.machine === 'string' ? plan.machine : plan.machine._id;
                    if (plan.shifts) {
                        pMap.set(mId, plan.shifts);
                    } else if (plan.activeShifts) {
                        // Fallback for legacy
                        pMap.set(mId, plan.activeShifts.map((s: string) => ({ name: s })));
                    }
                });
                setMachinePlans(pMap);
            }
        } catch (e) {
            console.error("Error fetching machine plans", e);
        }
    };

    const fetchMachines = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/ppc/machine`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setMachines(data.machines || []);
        } catch (err) {
            console.error("Error fetching machines:", err);
        }
    };

    const fetchAllotments = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            // Fetch via new Roster API
            const res = await fetch(
                `${API_BASE_URL}/api/ppc/allotment?employee=${employee._id}&startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.ok) {
                const data = await res.json();
                const scheduleMap = new Map<string, Allotment[]>();

                (data.allotments || []).forEach((allotment: any) => {
                    const dateKey = new Date(allotment.date).toDateString();
                    if (!scheduleMap.has(dateKey)) {
                        scheduleMap.set(dateKey, []);
                    }
                    scheduleMap.get(dateKey)!.push({
                        _id: allotment._id,
                        machines: allotment.machines || (allotment.machine ? [allotment.machine] : []),
                        shift: allotment.shift,
                        date: allotment.date,
                        startTime: allotment.startTime,
                        endTime: allotment.endTime,
                        remarks: allotment.remarks
                    });
                });

                setSchedules(scheduleMap);
            }
        } catch (err) {
            console.error("Error fetching roster:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignSchedule = async () => {
        if (!selectedDate || selectedMachines.length === 0) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("token");

            const startTime = customStartTime;
            const endTime = customEndTime;

            const payload = {
                employee: employee._id,
                date: selectedDate.toISOString(),
                shift: selectedShift,
                machines: selectedMachines, // Sending Array
                startTime,
                endTime,
                remarks: "Manual Allocation"
            };

            const res = await fetch(`${API_BASE_URL}/api/ppc/allotment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                onSuccess("Schedule updated successfully!");
                setSelectedMachines([]);
                setSelectedDate(null);
                fetchAllotments();
            }
        } catch (err) {
            console.error("Assignment error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllotment = async (id: string) => {
        if (!confirm("Remove this schedule?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/ppc/allotment/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                onSuccess("Schedule removed");
                fetchAllotments();
            }
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: Date[] = [];

        const firstDayOfWeek = firstDay.getDay();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month, -i);
            days.push(date);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const navigateMonth = (direction: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isCurrentMonth = (date: Date) => {
        return date.getMonth() === currentDate.getMonth();
    };

    const toggleMachineSelection = (machineId: string) => {
        if (selectedMachines.includes(machineId)) {
            setSelectedMachines(selectedMachines.filter(id => id !== machineId));
        } else {
            setSelectedMachines([...selectedMachines, machineId]);
        }
    };

    if (!isOpen) return null;

    const days = getDaysInMonth();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-green-50 to-teal-50 dark:from-gray-800 dark:to-gray-900">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <User className="text-green-600" size={24} />
                            Roster Planning: {employee?.employee?.name || employee?.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{employee?.employeeId} | {employee?.designation || 'Operator'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Calendar Section */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {/* Month Navigation */}
                        <div className="flex justify-between items-center mb-6">
                            <button
                                onClick={() => navigateMonth(-1)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{monthName}</h4>
                            <button
                                onClick={() => navigateMonth(1)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-2">
                            {/* Day Headers */}
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-xs font-semibold text-gray-500 uppercase py-2">
                                    {day}
                                </div>
                            ))}

                            {/* Day Cells */}
                            {days.map((date, idx) => {
                                const dateKey = date.toDateString();
                                const assignments = schedules.get(dateKey) || [];
                                const isSelected = selectedDate?.toDateString() === dateKey;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => isCurrentMonth(date) && setSelectedDate(date)}
                                        className={`min-h-[100px] p-2 border rounded-lg cursor-pointer transition-all ${!isCurrentMonth(date)
                                            ? 'bg-gray-50 dark:bg-gray-800/50 opacity-40'
                                            : isSelected
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 ring-2 ring-green-500'
                                                : isToday(date)
                                                    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-green-300'
                                            }`}
                                    >
                                        <div className={`text-sm font-medium mb-1 ${isToday(date) ? 'text-blue-600 font-bold' : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {date.getDate()}
                                        </div>

                                        <div className="space-y-1">
                                            {assignments.slice(0, 2).map((assignment, i) => (
                                                <div
                                                    key={i}
                                                    className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1 py-0.5 rounded truncate"
                                                >
                                                    {assignment.shift} - {assignment.machines?.map(m => m.machineCode).join(', ') || 'N/A'}
                                                </div>
                                            ))}
                                            {assignments.length > 2 && (
                                                <div className="text-[9px] text-gray-500">+{assignments.length - 2} more</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Assignment Panel */}
                    <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-6 overflow-y-auto">
                        {selectedDate ? (
                            <>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </h4>

                                {/* Existing Assignments */}
                                {schedules.get(selectedDate.toDateString())?.map((assignment) => (
                                    <div key={assignment._id} className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="text-xs font-semibold text-green-600">{assignment.shift} Shift</div>
                                            <button
                                                onClick={() => assignment._id && handleDeleteAllotment(assignment._id)}
                                                className="p-1 hover:bg-red-50 rounded text-red-500"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                            <div className="flex items-start gap-1 mb-1">
                                                <Wrench size={12} className="mt-0.5" />
                                                <span className="flex-1">
                                                    {assignment.machines?.map(m => m.machineName).join(', ') || 'No machine'}
                                                </span>
                                            </div>
                                            {assignment.startTime && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {assignment.startTime} - {assignment.endTime}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* New Assignment Form */}
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Plus size={16} />
                                        Assign Shift & Machine
                                    </h5>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Shift</label>
                                            <select
                                                value={selectedShift}
                                                onChange={(e) => setSelectedShift(e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                                            >
                                                {availableShifts.map(s => (
                                                    <option key={s._id} value={s.name}>{s.name} ({s.startTime} - {s.endTime})</option>
                                                ))}
                                                <option value="Custom">Custom Hours</option>
                                            </select>
                                        </div>

                                        {/* Time Inputs (Always Visible for reference, editable for Custom) */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                                                <input
                                                    type="time"
                                                    value={customStartTime}
                                                    onChange={(e) => setCustomStartTime(e.target.value)}
                                                    disabled={selectedShift !== 'Custom'}
                                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800/50 disabled:text-gray-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                                                <input
                                                    type="time"
                                                    value={customEndTime}
                                                    onChange={(e) => setCustomEndTime(e.target.value)}
                                                    disabled={selectedShift !== 'Custom'}
                                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800/50 disabled:text-gray-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Select Machines</label>
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={showAllMachines}
                                                    onChange={(e) => setShowAllMachines(e.target.checked)}
                                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-1.5 h-3 w-3"
                                                />
                                                <span className="text-xs text-gray-500">Show All</span>
                                            </label>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-2 space-y-1">
                                            {machines.filter(m => {
                                                if (showAllMachines) return true;
                                                if (!selectedDate || selectedShift === 'Custom') return true;
                                                const plans = machinePlans.get(m._id);
                                                // Check if machine has a plan that matches the selected shift name
                                                return plans && plans.some((p: any) => p.name === selectedShift);
                                            }).length === 0 && (
                                                    <div className="text-center py-4 text-xs text-gray-400">
                                                        No machines planned for {selectedShift} shift
                                                    </div>
                                                )}
                                            {machines.filter(m => {
                                                if (showAllMachines) return true;
                                                if (!selectedDate || selectedShift === 'Custom') return true;
                                                const plans = machinePlans.get(m._id);
                                                return plans && plans.some((p: any) => p.name === selectedShift);
                                            }).map(machine => {
                                                const isChecked = selectedMachines.includes(machine._id);
                                                const plans = machinePlans.get(machine._id);
                                                const planNames = plans ? plans.map((p: any) => p.name).join(', ') : '';
                                                return (
                                                    <div
                                                        key={machine._id}
                                                        onClick={() => toggleMachineSelection(machine._id)}
                                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <div className={`text-indigo-600 dark:text-indigo-400`}>
                                                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 transform transition-all duration-200">{machine.machineName} <span className="text-gray-500 text-xs font-normal">({machine.machineCode})</span></div>
                                                            {plans && plans.length > 0 && (
                                                                <div className="text-[10px] text-blue-600 bg-blue-50 inline-block px-1.5 py-0.5 rounded border border-blue-100 mt-0.5 font-medium">
                                                                    Planned: {planNames}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1 flex justify-between">
                                            <span>{selectedMachines.length} selected</span>
                                            {selectedMachines.length > 0 && (
                                                <button onClick={() => setSelectedMachines([])} className="text-indigo-500 hover:text-indigo-700">Clear</button>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAssignSchedule}
                                        disabled={selectedMachines.length === 0 || loading}
                                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        {loading ? 'Assigning...' : 'Confirm Allotment'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <CalendarIcon size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-sm text-gray-500">Select a date to manage roster</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
