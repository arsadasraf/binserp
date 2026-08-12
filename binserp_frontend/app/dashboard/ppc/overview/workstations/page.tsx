"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/src/utils/config";
import PPCTabs from "../../components/PPCTabs";
import PPCOverviewNav from "../components/PPCOverviewNav";
import PPCEntityDrawer, { DrawerEntity } from "../components/PPCEntityDrawer";
import { Cpu, Search, Filter, PlayCircle, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

export default function WorkstationsOverviewPage() {
  const [machines, setMachines] = useState<any[]>([]);
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

      const [machinesRes, jobsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/ppc/machine`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/ppc/job`, { headers }).catch(() => ({ data: [] })),
      ]);

      setMachines(Array.isArray(machinesRes.data) ? machinesRes.data : machinesRes.data.machines || []);
      setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : jobsRes.data.jobs || []);
    } catch (err) {
      console.error("Failed to fetch workstations data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMachines = machines.filter((m) => {
    const nameMatch =
      m.machineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.machineCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === "all" || (m.status || "Idle").toLowerCase() === statusFilter.toLowerCase();
    return nameMatch && statusMatch;
  });

  // Selected Machine Drawer Mapping
  const selectedMachine = selectedId ? machines.find((m) => m._id === selectedId || m.machineCode === selectedId) : null;

  const drawerEntity: DrawerEntity | null = selectedMachine
    ? {
        id: selectedMachine._id,
        name: selectedMachine.machineName,
        code: selectedMachine.machineCode,
        type: "workstation",
        status: selectedMachine.status || "Idle",
        subtitle: `Category: ${selectedMachine.category || "General Machine"} • Location: ${selectedMachine.location || "Shop Floor"}`,
        currentJob: jobs.find((j) => (j.machine === selectedMachine._id || j.machineCode === selectedMachine.machineCode) && j.status === "InProgress")
          ? {
              jobId: "J-ACTIVE",
              jobNumber: "JOB-LIVE",
              partName: jobs.find((j) => (j.machine === selectedMachine._id || j.machineCode === selectedMachine.machineCode) && j.status === "InProgress")?.partName || "Operation Active",
              operationName: "Machining Operation",
              operatorName: "On Duty Operator",
              machineName: selectedMachine.machineName,
              startTime: new Date().toISOString(),
              progressPercentage: 65,
              status: "InProgress",
            }
          : null,
        pendingQueue: jobs
          .filter((j) => (j.machine === selectedMachine._id || j.machineCode === selectedMachine.machineCode) && j.status === "Pending")
          .map((j) => ({
            jobId: j._id,
            jobNumber: j.jobNumber || "JOB-QUEUE",
            partName: j.partName || "Scheduled Component",
            operationName: j.operationName || "Operation",
            priority: j.priority || "Medium",
          })),
        completedHistory: jobs
          .filter((j) => (j.machine === selectedMachine._id || j.machineCode === selectedMachine.machineCode) && j.status === "Completed")
          .map((j) => ({
            jobId: j._id,
            jobNumber: j.jobNumber || "JOB-DONE",
            partName: j.partName || "Finished Component",
            operationName: j.operationName || "Final Pass",
            completedAt: j.updatedAt || new Date().toISOString(),
            quantityProduced: j.quantity || 50,
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
              placeholder="Search workstations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="text-gray-400" size={16} />
            <span className="text-xs font-bold text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-gray-800 text-xs font-extrabold text-gray-900 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none"
            >
              <option value="all">All Workstations</option>
              <option value="Running">Running</option>
              <option value="Idle">Idle</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {/* Workstations Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-800">
            <Cpu className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">No Workstations Found</h3>
            <p className="text-xs text-gray-500 mt-1">No shop floor workstations match your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredMachines.map((machine) => {
              const status = machine.status || "Idle";
              return (
                <div
                  key={machine._id}
                  onClick={() => router.push(`/dashboard/ppc/overview/workstations?id=${machine._id}`)}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-indigo-500/50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <Cpu size={20} />
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        status === "Running" || status === "Active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : status === "Maintenance"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                    {machine.machineName}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mb-4">Code: {machine.machineCode}</p>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>Click to view history</span>
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
          onClose={() => router.push("/dashboard/ppc/overview/workstations")}
          entity={drawerEntity}
        />
      </div>
    </div>
  );
}
