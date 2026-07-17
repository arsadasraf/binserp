import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, UserCheck, UserX, BarChart3, PieChart } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { API_BASE_URL } from '@/src/utils/config';
import HRStatsModal from './modals/HRStatsModal';
import { Employee } from '../types/hr.types';

const backendUrl = API_BASE_URL;

interface DashboardStats {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    departmentWise: { name: string; total: number; present: number; absent: number }[];
    designationWise: { name: string; total: number; present: number; absent: number }[];
}

export default function HRHomeTab() {
    const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalData, setModalData] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        fetchStats();
    }, [selectedDate]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${backendUrl}/api/hr/stats`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { date: selectedDate }
            });
            setStats(res.data);
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to fetch data and prepare modal
    const fetchDataAndOpenModal = async (
        filterFn: (emp: Employee, record: any) => boolean,
        title: string
    ) => {
        setModalOpen(true);
        setModalLoading(true);
        setModalData([]);

        try {
            const token = localStorage.getItem('token');

            // 1. Fetch All Employees
            const empRes = await axios.get(`${backendUrl}/api/hr/employee`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { status: 'Active' }
            });
            const allEmployees: Employee[] = empRes.data.employees;

            // 2. Fetch Attendance for Selected Date
            const dateObj = new Date(selectedDate);
            const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0, 0).toISOString();
            const end = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999).toISOString();

            const attRes = await axios.get(`${backendUrl}/api/hr/attendance`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate: start, endDate: end }
            });
            const attendanceRecords: any[] = attRes.data.attendance;

            // 3. Map Attendance
            const attendanceMap = new Map();
            attendanceRecords.forEach(record => {
                const empId = typeof record.employee === 'object' ? record.employee._id : record.employee;
                attendanceMap.set(empId, record);
            });

            // 4. Process Data
            let processedData: any[] = [];

            allEmployees.forEach(emp => {
                const record = attendanceMap.get(emp._id);
                // Basic status check
                const hasRecord = !!record;

                if (filterFn(emp, record)) {
                    processedData.push({
                        id: emp._id,
                        name: emp.name,
                        empId: emp.employeeId,
                        department: emp.department,
                        designation: emp.designation,
                        photo: emp.photo,
                        status: hasRecord ? record.status : 'Absent',
                        checkIn: record?.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
                        checkOut: record?.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
                    });
                }
            });

            setModalData(processedData);
            setModalTitle(`${title} (${processedData.length})`);

        } catch (error) {
            console.error("Error fetching details:", error);
        } finally {
            setModalLoading(false);
        }
    };

    const handleCardClick = (type: 'total' | 'present' | 'absent') => {
        let title = "";
        let filterFn: (emp: Employee, record: any) => boolean = () => true;

        if (type === 'total') {
            title = "Total Employees";
            filterFn = () => true;
        } else if (type === 'present') {
            title = "Present Employees";
            filterFn = (_, record) => !!record && (record.status === 'Present' || record.status === 'Late' || record.status === 'HalfDay');
        } else if (type === 'absent') {
            title = "Absent Employees";
            filterFn = (_, record) => !record;
        }

        fetchDataAndOpenModal(filterFn, title);
    };

    const handleListClick = (category: 'department' | 'designation', name: string) => {
        const title = `${name} (${category === 'department' ? 'Department' : 'Designation'})`;
        const filterFn: (emp: Employee, record: any) => boolean = (emp) => {
            if (category === 'department') return emp.department === name;
            if (category === 'designation') return emp.designation === name;
            return false;
        };
        fetchDataAndOpenModal(filterFn, title);
    };


    if (!stats && loading) return <div className="flex justify-center p-10"><LoadingSpinner /></div>;
    if (!stats) return <div className="dark:text-gray-400 p-10 text-center text-gray-500">Failed to load stats.</div>;

    const StatCard = ({ title, value, sub, icon: Icon, color, onClick }: any) => (
        <div
            onClick={onClick}
            className="active:scale-[0.98] bg-white border border-gray-100 cursor-pointer dark:bg-slate-800 dark:border-slate-700 flex group hover:border-indigo-100 hover:shadow-md items-start justify-between p-6 rounded-xl shadow-sm transition-all"
        >
            <div>
                <p className="dark:text-gray-400 font-medium group-hover:text-gray-700 mb-1 text-gray-500 text-sm transition-colors">{title}</p>
                <h3 className="dark:text-white font-bold group-hover:text-indigo-600 text-3xl text-gray-900 transition-colors">{value}</h3>
                {sub && <p className={`text-xs mt-2 font-medium ${sub.includes('Absent') ? 'text-red-500' : 'text-green-600'}`}>{sub}</p>}
            </div>
            <div className={`p-3 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
    );

    // Clickable Bar Chart Component
    const BarChart = ({ data, title, onItemClick }: { data: any[], title: string, onItemClick: (name: string) => void }) => (
        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col h-full p-6 rounded-xl shadow-sm">
            <h4 className="dark:text-gray-100 flex font-bold gap-2 items-center mb-6 text-gray-800">
                <BarChart3 size={18} /> {title}
            </h4>
            <div className="custom-scrollbar flex-1 overflow-y-auto pr-2 space-y-4">
                {data.map((item, idx) => (
                    <div
                        key={idx}
                        className="cursor-pointer dark:hover:bg-slate-700 group hover:bg-gray-50 p-2 rounded-lg space-y-1 transition-colors"
                        onClick={() => onItemClick(item.name)}
                    >
                        <div className="flex group-hover:text-blue-600 justify-between text-sm">
                            <span className="dark:text-gray-200 font-semibold group-hover:text-blue-600 text-gray-700">{item.name || 'Unknown'}</span>
                            <span className="dark:text-gray-400 text-gray-500 text-xs">{item.present}/{item.total} Present</span>
                        </div>
                        <div className="bg-gray-100 dark:bg-slate-700 flex h-3 overflow-hidden rounded-full w-full">
                            <div
                                className="bg-blue-500 duration-500 group-hover:bg-blue-600 h-full rounded-l-full transition-all"
                                style={{ width: `${(item.total > 0 ? (item.present / item.total) * 100 : 0)}%` }}
                                title={`Present: ${item.present}`}
                            ></div>
                            <div
                                className="bg-red-200 duration-500 group-hover:bg-red-300 h-full rounded-r-full transition-all"
                                style={{ width: `${(item.total > 0 ? (item.absent / item.total) * 100 : 0)}%` }}
                                title={`Absent: ${item.absent}`}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // Clickable Detail Table
    const DetailTable = ({ data, title, onItemClick }: { data: any[], title: string, onItemClick: (name: string) => void }) => (
        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col h-full p-6 rounded-xl shadow-sm">
            <h4 className="dark:text-gray-100 flex font-bold gap-2 items-center mb-4 text-gray-800">
                <PieChart size={18} /> {title} Breakdown
            </h4>
            <div className="custom-scrollbar overflow-x-auto">
                <table className="text-left text-sm w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 dark:text-gray-400 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">Name</th>
                            <th className="px-4 py-3 text-center">Total</th>
                            <th className="px-4 py-3 text-center text-green-600">Present</th>
                            <th className="px-4 py-3 rounded-r-lg text-center text-red-500">Absent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-gray-100 divide-y">
                        {data.map((item, idx) => (
                            <tr
                                key={idx}
                                className="cursor-pointer group hover:bg-blue-50/50 transition-colors"
                                onClick={() => onItemClick(item.name)}
                            >
                                <td className="dark:text-white font-medium group-hover:text-blue-600 px-4 py-3 text-gray-900">{item.name || 'Unknown'}</td>
                                <td className="dark:text-gray-300 font-bold px-4 py-3 text-center text-gray-600">{item.total}</td>
                                <td className="font-bold px-4 py-3 text-center text-green-600">{item.present}</td>
                                <td className="font-bold px-4 py-3 text-center text-red-500">{item.absent}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const attendanceRate = stats.totalEmployees > 0
        ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
        : 0;

    return (
        <div className="animate-in duration-500 fade-in slide-in-from-bottom-4 space-y-6">
            {/* Header with Date Picker */}
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-between p-4 rounded-xl shadow-sm">
                <div>
                    <h2 className="dark:text-gray-100 font-bold text-gray-800 text-lg">Attendance Overview</h2>
                    <p className="dark:text-gray-400 text-gray-500 text-xs">Showing data for {new Date(selectedDate).toDateString()}</p>
                </div>
                <div className="flex gap-2 items-center">
                    <label className="dark:text-gray-200 font-semibold text-gray-700 text-sm">Select Date:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg text-sm"
                    />
                </div>
            </div>

            {/* Top Cards */}
            <div className="gap-6 grid grid-cols-1 md:grid-cols-3">
                <StatCard
                    title="Total Employees"
                    value={stats.totalEmployees}
                    icon={Users}
                    color="bg-blue-500"
                    sub="Active Workforce"
                    onClick={() => handleCardClick('total')}
                />
                <StatCard
                    title="Present"
                    value={stats.presentToday}
                    icon={UserCheck}
                    color="bg-green-500"
                    sub={`${attendanceRate}% Attendance Rate`}
                    onClick={() => handleCardClick('present')}
                />
                <StatCard
                    title="Absent"
                    value={stats.absentToday}
                    icon={UserX}
                    color="bg-red-500"
                    sub={`${100 - attendanceRate}% Absenteeism`}
                    onClick={() => handleCardClick('absent')}
                />
            </div>

            {loading && (
                <div className="absolute bg-white/50 flex inset-0 items-center justify-center z-10">
                    <LoadingSpinner />
                </div>
            )}

            {/* Charts Section */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 h-96 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
                <BarChart
                    title="Department-wise Attendance"
                    data={stats.departmentWise}
                    onItemClick={(name) => handleListClick('department', name)}
                />
                <DetailTable
                    title="Designation-wise"
                    data={stats.designationWise}
                    onItemClick={(name) => handleListClick('designation', name)}
                />
            </div>


            {/* Details Modal */}
            <HRStatsModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalTitle}
                data={modalData}
                loading={modalLoading}
            />
        </div>
    );
}
