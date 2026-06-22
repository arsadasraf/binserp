"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import { Search, Mail, Phone, Building } from "lucide-react";

export default function CustomerDirectory() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/crm/customers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setCustomers(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching customers");
        } finally {
            setLoading(false);
        }
    };

    const filtered = customers.filter((c: any) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contactPerson?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center animate-pulse">Loading Customers...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">Customer Directory</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        placeholder="Search customers..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Company</th>
                            <th className="px-6 py-4">Contact Person</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Phone</th>
                            <th className="px-6 py-4">GSTIN</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-400">No customers found.</td></tr>
                        ) : (
                            filtered.map((cust: any) => (
                                <tr key={cust._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                            {cust.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        {cust.name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{cust.contactPerson || "-"}</td>
                                    <td className="px-6 py-4 text-gray-600">{cust.email || "-"}</td>
                                    <td className="px-6 py-4 text-gray-600">{cust.phone || "-"}</td>
                                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{cust.gstin || "-"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
