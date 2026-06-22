"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { BarChart3, PieChart, Users, AlertCircle } from "lucide-react";

export default function ProductionReports() {
    const [stats, setStats] = useState<any>({ statusStats: [], outsourcedJobs: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/ppc/reports/production`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setStats(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching reports");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Loading Reports...</div>;

    // Helper to get count by status
    const getCount = (status: string) => {
        const found = stats.statusStats.find((s: any) => s._id === status);
        return found ? found.count : 0;
    };

    return (
        <div className="space-y-6">
            {/* Status Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <PieChart size={20} />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-800">{getCount('Scheduled')}</div>
                    <div className="text-xs md:text-sm text-gray-500">Scheduled</div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <BarChart3 size={20} />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-800">{getCount('InProgress')}</div>
                    <div className="text-xs md:text-sm text-gray-500">In Progress</div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <AlertCircle size={20} />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-800">{getCount('QC_Pending')}</div>
                    <div className="text-xs md:text-sm text-gray-500">Waiting QC</div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-800">{stats.outsourcedJobs.length}</div>
                    <div className="text-xs md:text-sm text-gray-500">With Vendors</div>
                </div>
            </div>

        </div>
    );
}
