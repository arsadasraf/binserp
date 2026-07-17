"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Search, Edit2, X, Calendar as CalendarIcon } from "lucide-react";
import axios from "axios";
import { Holiday } from "../../types/hr.types";
import { API_BASE_URL } from "@/src/utils/config";

export default function HolidayMaster() {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Year filter (default to current year)
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        date: "",
        type: "Public",
        isActive: true
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchHolidays();
    }, [selectedYear]);

    const fetchHolidays = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/holiday?year=${selectedYear}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setHolidays(response.data);
        } catch (error) {
            console.error("Error fetching holidays:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setFormData({ name: "", date: "", type: "Public", isActive: true });
        setIsEditing(false);
        setCurrentId(null);
        setShowModal(true);
    };

    const handleOpenEdit = (holiday: Holiday) => {
        setFormData({ 
            name: holiday.name, 
            date: new Date(holiday.date).toISOString().split('T')[0], 
            type: holiday.type || "Public",
            isActive: holiday.isActive !== false
        });
        setIsEditing(true);
        setCurrentId(holiday._id);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.date) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };
            const url = `${API_BASE_URL}/api/hr/holiday`;

            if (isEditing && currentId) {
                // Update
                await axios.put(`${url}/${currentId}`, formData, { headers });
            } else {
                // Create
                await axios.post(url, formData, { headers });
            }

            setShowModal(false);
            fetchHolidays();
        } catch (error) {
            console.error("Error saving holiday:", error);
            alert("Failed to save holiday. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this holiday?")) return;

        try {
            const token = localStorage.getItem("token");
            await axios.delete(
                `${API_BASE_URL}/api/hr/holiday/${id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            fetchHolidays();
        } catch (error) {
            console.error("Error deleting holiday:", error);
        }
    };

    const filteredHolidays = holidays.filter((hol) =>
        hol.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 items-center justify-between md:flex-row md:gap-4 p-4 rounded-xl shadow-sm">
                
                {/* Controls (Year & Search) */}
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                    >
                        {[...Array(5)].map((_, i) => {
                            const y = currentYear - 2 + i;
                            return <option key={y} value={y}>{y}</option>;
                        })}
                    </select>

                    <div className="flex-1 md:flex-none md:w-64 relative">
                        <Search
                            className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search holidays..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border border-gray-200 dark:border-slate-600 focus:border-transparent focus:ring-2 focus:ring-blue-500 pl-10 pr-4 py-2 rounded-lg text-sm w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>

                <button
                    onClick={handleOpenAdd}
                    className="bg-blue-600 flex gap-2 hover:bg-blue-700 items-center justify-center md:px-4 flex-none px-3 md:px-4 py-2 rounded-lg text-white transition-colors w-full md:w-auto"
                >
                    <Plus size={18} />
                    <span>Add Holiday</span>
                </button>
            </div>

            <div className="bg-gray-50/50 min-h-[200px]">
                {loading ? (
                    <div className="dark:text-gray-400 p-6 text-center text-gray-500">
                        Loading...
                    </div>
                ) : filteredHolidays.length === 0 ? (
                    <div className="dark:text-gray-500 flex flex-col gap-2 items-center p-12 text-center text-gray-400">
                        <CalendarIcon size={32} className="opacity-20" />
                        <p>No holidays found for {selectedYear}</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 hidden md:block overflow-hidden rounded-xl shadow-sm">
                            <table className="text-left w-full">
                                <thead className="bg-gray-50 border-b border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
                                    <tr>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Date</th>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Day</th>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Holiday Name</th>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Type</th>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-gray-100 divide-y dark:divide-slate-700">
                                    {filteredHolidays.map((hol) => {
                                        const d = new Date(hol.date);
                                        return (
                                            <tr
                                                key={hol._id}
                                                className="dark:hover:bg-slate-700 hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="dark:text-gray-100 font-medium px-6 py-4 text-gray-800">
                                                    {d.toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="dark:text-gray-300 px-6 py-4 text-gray-600">
                                                    {d.toLocaleDateString('en-US', { weekday: 'long' })}
                                                </td>
                                                <td className="dark:text-gray-100 font-medium px-6 py-4 text-gray-800">
                                                    {hol.name}
                                                </td>
                                                <td className="dark:text-gray-300 px-6 py-4 text-gray-600">
                                                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                                        hol.type === 'Public' ? 'bg-green-100 text-green-700' :
                                                        hol.type === 'Company' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {hol.type}
                                                    </span>
                                                </td>
                                                <td className="flex gap-2 justify-end px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleOpenEdit(hol)}
                                                        className="hover:bg-blue-50 p-2 rounded-lg text-blue-500 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(hol._id)}
                                                        className="hover:bg-red-50 p-2 rounded-lg text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {filteredHolidays.map((hol) => {
                                const d = new Date(hol.date);
                                return (
                                    <div key={hol._id} className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 p-4 rounded-xl shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="dark:text-white font-bold text-gray-900">{hol.name}</h4>
                                                <p className="dark:text-gray-400 mt-0.5 text-gray-500 text-sm">
                                                    {d.toLocaleDateString('en-GB')} ({d.toLocaleDateString('en-US', { weekday: 'long' })})
                                                </p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                                hol.type === 'Public' ? 'bg-green-100 text-green-700' :
                                                hol.type === 'Company' ? 'bg-blue-100 text-blue-700' :
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                                {hol.type}
                                            </span>
                                        </div>

                                        <div className="border-gray-50 border-t dark:border-slate-800/50 flex gap-2 items-center mt-1 pt-3">
                                            <button
                                                onClick={() => handleOpenEdit(hol)}
                                                className="bg-blue-50 flex flex-1 font-medium gap-2 hover:bg-blue-100 items-center justify-center py-2 rounded-lg text-blue-600 text-sm transition-colors"
                                            >
                                                <Edit2 size={16} /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(hol._id)}
                                                className="bg-red-50 flex flex-1 font-medium gap-2 hover:bg-red-100 items-center justify-center py-2 rounded-lg text-red-600 text-sm transition-colors"
                                            >
                                                <Trash2 size={16} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="backdrop-blur-sm bg-black/50 fixed flex inset-0 items-center justify-center z-50">
                    <div className="animate-in bg-white dark:bg-slate-800 duration-200 fade-in max-w-md mx-4 p-6 rounded-xl shadow-xl w-full zoom-in-95">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="dark:text-white font-bold text-gray-900 text-lg">
                                {isEditing ? "Edit Holiday" : "Add New Holiday"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="dark:text-gray-500 hover:text-gray-600 text-gray-400">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">
                                    Holiday Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 px-4 py-2 rounded-lg w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                                    placeholder="e.g. Diwali"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 px-4 py-2 rounded-lg w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">
                                    Type
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 px-4 py-2 rounded-lg w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 outline-none"
                                >
                                    <option value="Public">Public Holiday</option>
                                    <option value="Optional">Optional Holiday</option>
                                    <option value="Company">Company Holiday</option>
                                </select>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200 font-medium hover:bg-gray-200 px-4 py-2 rounded-lg text-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-600 disabled:opacity-50 font-medium hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition-colors"
                                >
                                    {submitting ? "Saving..." : "Save Holiday"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
