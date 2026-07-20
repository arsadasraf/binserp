"use client";

import { useState } from "react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";

export const dynamic = "force-dynamic";

import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useToggleUserStatusMutation,
} from "@/src/store/services/userService";
import UserFormModal from "./components/UserFormModal";
import ActiveSessionsTable from "./components/ActiveSessionsTable";

interface User {
  _id: string;
  name: string;
  userId: string;
  email: string;
  department: string;
  roleLevel: number;
  allowedIP?: string;
  allowedLocation?: {
    lat: number;
    lng: number;
    radius: number;
  };
  isActive?: boolean;
  createdAt?: string;
}

// Excel-style filter component
function ColumnFilter({ options, selected, onChange }: { options: string[], selected: string[], onChange: (val: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(o => o !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  return (
    <div className="relative inline-block text-left ml-2 font-normal">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`p-1.5 rounded-full hover:bg-gray-200 transition-colors ${selected.length > 0 ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-400'}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          
          <div className="absolute z-20 mt-1 w-56 rounded-xl shadow-xl bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 left-0">
            <div className="p-2 border-b border-gray-100 dark:border-slate-700 ">
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full text-xs p-1.5 border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            
            <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
              <label className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 dark:bg-slate-800 /50 p-1.5 rounded transition-colors">
                <input 
                  type="checkbox" 
                  checked={selected.length === options.length || selected.length === 0} 
                  onChange={handleSelectAll} 
                  className="rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="font-semibold text-gray-700 dark:text-gray-300">(Select All)</span>
              </label>

              {filteredOptions.map(opt => (
                <label key={opt} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 dark:bg-slate-800 /50 p-1.5 rounded transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selected.includes(opt) || selected.length === 0} 
                    onChange={() => handleToggle(opt)} 
                    className="rounded text-indigo-600 focus:ring-indigo-500" 
                  />
                  <span className="truncate text-gray-600 dark:text-gray-400 ">{opt}</span>
                </label>
              ))}
              {filteredOptions.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400 text-center p-2">No matches</div>}
            </div>
            
            <div className="p-2 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 /50 rounded-b-xl">
              <button 
                onClick={() => onChange([])} 
                className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 font-medium px-2 py-1"
              >
                Clear
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-[11px] bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


export default function AdminDashboard() {
  const { data: users = [], isFetching, refetch } = useGetUsersQuery();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const [toggleUserStatus, { isLoading: isToggling }] = useToggleUserStatusMutation();

  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "sessions">("users");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [globalSearch, setGlobalSearch] = useState("");
  const [filters, setFilters] = useState<{ [key: string]: string[] }>({
    name: [],
    userId: [],
    email: [],
    department: []
  });

  // Extract unique options for columns
  const filterOptions = {
    name: Array.from(new Set(users.map((u: User) => u.name))),
    userId: Array.from(new Set(users.map((u: User) => u.userId))),
    email: Array.from(new Set(users.map((u: User) => u.email))),
    department: Array.from(new Set(users.map((u: User) => u.department)))
  };

  const filteredUsers = users.filter((u: User) => {
    // 1. Global Search Logic
    const s = globalSearch.toLowerCase();
    const matchGlobal = s === "" || 
      u.name.toLowerCase().includes(s) || 
      u.userId.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s) || 
      u.department.toLowerCase().includes(s);
    
    // 2. Excel-like column filters Logic
    const matchCol = 
      (filters.name.length === 0 || filters.name.includes(u.name)) &&
      (filters.userId.length === 0 || filters.userId.includes(u.userId)) &&
      (filters.email.length === 0 || filters.email.includes(u.email)) &&
      (filters.department.length === 0 || filters.department.includes(u.department));
      
    return matchGlobal && matchCol;
  });

  const handleCreateUser = async (formData: any) => {
    setError("");
    setSuccess("");

    try {
      await createUser(formData).unwrap();
      setSuccess("User created successfully!");
      handleCloseModal();
      refetch();
    } catch (err: any) {
      setError(err.data?.message || err.message || "Failed to create user. Please try again.");
    }
  };

  const handleUpdateUser = async (formData: any) => {
    setError("");
    setSuccess("");

    if (!editingUser) return;

    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        department: formData.department,
        allowedIP: formData.allowedIP,
        allowedLocation: {
          lat: Number(formData.allowedLat),
          lng: Number(formData.allowedLng),
          radius: Number(formData.allowedRadius)
        }
      };

      // Only include password if it's not empty
      if (formData.password && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }

      await updateUser({ id: editingUser._id, body: updateData }).unwrap();
      setSuccess("User updated successfully!");
      handleCloseModal();
      refetch();
    } catch (err: any) {
      setError(err.data?.message || err.message || "Failed to update user. Please try again.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      await deleteUser(userId).unwrap();
      setSuccess("User deleted successfully!");
      setError("");
      refetch();
    } catch (err: any) {
      setError(err.data?.message || err.message || "Failed to delete user. Please try again.");
    }
  };

  const handleToggleStatus = async (user: User) => {
    const action = user.isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      await toggleUserStatus(user._id).unwrap();
      setSuccess(`User ${action}d successfully!`);
      setError("");
      refetch();
    } catch (err: any) {
      setError(err.data?.message || err.message || `Failed to ${action} user. Please try again.`);
    }
  };

  const isUserDeletable = (user: User) => {
    if (!user.createdAt) return true;
    const createdTime = new Date(user.createdAt).getTime();
    const currentTime = new Date().getTime();
    const hoursDifference = (currentTime - createdTime) / (1000 * 60 * 60);
    return hoursDifference <= 24;
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-2">
          {error && <ErrorAlert message={error} onClose={() => setError("")} />}
          {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}

          <UserFormModal
            isOpen={showForm}
            onClose={handleCloseModal}
            onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
            editingUser={editingUser}
            isLoading={isCreating || isUpdating}
          />

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-700 mb-4 bg-white dark:bg-slate-800 rounded-t-xl px-2 pt-2">
            <button
              onClick={() => setActiveTab("users")}
              className={`py-2 px-4 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === "users"
                  ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 dark:bg-slate-700 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={`py-2 px-4 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === "sessions"
                  ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 dark:bg-slate-700 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              }`}
            >
              Active Sessions
            </button>
          </div>

          {activeTab === "users" ? (
            <>
              {/* Global Search Header */}
          <div className="bg-white h-auto  p-2 rounded-md shadow-sm border border-gray-200 dark:border-slate-700 mb-2 flex  sm:flex-row  items-center justify-between">
            <div className="flex flex-1  gap-1  w-full sm:w-96">
              <input
                type="text"
                placeholder="Search users..."
                className="w-full h-auto pl-2 pr-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:bg-slate-900 dark:text-white"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              
  
              <button
               onClick={() => {
                setEditingUser(null);
                setShowForm(true);
                setError("");
                setSuccess("");
                    }}
              className="h-10 shrink-0 truncate  bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-md font-semibold shadow-md hover:shadow-xl transition-all transform hover:-translate-y-0.5 text-align-center flex items-center justify-center whitespace-nowrap"
              title="Create User"
                >
              <span className="md:hidden">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="hidden md:inline">+ Create User</span>
            </button>
          {/* </div> */}
              {/* <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> */}
            </div>
            {/* {(globalSearch || Object.values(filters).some(f => f.length > 0)) && (
              <button 
                onClick={() => { setGlobalSearch(""); setFilters({name: [], userId: [], email: [], department: []}); }} 
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
              >
                Clear All Filter Conditions
              </button>
            )} */}
          </div>

          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-xl md:rounded-2xl overflow-visible border border-gray-200 dark:border-slate-700 ">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto min-h-[300px] rounded-2xl">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-800 /50 border-b border-gray-200 dark:border-slate-700 ">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider relative group">
                      <div className="flex items-center">
                        Name
                        <ColumnFilter options={filterOptions.name} selected={filters.name} onChange={val => setFilters({...filters, name: val})} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider relative group">
                      <div className="flex items-center">
                        User ID
                        <ColumnFilter options={filterOptions.userId} selected={filters.userId} onChange={val => setFilters({...filters, userId: val})} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider relative group">
                      <div className="flex items-center">
                        Email
                        <ColumnFilter options={filterOptions.email} selected={filters.email} onChange={val => setFilters({...filters, email: val})} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider relative group">
                      <div className="flex items-center">
                        Department/Role
                        <ColumnFilter options={filterOptions.department} selected={filters.department} onChange={val => setFilters({...filters, department: val})} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {isFetching ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <LoadingSpinner size="md" />
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 ">
                        No users match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user: User) => (
                      <tr key={user._id} className="hover:bg-gray-50 dark:bg-slate-800 /50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white ">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {user.userId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${user.department === "HR" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                            user.department === "Store" ? "bg-green-100 text-green-800 border border-green-200" :
                              user.department === "PPC" ? "bg-orange-100 text-orange-800 border border-orange-200" :
                                "bg-indigo-100 text-indigo-800 border border-indigo-200"
                            }`}>
                            {user.department}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-900 px-3 py-1.5 rounded-lg transition-colors font-semibold shadow-sm"
                          >
                            Edit
                          </button>
                          {isUserDeletable(user) ? (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-900 px-3 py-1.5 rounded-lg transition-colors font-semibold shadow-sm"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`px-3 py-1.5 rounded-lg transition-colors font-semibold shadow-sm ${
                                user.isActive
                                  ? "bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-900"
                                  : "bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-900"
                              }`}
                            >
                              {user.isActive ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden pt-2">
              {isFetching ? (
                <div className="p-4 text-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 ">
                  No users match your filters.
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {filteredUsers.map((user: User) => (
                    <div
                      key={user._id}
                      onClick={() => handleEditUser(user)}
                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99] duration-150"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white ">{user.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                            <span className="font-medium mr-1">ID:</span> <span className="font-mono">{user.userId}</span>
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.department === "HR" ? "bg-blue-100 text-blue-800" :
                          user.department === "Store" ? "bg-green-100 text-green-800" :
                            user.department === "PPC" ? "bg-orange-100 text-orange-800" :
                              "bg-indigo-100 text-indigo-800"
                          }`}>
                          {user.department}
                        </span>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{user.email}</p>
                      </div>

                      <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100 dark:border-slate-700 ">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditUser(user);
                          }}
                          className="bg-indigo-50 text-indigo-600 hover:text-indigo-800 px-3 py-1 text-xs rounded-lg font-medium flex items-center"
                        >
                          Edit
                        </button>
                        {isUserDeletable(user) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(user._id);
                            }}
                            className="bg-red-50 text-red-600 hover:text-red-800 px-3 py-1 text-xs rounded-lg font-medium flex items-center"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(user);
                            }}
                            className={`px-3 py-1 text-xs rounded-lg font-medium flex items-center ${
                              user.isActive
                                ? "bg-amber-50 text-amber-600 hover:text-amber-800"
                                : "bg-green-50 text-green-600 hover:text-green-800"
                            }`}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            </>
          ) : (
            <ActiveSessionsTable />
          )}
        </div>
      </div>
    
  );
}
