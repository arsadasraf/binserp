"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { API_BASE_URL } from "@/src/utils/config";

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/roles?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        cache: 'no-store'
      });
      const data = await res.json();
      if (res.ok) {
        setRoles(data.data);
      } else {
        Swal.fire("Error", data.message || "Failed to fetch roles", "error");
      }
    } catch (err) {
      Swal.fire("Error", "An error occurred", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/roles/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (res.ok) {
        Swal.fire("Success", "Role deleted successfully", "success");
        fetchRoles();
      } else {
        const data = await res.json();
        Swal.fire("Error", data.message || "Failed to delete role", "error");
      }
    } catch (err) {
      Swal.fire("Error", "An error occurred while deleting", "error");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
          <p className="text-gray-500">Manage user roles and their access levels.</p>
        </div>
        <Link 
          href="/dashboard/admin/roles/new" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Create Role
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">Role Name</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {roles.map((role: any) => (
                <tr key={role._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{role.name}</td>
                  <td className="px-6 py-4 text-gray-500">{role.description}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 items-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${role.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {role.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {role.isDefault && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800">
                          System Default (Full Access)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/dashboard/admin/roles/${role._id}`} className="text-gray-400 hover:text-indigo-600 transition-colors">
                        <Edit size={18} />
                      </Link>
                      {(!role.isDefault && role.name !== "GM" && role.name !== "Admin Default Role") && (
                        <button onClick={() => handleDelete(role._id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No roles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
