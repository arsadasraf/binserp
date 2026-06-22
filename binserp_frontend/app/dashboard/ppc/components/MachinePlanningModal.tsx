import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Trash2, Clock, Settings } from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';

interface MachinePlanningModalProps {
    isOpen: boolean;
    machine: any;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface Shift {
    name: string; // "First", "Second", "Third", "General", "Custom"
    startTime: string;
    endTime: string;
}

interface MachinePlan {
    _id?: string;
    date: string; // ISO Date String
    shifts: Shift[];
    status: string;
}

interface JobAssignment {
    _id?: string;
    operator: any;
    job: any;
    shift: string;
    scheduledStart: string;
}

export default function MachinePlanningModal({ isOpen, machine, onClose, onSuccess }: MachinePlanningModalProps) {
    const [activeTab, setActiveTab] = useState<'shifts' | 'jobs'>('shifts');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(false);

    // Shift Planning State
    const [machinePlans, setMachinePlans] = useState<Map<string, Shift[]>>(new Map());

    // Job Scheduling State
    const [jobAssignments, setJobAssignments] = useState<Map<string, JobAssignment[]>>(new Map());
    const [employees, setEmployees] = useState<any[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);

    // Form State (Shared / Shift Specific)
    const [newShiftName, setNewShiftName] = useState('First');
    const [newStartTime, setNewStartTime] = useState('06:00');
    const [newEndTime, setNewEndTime] = useState('14:00');

    // Job Form State
    const [selectedOperator, setSelectedOperator] = useState('');
    const [selectedJob, setSelectedJob] = useState('');

    // Dynamic Shift Presets
    const [presets, setPresets] = useState<Record<string, { s: string, e: string }>>({
        'Custom': { s: '09:00', e: '18:00' }
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

                    const newPresets: Record<string, { s: string, e: string }> = { ...presets };
                    shifts.forEach((s: any) => {
                        newPresets[s.name] = { s: s.startTime, e: s.endTime };
                    });
                    setPresets(newPresets);
                }
            } catch (e) {
                console.error("Error fetching shifts:", e);
            }
        };
        fetchShifts();
    }, []);

    useEffect(() => {
        if (isOpen && machine) {
            fetchPlans();
            if (activeTab === 'jobs') {
                fetchResources();
                fetchJobs();
            }
        }
    }, [isOpen, machine, currentDate, activeTab]);

    // --- DATA FETCHING ---

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem("token");
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            // Fetch Plans
            const res = await fetch(`${API_BASE_URL}/api/ppc/machine-plan?machine=${machine._id}&startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const planMap = new Map<string, Shift[]>();
                (data.plans || []).forEach((p: MachinePlan) => {
                    const dateKey = new Date(p.date).toDateString();
                    planMap.set(dateKey, p.shifts || []);
                });
                setMachinePlans(planMap);
            }
        } catch (error) {
            console.error("Error fetching machine plans:", error);
        }
    };

    const fetchJobs = async () => {
        try {
            const token = localStorage.getItem("token");
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            const res = await fetch(
                `${API_BASE_URL}/api/ppc/job?machine=${machine._id}&startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.ok) {
                const data = await res.json();
                const jobMap = new Map<string, JobAssignment[]>();
                (data.jobs || []).forEach((job: any) => {
                    if (job.scheduledStart) {
                        const dateKey = new Date(job.scheduledStart).toDateString();
                        const existing = jobMap.get(dateKey) || [];
                        existing.push({
                            _id: job._id,
                            operator: job.assignedManpower?.[0],
                            job: job,
                            shift: 'Unknown', // Determine based on time if needed
                            scheduledStart: job.scheduledStart
                        });
                        jobMap.set(dateKey, existing);
                    }
                });
                setJobAssignments(jobMap);
            }
        } catch (error) {
            console.error("Error fetching jobs:", error);
        }
    };

    const fetchResources = async () => {
        try {
            // Only fetch if not already loaded? (Simple optimization)
            if (employees.length > 0 && jobs.length > 0) return;

            const token = localStorage.getItem("token");
            const [empRes, jobsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/ppc/manpower`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/ppc/order?status=InProgress`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const empData = await empRes.json();
            const jobsData = await jobsRes.json();

            setEmployees(empData.manpower || []);
            setJobs(jobsData.orders || []);
        } catch (e) {
            console.error("Error fetching resources", e);
        }
    };

    // --- ACTIONS ---

    const handleSaveShift = async () => {
        if (!selectedDate) return;

        setLoading(true);
        try {
            // Get current shifts
            const dateKey = selectedDate.toDateString();
            const currentShifts = machinePlans.get(dateKey) || [];

            // Create new shift object
            const newShift: Shift = {
                name: newShiftName,
                startTime: newStartTime,
                endTime: newEndTime
            };

            // Combine
            const updatedShifts = [...currentShifts, newShift];

            // Setup Payload
            const payload = {
                date: selectedDate.toISOString(),
                machine: machine._id,
                shifts: updatedShifts,
                status: 'Active'
            };

            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/ppc/machine-plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                onSuccess("Shift added successfully");
                fetchPlans(); // Refresh
                // Reset form slightly?
                if (newShiftName === 'First') {
                    setNewShiftName('Second');
                    setNewStartTime('14:00');
                    setNewEndTime('22:00');
                }
            }
        } catch (error) {
            console.error("Error saving shift:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveShift = async (shiftIndex: number) => {
        if (!selectedDate || !confirm("Remove this shift?")) return;

        setLoading(true);
        try {
            const dateKey = selectedDate.toDateString();
            const currentShifts = machinePlans.get(dateKey) || [];
            const updatedShifts = currentShifts.filter((_, idx) => idx !== shiftIndex);

            const payload = {
                date: selectedDate.toISOString(),
                machine: machine._id,
                shifts: updatedShifts,
                status: updatedShifts.length > 0 ? 'Active' : 'Inactive'
            };

            const token = localStorage.getItem("token");
            await fetch(`${API_BASE_URL}/api/ppc/machine-plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            fetchPlans();
        } catch (error) {
            console.error("Error removing shift:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- HELPERS ---

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: Date[] = [];
        const firstDayOfWeek = firstDay.getDay();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) days.push(new Date(year, month, -i));
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    };

    const navigateMonth = (dir: number) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
    const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();
    const isToday = (d: Date) => d.toDateString() === new Date().toDateString();



    const handleShiftNameChange = (name: string) => {
        setNewShiftName(name);
        if (presets[name]) {
            setNewStartTime(presets[name].s);
            setNewEndTime(presets[name].e);
        }
    };

    if (!isOpen) return null;

    const days = getDaysInMonth();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Settings className="text-indigo-600" />
                            Planning: {machine?.machineName}
                        </h3>
                        <p className="text-xs text-gray-500">{machine?.machineCode}</p>
                    </div>
                    {/* Tabs */}
                    <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('shifts')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'shifts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Shift Planning
                        </button>
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'jobs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Job Schedule
                        </button>
                    </div>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600" /></button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Calendar (Left) */}
                    <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center mb-6">
                            <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} /></button>
                            <h4 className="font-bold text-gray-900 dark:text-white">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
                            <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} /></button>
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="text-center text-xs font-semibold text-gray-400 uppercase py-2">{d}</div>
                            ))}
                            {days.map((date, idx) => {
                                const dateKey = date.toDateString();
                                const shifts = machinePlans.get(dateKey) || [];
                                const isSelected = selectedDate?.toDateString() === dateKey;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => isCurrentMonth(date) && setSelectedDate(date)}
                                        className={`min-h-[100px] p-2 border rounded-xl cursor-pointer transition-all flex flex-col gap-1 ${!isCurrentMonth(date) ? 'opacity-30 bg-gray-50' :
                                            isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' :
                                                isToday(date) ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10' :
                                                    'bg-white dark:bg-gray-800 border-gray-100 hover:border-indigo-200'
                                            }`}
                                    >
                                        <span className={`text-sm font-medium ${isToday(date) ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>{date.getDate()}</span>

                                        {/* Content based on Tab */}
                                        {activeTab === 'shifts' && (
                                            <div className="space-y-1 mt-1">
                                                {shifts.map((s, i) => (
                                                    <div key={i} className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-medium truncate">
                                                        {s.name} ({s.startTime})
                                                    </div>
                                                ))}
                                                {shifts.length === 0 && isCurrentMonth(date) && (
                                                    <div className="text-[10px] text-gray-400 italic">No shifts</div>
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'jobs' && (
                                            <div className="space-y-1 mt-1">
                                                <div className="text-[10px] text-gray-400">Select to view jobs</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sidebar (Right) */}
                    <div className="w-96 bg-gray-50 dark:bg-gray-900/50 p-6 overflow-y-auto">
                        {selectedDate ? (
                            <>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <CalendarIcon size={18} className="text-indigo-500" />
                                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </h4>

                                {activeTab === 'shifts' && (
                                    <div className="space-y-6">
                                        {/* Current Shifts List */}
                                        <div>
                                            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Planned Shifts</h5>
                                            <div className="space-y-2">
                                                {(machinePlans.get(selectedDate.toDateString()) || []).map((shift, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">{shift.name}</div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock size={10} /> {shift.startTime} - {shift.endTime}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveShift(idx)}
                                                            className="text-gray-400 hover:text-red-500 p-1"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {!machinePlans.get(selectedDate.toDateString())?.length && (
                                                    <p className="text-sm text-gray-500 italic">No shifts configured for this day.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Add Shift Form */}
                                        <div className="pt-6 border-t border-gray-200">
                                            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Shift</h5>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs font-medium text-gray-700 block mb-1">Shift Name</label>
                                                    <select
                                                        value={newShiftName}
                                                        onChange={(e) => handleShiftNameChange(e.target.value)}
                                                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-indigo-500"
                                                    >
                                                        {availableShifts.map(s => (
                                                            <option key={s._id} value={s.name}>{s.name} ({s.startTime} - {s.endTime})</option>
                                                        ))}
                                                        <option value="Custom">Custom</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-700 block mb-1">Start</label>
                                                        <input
                                                            type="time"
                                                            value={newStartTime}
                                                            onChange={e => setNewStartTime(e.target.value)}
                                                            className="w-full text-sm border-gray-200 rounded-lg"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-700 block mb-1">End</label>
                                                        <input
                                                            type="time"
                                                            value={newEndTime}
                                                            onChange={e => setNewEndTime(e.target.value)}
                                                            className="w-full text-sm border-gray-200 rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleSaveShift}
                                                    disabled={loading}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
                                                >
                                                    {loading ? 'Saving...' : <><Plus size={16} /> Add Shift</>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'jobs' && (
                                    <div className="text-center py-10 text-gray-500">
                                        <Briefcase className="mx-auto mb-2 opacity-50" size={32} />
                                        <p>Job Scheduling is currently only available via the old workflow or pending implementation for the new shift system.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-full flex flex-col justify-center items-center text-gray-400 text-center">
                                <CalendarIcon size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">Select a date from the calendar<br />to manage {activeTab === 'shifts' ? 'shifts' : 'jobs'}.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
