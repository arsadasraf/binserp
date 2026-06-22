"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Search, Edit2, X } from "lucide-react";
import axios from "axios";
import { Department } from "../../types/hr.types";
import { API_BASE_URL } from "@/src/utils/config";

export default function DepartmentMaster() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: ""
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/department`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setDepartments(response.data);
        } catch (error) {
            console.error("Error fetching departments:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setFormData({ name: "", description: "" });
        setIsEditing(false);
        setCurrentId(null);
        setShowModal(true);
    };

    const handleOpenEdit = (dept: Department) => {
        setFormData({ name: dept.name, description: dept.description || "" });
        setIsEditing(true);
        setCurrentId(dept._id);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };
            const url = `${API_BASE_URL}/api/hr/department`;

            if (isEditing && currentId) {
                // Update
                await axios.put(`${url}/${currentId}`, formData, { headers });
            } else {
                // Create
                await axios.post(url, formData, { headers });
            }

            setShowModal(false);
            fetchDepartments();
        } catch (error) {
            console.error("Error saving department:", error);
            alert("Failed to save department. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this department?")) return;

        try {
            const token = localStorage.getItem("token");
            await axios.delete(
                `${API_BASE_URL}/api/hr/department/${id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            fetchDepartments();
        } catch (error) {
            console.error("Error deleting department:", error);
        }
    };

    const filteredDepartments = departments.filter((dept) =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 items-center justify-between md:flex-row md:gap-4 p-4 rounded-xl shadow-sm">
                <div className="flex-1 md:flex-none md:w-64 relative">
                    <Search
                        className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border focus:border-transparent focus:ring-2 focus:ring-blue-500 pl-10 pr-4 py-2 rounded-lg text-sm w-full"
                    />
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-blue-600 flex gap-2 hover:bg-blue-700 items-center justify-center md:px-4 flex-none px-3 md:px-4 py-2 rounded-lg text-white transition-colors"
                >
                    <Plus size={18} />
                    <span className="hidden md:inline">Add Department</span>
                </button>
            </div>

            <div className="bg-gray-50/50 min-h-[200px]">
                {loading ? (
                    <div className="dark:text-gray-400 p-6 text-center text-gray-500">
                        Loading...
                    </div>
                ) : filteredDepartments.length === 0 ? (
                    <div className="dark:text-gray-500 flex flex-col gap-2 items-center p-12 text-center text-gray-400">
                        <Search size={32} className="opacity-20" />
                        <p>No departments found</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 hidden md:block overflow-hidden rounded-xl shadow-sm">
                            <table className="text-left w-full">
                                <thead className="bg-gray-50 border-b border-gray-100 dark:bg-slate-800/50 dark:border-slate-700">
                                    <tr>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Name</th>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700">Description</th>
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-gray-100 divide-y">
                                    {filteredDepartments.map((dept) => (
                                        <tr
                                            key={dept._id}
                                            className="dark:hover:bg-slate-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="dark:text-gray-100 font-medium px-6 py-4 text-gray-800">
                                                {dept.name}
                                            </td>
                                            <td className="dark:text-gray-300 px-6 py-4 text-gray-600">{dept.description || "-"}</td>
                                            <td className="flex gap-2 justify-end px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleOpenEdit(dept)}
                                                    className="hover:bg-blue-50 p-2 rounded-lg text-blue-500 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(dept._id)}
                                                    className="hover:bg-red-50 p-2 rounded-lg text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {filteredDepartments.map((dept) => (
                                <div key={dept._id} className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 p-4 rounded-xl shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="dark:text-white font-bold text-gray-900">{dept.name}</h4>
                                            {dept.description && (
                                                <p className="dark:text-gray-400 mt-0.5 text-gray-500 text-sm">{dept.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border-gray-50 border-t dark:border-slate-800/50 flex gap-2 items-center mt-1 pt-3">
                                        <button
                                            onClick={() => handleOpenEdit(dept)}
                                            className="bg-blue-50 flex flex-1 font-medium gap-2 hover:bg-blue-100 items-center justify-center py-2 rounded-lg text-blue-600 text-sm transition-colors"
                                        >
                                            <Edit2 size={16} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(dept._id)}
                                            className="bg-red-50 flex flex-1 font-medium gap-2 hover:bg-red-100 items-center justify-center py-2 rounded-lg text-red-600 text-sm transition-colors"
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                                {isEditing ? "Edit Department" : "Add New Department"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="dark:text-gray-500 hover:text-gray-600 text-gray-400">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="border focus:ring-2 focus:ring-blue-500 px-4 py-2 rounded-lg w-full"
                                    placeholder="e.g. Engineering"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="border focus:ring-2 focus:ring-blue-500 min-h-[80px] px-4 py-2 rounded-lg w-full"
                                    placeholder="Optional description..."
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="dark:hover:bg-slate-700 dark:text-gray-200 font-medium hover:bg-gray-100 px-4 py-2 rounded-lg text-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-600 disabled:opacity-50 font-medium hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
                                >
                                    {submitting ? "Saving..." : isEditing ? "Update" : "Add"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
