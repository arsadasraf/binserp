
import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from "@/src/utils/config";
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface MachinePlanningTimelineProps {
    refreshKey: number;
    onAssign: (machineId: string, start: Date, end: Date) => void;
    selectedJobDuration: number; // in minutes
}

export default function MachinePlanningTimeline({ refreshKey, onAssign, selectedJobDuration }: MachinePlanningTimelineProps) {
    const [date, setDate] = useState(new Date());
    const [machines, setMachines] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Timeline Configuration
    const START_HOUR = 6; // 6 AM
    const END_HOUR = 22;  // 10 PM
    const TOTAL_HOURS = END_HOUR - START_HOUR;
    const PIXELS_PER_HOUR = 100;

    useEffect(() => {
        fetchData();
    }, [date, refreshKey]);

    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem("token");
        const startStr = date.toISOString().split('T')[0];
        const endStr = new Date(date.getTime() + 86400000).toISOString().split('T')[0]; // Next day for boundary

        try {
            // 1. Fetch Machines
            const mRes = await fetch(`${API_BASE_URL}/api/ppc/machine`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const mData = await mRes.json();
            setMachines(mData.machines || []);

            // 2. Fetch Schedule
            const sRes = await fetch(`${API_BASE_URL}/api/ppc/planning/machine-schedule?start=${startStr}&end=${endStr}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const sData = await sRes.json();
            setAssignments(sData.assignments || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleTimeSlotClick = (machineId: string, hourOffset: number) => {
        if (selectedJobDuration === 0) return;

        // Calculate clicked time
        const clickedTime = new Date(date);
        clickedTime.setHours(START_HOUR, 0, 0, 0); // Reset to base 6 AM
        clickedTime.setMinutes(hourOffset * 60); // Add minutes offset based on click position

        const endTime = new Date(clickedTime.getTime() + selectedJobDuration * 60000);

        if (confirm(`Assign Job starting at ${clickedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}?`)) {
            onAssign(machineId, clickedTime, endTime);
        }
    };

    const changeDate = (days: number) => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + days);
        setDate(newDate);
    };

    if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-500" /></div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 px-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <button onClick={() => changeDate(-1)} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft size={16} /></button>
                    <span className="font-bold text-gray-700 dark:text-gray-200 w-32 text-center">{date.toLocaleDateString()}</span>
                    <button onClick={() => changeDate(1)} className="p-1 hover:bg-gray-200 rounded"><ChevronRight size={16} /></button>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-100 rounded border border-blue-200"></span> Scheduled</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded border border-green-200"></span> Completed</div>
                </div>
            </div>

            {/* Timeline Header (Hours) */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 ml-40 overflow-hidden" ref={scrollContainerRef}>
                {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 border-r border-gray-100 dark:border-gray-800 text-xs text-gray-400 font-medium flex items-end justify-center pb-1" style={{ width: PIXELS_PER_HOUR }}>
                        {START_HOUR + i}:00
                    </div>
                ))}
            </div>

            {/* Timeline Body (Machines) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {machines.map(machine => (
                    <div key={machine._id} className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/30 transition-colors h-16 group">
                        {/* Machine Header */}
                        <div className="w-40 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900 z-10 sticky left-0 flex flex-col justify-center">
                            <p className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{machine.machineName}</p>
                            <p className="text-xs text-gray-400 font-mono">{machine.machineCode}</p>
                        </div>

                        {/* Machine Row (Time Slots) */}
                        <div
                            className="relative flex h-full cursor-crosshair"
                            style={{ width: TOTAL_HOURS * PIXELS_PER_HOUR }}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const hourOffset = (x / PIXELS_PER_HOUR) * 60; // Minutes from start
                                handleTimeSlotClick(machine._id, hourOffset / 60);
                            }}
                        >
                            {/* Grid Lines */}
                            {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                                <div key={i} className="absolute top-0 bottom-0 border-r border-gray-50 dark:border-gray-800 pointer-events-none" style={{ left: i * PIXELS_PER_HOUR, width: PIXELS_PER_HOUR }}></div>
                            ))}

                            {/* Assignments */}
                            {assignments
                                .filter(a => a.machineId === machine._id)
                                .map(assignment => {
                                    const start = new Date(assignment.start);
                                    const end = new Date(assignment.end);

                                    // Calculate Position relative to START_HOUR
                                    const startHour = start.getHours() + (start.getMinutes() / 60);
                                    const endHour = end.getHours() + (end.getMinutes() / 60);

                                    const left = (startHour - START_HOUR) * PIXELS_PER_HOUR;
                                    const width = (endHour - startHour) * PIXELS_PER_HOUR;

                                    if (left + width < 0) return null; // Before view

                                    return (
                                        <div
                                            key={assignment._id}
                                            className={`absolute top-2 bottom-2 rounded-lg border flex items-center px-2 text-xs font-medium truncate shadow-sm transition-transform hover:scale-105 z-20 cursor-pointer ${assignment.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' :
                                                    'bg-blue-100 text-blue-700 border-blue-200'
                                                }`}
                                            style={{ left: Math.max(0, left), width: Math.max(20, width) }} // Min width for visibility
                                            title={`${assignment.jobNumber} - ${new Date(assignment.start).toLocaleTimeString()}`}
                                        >
                                            {assignment.partName}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
