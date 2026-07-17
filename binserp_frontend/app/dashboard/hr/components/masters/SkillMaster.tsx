"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Search, Edit2, X, Zap } from "lucide-react";
import axios from "axios";
import { Skill } from "../../types/hr.types";
import { API_BASE_URL } from "@/src/utils/config";

export default function SkillMaster() {
    const [skills, setSkills] = useState<Skill[]>([]);
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
        fetchSkills();
    }, []);

    const fetchSkills = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE_URL}/api/hr/skill`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSkills(response.data);
        } catch (error) {
            console.error("Error fetching skills:", error);
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

    const handleOpenEdit = (skill: Skill) => {
        setFormData({ name: skill.name, description: skill.description || "" });
        setIsEditing(true);
        setCurrentId(skill._id);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };
            const url = `${API_BASE_URL}/api/hr/skill`;

            if (isEditing && currentId) {
                // Note: Since I didn't explicitly add a PUT route for skills in previous steps, 
                // I will assume the user wants me to add it or it might fail. 
                // Wait, I only added POST, GET, DELETE in step 1660. 
                // I MUST ADD PUT ROUTE TOO. For now, I'll write the frontend code to use PUT, 
                // and I'll update the backend immediately after this.
                await axios.put(`${url}/${currentId}`, formData, { headers });
            } else {
                await axios.post(url, formData, { headers });
            }

            setShowModal(false);
            fetchSkills();
        } catch (error: any) {
            console.error("Error saving skill:", error);
            alert(error.response?.data?.message || "Failed to save skill.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this skill?")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(
                `${API_BASE_URL}/api/hr/skill/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchSkills();
        } catch (error) {
            console.error("Error deleting skill:", error);
        }
    };

    const filteredSkills = skills.filter((skill) =>
        skill.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Header Actions */}
            <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 items-center justify-between md:flex-row md:gap-4 p-4 rounded-xl shadow-sm">
                <div className="flex-1 md:flex-none md:w-64 relative">
                    <Search className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2" size={18} />
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
                    <span className="hidden md:inline">Add Skill</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-gray-50/50 min-h-[200px]">
                {loading ? (
                    <div className="dark:text-gray-400 p-6 text-center text-gray-500">Loading skills...</div>
                ) : filteredSkills.length === 0 ? (
                    <div className="dark:text-gray-500 flex flex-col gap-2 items-center p-12 text-center text-gray-400">
                        <Search size={32} className="opacity-20" />
                        <p>No skills found</p>
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
                                        <th className="dark:text-gray-200 font-semibold px-6 py-4 text-gray-700 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-gray-100 divide-y">
                                    {filteredSkills.map((skill) => (
                                        <tr key={skill._id} className="dark:hover:bg-slate-700 group hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2 items-center">
                                                    <div className="bg-orange-50 p-1.5 rounded-lg text-orange-600">
                                                        <Zap size={16} />
                                                    </div>
                                                    <span className="dark:text-gray-100 font-medium text-gray-800">{skill.name}</span>
                                                </div>
                                            </td>
                                            <td className="dark:text-gray-300 px-6 py-4 text-gray-600">{skill.description || "-"}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end transition-opacity">
                                                    <button onClick={() => handleOpenEdit(skill)} className="hover:bg-blue-50 p-2 rounded-lg text-blue-500 transition-colors"><Edit2 size={18} /></button>
                                                    <button onClick={() => handleDelete(skill._id)} className="hover:bg-red-50 p-2 rounded-lg text-red-500 transition-colors"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {filteredSkills.map((skill) => (
                                <div key={skill._id} className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-3 p-4 rounded-xl shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-3 items-center">
                                            <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                                                <Zap size={20} />
                                            </div>
                                            <div>
                                                <h4 className="dark:text-white font-bold text-gray-900">{skill.name}</h4>
                                                {skill.description && (
                                                    <p className="dark:text-gray-400 line-clamp-2 mt-0.5 text-gray-500 text-sm">{skill.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-gray-50 border-t dark:border-slate-800/50 flex gap-2 items-center mt-1 pt-3">
                                        <button
                                            onClick={() => handleOpenEdit(skill)}
                                            className="bg-blue-50 flex flex-1 font-medium gap-2 hover:bg-blue-100 items-center justify-center py-2 rounded-lg text-blue-600 text-sm transition-colors"
                                        >
                                            <Edit2 size={16} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(skill._id)}
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
                <div className="backdrop-blur-sm bg-black/50 fixed flex inset-0 items-center justify-center p-4 z-[999]">
                    <div className="animate-in bg-white dark:bg-slate-800 duration-200 fade-in max-w-md p-6 rounded-xl shadow-xl w-full zoom-in-95">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="dark:text-white font-bold text-gray-900 text-lg">{isEditing ? "Edit Skill" : "Add New Skill"}</h3>
                            <button onClick={() => setShowModal(false)} className="dark:text-gray-500 hover:text-gray-600 text-gray-400"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">Skill Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="border focus:ring-2 focus:ring-blue-500 outline-none px-4 py-2 rounded-lg w-full"
                                    placeholder="e.g. React.js"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block dark:text-gray-200 font-medium mb-1 text-gray-700 text-sm">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="border focus:ring-2 focus:ring-blue-500 min-h-[80px] outline-none px-4 py-2 rounded-lg w-full"
                                    placeholder="Optional description..."
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowModal(false)} className="dark:hover:bg-slate-700 dark:text-gray-200 font-medium hover:bg-gray-100 px-4 py-2 rounded-lg text-gray-700">Cancel</button>
                                <button type="submit" disabled={submitting} className="bg-blue-600 font-medium hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
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
