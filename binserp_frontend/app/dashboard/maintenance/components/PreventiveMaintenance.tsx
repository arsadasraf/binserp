"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Calendar as CalendarIcon, CheckCircle, Clock } from "lucide-react";

interface Schedule {
    _id: string;
    machine: { machineName: string; machineCode: string };
    title: string;
    frequency: string;
    nextDueDate: string;
    status: string;
}

export default function PreventiveMaintenance() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCalendar();
    }, []);

    const fetchCalendar = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_BASE_URL}/api/maintenance/preventive/calendar`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setSchedules(response.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (id: string) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/maintenance/preventive/complete`, {
                scheduleId: id,
                remarks: "Completed via Dashboard"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCalendar(); // Refresh
        } catch (error) {
            alert("Failed to mark complete");
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Upcoming Maintenance Schedules</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {schedules.map((schedule) => (
                    <div key={schedule._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                        {schedule.frequency}
                                    </span>
                                    <h3 className="text-lg font-bold text-gray-900 mt-2">{schedule.machine?.machineName}</h3>
                                    <p className="text-sm text-gray-500">{schedule.machine?.machineCode}</p>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-full text-gray-400">
                                    <CalendarIcon className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700">{schedule.title}</p>
                                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    <span>Due: {new Date(schedule.nextDueDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleComplete(schedule._id)}
                            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Mark Completed
                        </button>
                    </div>
                ))}

                {schedules.length === 0 && !loading && (
                    <div className="col-span-full text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                        No upcoming schedules found.
                    </div>
                )}
            </div>
        </div>
    );
}
