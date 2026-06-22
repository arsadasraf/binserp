"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Calendar, CheckCircle, Clock } from "lucide-react";

export default function ActivitiesLog() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActivities();
    }, []);

    const fetchActivities = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/crm/activities`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setActivities(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching activities");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading Activities...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-6 text-lg">Recent Activities</h3>
            <div className="space-y-6">
                {activities.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No activities logged yet.</p>
                ) : (
                    activities.map((act: any, idx) => (
                        <div key={idx} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Clock size={16} />
                                </div>
                                {idx !== activities.length - 1 && <div className="w-0.5 bg-gray-100 flex-1 my-1"></div>}
                            </div>
                            <div className="pb-6">
                                <p className="font-medium text-gray-900">{act.summary}</p>
                                <p className="text-sm text-gray-500">{act.description}</p>
                                <p className="text-xs text-gray-400 mt-1">{new Date(act.date).toLocaleString()} by {act.createdBy?.name || 'Unknown'}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
