"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Briefcase, FileText, Clock } from "lucide-react";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";

interface EmployeeData {
    employee: {
        name: string;
        designation: string;
        department: string;
        joiningDate: string;
        photo?: string;
    };
    attendance: any[];
    assignedJobs: any[];
    employeeJobs?: any[];
    salarySlips: any[];
    roster?: any[];
}

export default function EmployeeDashboard() {
    const [data, setData] = useState<EmployeeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();

    // Derive active tab from URL or default to 'work'
    const activeTab = (searchParams.get("tab") as "work" | "attendance" | "roster") || "work";

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                router.push("/login");
                return;
            }

            const response = await axios.get(`${API_BASE_URL}/api/hr/dashboard/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const dashboardData = response.data;

            // Fetch Roster Data
            const empId = dashboardData.employee?._id || dashboardData._id; // Adjust based on actual API response structure
            if (empId) {
                const today = new Date();
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

                try {
                    const rosterRes = await axios.get(`${API_BASE_URL}/api/ppc/allotment`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            employee: empId,
                            startDate: startOfMonth.toISOString(),
                            endDate: endOfMonth.toISOString()
                        }
                    });
                    dashboardData.roster = rosterRes.data.allotments || [];
                } catch (rosterErr) {
                    console.error("Failed to fetch roster", rosterErr);
                }
            }

            setData(dashboardData);
        } catch (err: any) {
            console.error("Dashboard Error:", err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                localStorage.removeItem("token");
                router.push("/login");
            }
            setError("Failed to load dashboard data. " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };



    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Header */}


            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && <div className="mb-6"><ErrorAlert message={error} onClose={() => setError("")} /></div>}

                {/* Navigation Tabs - Hidden on Mobile (handled by bottom nav), Visible on Desktop */}
                <div className="hidden sm:flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full sm:w-fit mb-8">
                    <button
                        onClick={() => router.push("/dashboard/employee?tab=work")}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${activeTab === "work"
                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                    >
                        <Briefcase className="h-4 w-4" />
                        <span>Job</span>
                    </button>
                    <button
                        onClick={() => router.push("/dashboard/employee?tab=roster")}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${activeTab === "roster"
                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                    >
                        <Clock className="h-4 w-4" />
                        <span>My Roster</span>
                    </button>
                    <button
                        onClick={() => router.push("/dashboard/employee?tab=attendance")}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${activeTab === "attendance"
                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                    >
                        <Calendar className="h-4 w-4" />
                        <span>Attendance</span>
                    </button>
                </div>

                {/* Content Area */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === "work" && (
                        <div className="space-y-6">
                            {/* NEW: Employee Jobs Section */}
                            {data.employeeJobs && data.employeeJobs.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">My Tasks</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {data.employeeJobs.map((job: any) => (
                                            <div key={job._id} className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                <div className={`absolute top-0 left-0 w-1 h-full ${job.priority === 'Urgent' ? 'bg-red-500' :
                                                    job.priority === 'High' ? 'bg-orange-500' :
                                                        job.priority === 'Medium' ? 'bg-blue-500' : 'bg-gray-400'
                                                    }`}></div>

                                                <div className="flex justify-between items-start mb-3 pl-2">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                        job.status === 'InProgress' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {job.status}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : 'No Date'}
                                                    </span>
                                                </div>

                                                <h3 className="text-lg font-bold text-gray-900 mb-1 pl-2">{job.title}</h3>
                                                {job.description && <p className="text-sm text-gray-600 mb-4 pl-2 line-clamp-2">{job.description}</p>}

                                                {job.status !== 'Completed' && (
                                                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
                                                        <button
                                                            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                                            onClick={async () => {
                                                                if (!confirm('Mark this job as completed?')) return;
                                                                try {
                                                                    const token = localStorage.getItem("token");
                                                                    await axios.put(`${API_BASE_URL}/api/hr/job/${job._id}/status`,
                                                                        { status: 'Completed' },
                                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                                    );
                                                                    fetchDashboardData();
                                                                } catch (err) {
                                                                    alert('Failed to update status');
                                                                }
                                                            }}
                                                        >
                                                            Mark Complete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* OLD: PPC Jobs Section (if any) */}
                            {data.assignedJobs && data.assignedJobs.length > 0 && !data.employeeJobs?.length && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {data.assignedJobs.map((job: any) => (
                                        <div key={job._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                        job.status === 'InProgress' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {job.status}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500 font-mono">{job.jobNumber}</span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.partName}</h3>
                                            <p className="text-sm text-gray-500 mb-4">{job.customerName}</p>

                                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                                {job.myTasks && job.myTasks.length > 0 ? (
                                                    job.myTasks.map((task: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm">
                                                            <span className="text-gray-700">{task.operationName}</span>
                                                            <span className="text-xs font-medium px-2 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-200">{task.status}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-sm text-gray-400 italic">No specific tasks assigned personally, but linked to job.</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Global Empty State */}
                            {(!data.assignedJobs?.length && !data.employeeJobs?.length) && (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                    <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                    <h3 className="text-lg font-medium text-gray-900">No Pending Work</h3>
                                    <p className="text-gray-500">You don't have any pending jobs assigned right now.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "roster" && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">My Shift Roster (This Month)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {data.roster && data.roster.length > 0 ? (
                                    data.roster.map((slot: any) => (
                                        <div key={slot._id} className={`p-4 rounded-xl border ${new Date(slot.date).toDateString() === new Date().toDateString()
                                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300'
                                                : 'bg-white border-gray-200'
                                            }`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </span>
                                                {new Date(slot.date).toDateString() === new Date().toDateString() && (
                                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">TODAY</span>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <Clock size={14} className="text-gray-400" />
                                                    <span className="font-medium">{slot.shift}</span>
                                                    {slot.shift === 'Custom' && slot.startTime && (
                                                        <span className="text-xs text-gray-500">({slot.startTime} - {slot.endTime})</span>
                                                    )}
                                                </div>
                                                <div className="flex items-start gap-2 text-sm text-gray-700">
                                                    <Briefcase size={14} className="text-gray-400 mt-0.5" />
                                                    <div className="flex-1">
                                                        {slot.machines && slot.machines.length > 0 ? (
                                                            <div className="flex flex-col gap-1">
                                                                {slot.machines.map((m: any) => (
                                                                    <span key={m._id} className="inline-block">
                                                                        {m.machineName} ({m.machineCode})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">No Machines</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {slot.remarks && (
                                                    <div className="text-xs text-gray-500 italic mt-1 pl-6">
                                                        "{slot.remarks}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                                        <Calendar className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500">No shift roster found for this month.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "attendance" && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.attendance.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No attendance records found for recent period.</td>
                                            </tr>
                                        ) : (
                                            data.attendance.map((record: any) => (
                                                <tr key={record._id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {new Date(record.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'Present' ? 'bg-green-100 text-green-800' :
                                                            record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {record.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {record.hoursWorked || '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}


                </motion.div>
            </main>
        </div>
    );
}
