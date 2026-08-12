"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import PPCTabs from "../../components/PPCTabs";
import PPCOverviewNav from "../components/PPCOverviewNav";
import PPCEntityDrawer, { DrawerEntity } from "../components/PPCEntityDrawer";
import { Users, Search, Filter } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

export default function EmployeesOverviewPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedId = searchParams.get("id");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Try master list first (merges HR Employees & PPC Manpower), fallback to /api/ppc/manpower, fallback to /api/hr/employee
      const [manpowerRes, jobsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/ppc/manpower-master`, { headers }).catch(() =>
          axios.get(`${API_BASE_URL}/api/ppc/manpower`, { headers }).catch(() =>
            axios.get(`${API_BASE_URL}/api/hr/employee`, { headers }).catch(() => ({ data: [] }))
          )
        ),
        axios.get(`${API_BASE_URL}/api/ppc/job`, { headers }).catch(() => ({ data: [] })),
      ]);

      const rawList =
        manpowerRes.data?.manpowerList ||
        manpowerRes.data?.manpower ||
        manpowerRes.data?.employees ||
        manpowerRes.data ||
        [];

      // Normalize employee object fields
      const normalizedList = Array.isArray(rawList)
        ? rawList.map((item: any) => ({
            _id: item._id || item.employeeId || item.employee?._id,
            employeeId: item.empCode || item.employeeId || item.employee?.employeeId || "EMP",
            name: item.name || item.employee?.name || "Operator",
            designation: item.designation || item.employee?.designation || "Shop Floor Worker",
            department: item.department || item.employee?.department || "Production",
            status: item.shopfloorStatus || item.status || "Active",
            skills: item.skills || item.employee?.skills || [],
            photo: item.photo || item.employee?.photo,
          }))
        : [];

      setEmployees(normalizedList);
      setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : jobsRes.data.jobs || []);
    } catch (err) {
      console.error("Failed to fetch employees data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const nameMatch =
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch =
      statusFilter === "all" || (e.status || "Active").toLowerCase() === statusFilter.toLowerCase();
    return nameMatch && statusMatch;
  });

  const selectedEmployee = selectedId
    ? employees.find((e) => e._id === selectedId || e.employeeId === selectedId)
    : null;

  const drawerEntity: DrawerEntity | null = selectedEmployee
    ? {
        id: selectedEmployee._id,
        name: selectedEmployee.name,
        code: selectedEmployee.employeeId,
        type: "employee",
        status: selectedEmployee.status || "Active",
        subtitle: `Dept: ${selectedEmployee.department || "Shop Floor"} • Designation: ${selectedEmployee.designation || "Operator"}`,
        currentJob: jobs.find(
          (j) => (j.operator === selectedEmployee._id || j.employeeId === selectedEmployee.employeeId) && j.status === "InProgress"
        )
          ? {
              jobId: "J-EMP-ACTIVE",
              jobNumber: "JOB-LIVE",
              partName:
                jobs.find(
                  (j) => (j.operator === selectedEmployee._id || j.employeeId === selectedEmployee.employeeId) && j.status === "InProgress"
                )?.partName || "Active Operator Task",
              operationName: "Machining & Assembly",
              operatorName: selectedEmployee.name,
              machineName: "Assigned Workstation",
              startTime: new Date().toISOString(),
              progressPercentage: 70,
              status: "InProgress",
            }
          : null,
        pendingQueue: jobs
          .filter(
            (j) => (j.operator === selectedEmployee._id || j.employeeId === selectedEmployee.employeeId) && j.status === "Pending"
          )
          .map((j) => ({
            jobId: j._id,
            jobNumber: j.jobNumber || "JOB-QUEUE",
            partName: j.partName || "Scheduled Task",
            operationName: j.operationName || "Operation",
            priority: j.priority || "Medium",
          })),
        completedHistory: jobs
          .filter(
            (j) => (j.operator === selectedEmployee._id || j.employeeId === selectedEmployee.employeeId) && j.status === "Completed"
          )
          .map((j) => ({
            jobId: j._id,
            jobNumber: j.jobNumber || "JOB-DONE",
            partName: j.partName || "Finished Task",
            operationName: j.operationName || "Quality Pass",
            completedAt: j.updatedAt || new Date().toISOString(),
            quantityProduced: j.quantity || 45,
          })),
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-24 sm:pb-8">
      <div className="p-4 max-w-[1600px] mx-auto">
        <PPCTabs activeTab="overview" />
        <PPCOverviewNav />

        {/* Search & Filter Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search operators / employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="text-gray-400" size={16} />
            <span className="text-xs font-bold text-gray-500">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-gray-800 text-xs font-extrabold text-gray-900 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none"
            >
              <option value="all">All Employees</option>
              <option value="Active">Active / On Duty</option>
              <option value="Idle">Idle</option>
              <option value="Inactive">Inactive / Off Duty</option>
            </select>
          </div>
        </div>

        {/* Employees Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-800">
            <Users className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">No Employees Found</h3>
            <p className="text-xs text-gray-500 mt-1">No shop floor workers or employees match your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredEmployees.map((emp) => {
              const status = emp.status || "Active";
              return (
                <div
                  key={emp._id}
                  onClick={() => router.push(`/dashboard/ppc/overview/employees?id=${emp._id}`)}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-indigo-500/50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold overflow-hidden">
                      {emp.photo ? (
                        <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={20} />
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        status === "Active" || status === "On Duty"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                    {emp.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mb-1">ID: {emp.employeeId}</p>
                  <p className="text-xs text-gray-500 mb-4">{emp.designation || emp.department || "Shop Floor Worker"}</p>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>Click for task history</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Preview →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Slide-over Detail Drawer */}
        <PPCEntityDrawer
          isOpen={!!selectedId}
          onClose={() => router.push("/dashboard/ppc/overview/employees")}
          entity={drawerEntity}
        />
      </div>
    </div>
  );
}
