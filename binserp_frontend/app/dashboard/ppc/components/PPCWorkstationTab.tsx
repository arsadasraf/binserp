import React, { useState, useEffect } from "react";
import { 
  useGetWorkstationsQuery, 
  useCreateWorkstationMutation, 
  useUpdateWorkstationMutation, 
  useDeleteWorkstationMutation,
  useGetMachinesQuery,
  useGetProcessesQuery,
  useGetMachineLocationsQuery,
  useGetMachineCategoriesQuery
} from "@/src/store/services/ppcService";
import { Plus, Search, Factory, Cpu, Activity, MapPin, Edit2, Trash2, X, Check, Clock, Layers, UserCheck } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";

interface PPCWorkstationTabProps {
  preselectedMachineId?: string;
  onModalClose?: () => void;
}

export default function PPCWorkstationTab({ preselectedMachineId, onModalClose }: PPCWorkstationTabProps) {
  const { data: workstations = [], isLoading: loadingWs } = useGetWorkstationsQuery();
  const { data: machines = [] } = useGetMachinesQuery();
  const { data: processes = [] } = useGetProcessesQuery();
  const { data: locations = [] } = useGetMachineLocationsQuery();
  const { data: categories = [] } = useGetMachineCategoriesQuery();

  const [createWorkstation, { isLoading: isCreating }] = useCreateWorkstationMutation();
  const [updateWorkstation, { isLoading: isUpdating }] = useUpdateWorkstationMutation();
  const [deleteWorkstation] = useDeleteWorkstationMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INDIVIDUAL_MACHINE" | "ASSEMBLY_LINE">("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingWorkstation, setEditingWorkstation] = useState<any>(null);

  const [formData, setFormData] = useState({
    workstationCode: "",
    workstationName: "",
    workstationType: "INDIVIDUAL_MACHINE" as "INDIVIDUAL_MACHINE" | "ASSEMBLY_LINE",
    location: "",
    category: "",
    machines: [] as string[],
    processes: [] as string[],
    hourlyRate: 0,
    capacityHoursPerDay: 8,
    status: "Active",
    description: "",
  });

  // Handle preselected machine passed from Machine List
  useEffect(() => {
    if (preselectedMachineId) {
      const selectedMachine = machines.find((m: any) => m._id === preselectedMachineId);
      setEditingWorkstation(null);
      setFormData({
        workstationCode: "",
        workstationName: selectedMachine ? `${selectedMachine.machineName} Workstation` : "",
        workstationType: "INDIVIDUAL_MACHINE",
        location: selectedMachine?.location ? (typeof selectedMachine.location === 'object' ? selectedMachine.location._id : selectedMachine.location) : "",
        category: selectedMachine?.category ? (typeof selectedMachine.category === 'object' ? selectedMachine.category._id : selectedMachine.category) : "",
        machines: [preselectedMachineId],
        processes: [],
        hourlyRate: 0,
        capacityHoursPerDay: 8,
        status: "Active",
        description: "",
      });
      setShowModal(true);
    }
  }, [preselectedMachineId, machines]);

  const handleOpenCreate = () => {
    setEditingWorkstation(null);
    setFormData({
      workstationCode: "",
      workstationName: "",
      workstationType: "INDIVIDUAL_MACHINE",
      location: "",
      category: "",
      machines: [],
      processes: [],
      hourlyRate: 0,
      capacityHoursPerDay: 8,
      status: "Active",
      description: "",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ws: any) => {
    setEditingWorkstation(ws);
    setFormData({
      workstationCode: ws.workstationCode || "",
      workstationName: ws.workstationName || "",
      workstationType: ws.workstationType || "INDIVIDUAL_MACHINE",
      location: typeof ws.location === "object" ? ws.location?._id : ws.location || "",
      category: typeof ws.category === "object" ? ws.category?._id : ws.category || "",
      machines: Array.isArray(ws.machines) ? ws.machines.map((m: any) => typeof m === "object" ? m._id : m) : [],
      processes: Array.isArray(ws.processes) ? ws.processes.map((p: any) => typeof p === "object" ? p._id : p) : [],
      hourlyRate: ws.hourlyRate || 0,
      capacityHoursPerDay: ws.capacityHoursPerDay || 8,
      status: ws.status || "Active",
      description: ws.description || "",
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (onModalClose) onModalClose();
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete workstation "${name}"?`)) {
      try {
        await deleteWorkstation(id).unwrap();
      } catch (err: any) {
        alert(err?.data?.message || "Failed to delete workstation");
      }
    }
  };

  const toggleMachineSelection = (machineId: string) => {
    if (formData.workstationType === "INDIVIDUAL_MACHINE") {
      setFormData(prev => ({
        ...prev,
        machines: [machineId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        machines: prev.machines.includes(machineId)
          ? prev.machines.filter(id => id !== machineId)
          : [...prev.machines, machineId]
      }));
    }
  };

  const toggleProcessSelection = (processId: string) => {
    setFormData(prev => ({
      ...prev,
      processes: prev.processes.includes(processId)
        ? prev.processes.filter(id => id !== processId)
        : [...prev.processes, processId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.workstationName.trim()) {
      alert("Please enter a workstation name.");
      return;
    }

    try {
      if (editingWorkstation?._id) {
        await updateWorkstation({ id: editingWorkstation._id, body: formData }).unwrap();
      } else {
        await createWorkstation(formData).unwrap();
      }
      handleCloseModal();
    } catch (err: any) {
      console.error(err);
      alert(err?.data?.message || "Failed to save workstation");
    }
  };

  const filteredWorkstations = workstations.filter(ws => {
    const term = searchTerm.toLowerCase();
    const name = (ws.workstationName || "").toLowerCase();
    const code = (ws.workstationCode || "").toLowerCase();
    const desc = (ws.description || "").toLowerCase();
    const matchesSearch = name.includes(term) || code.includes(term) || desc.includes(term);
    const matchesStatus = statusFilter === "ALL" ? true : ws.status === statusFilter;
    const matchesType = typeFilter === "ALL" ? true : (ws.workstationType || "INDIVIDUAL_MACHINE") === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Toolbar & Type Filter Bar */}
      <div className="flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
        
        {/* Top Controls Row */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Workstations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Create Workstation</span>
          </button>
        </div>

        {/* Type Filter Sub-Bar */}
        <div className="flex space-x-2 border-t border-gray-200/60 dark:border-gray-800 pt-3">
          {[
            { id: "ALL", label: "All Workstations" },
            { id: "INDIVIDUAL_MACHINE", label: "Single Machines" },
            { id: "ASSEMBLY_LINE", label: "Assembly Lines" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workstations Grid Cards */}
      {loadingWs ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : filteredWorkstations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
          <Factory className="h-10 w-10 text-indigo-400 mb-2" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">No Workstations Found</h3>
          <p className="text-xs text-gray-500 max-w-sm text-center mt-1">
            Create single machine workstations or assembly lines grouping multiple machines and assigned processes.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            + Create Workstation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkstations.map((ws: any) => {
            const linkedMachines = Array.isArray(ws.machines) ? ws.machines : [];
            const linkedProcesses = Array.isArray(ws.processes) ? ws.processes : [];
            const catName = typeof ws.category === "object" ? (ws.category.categoryName || ws.category.categoryCode) : "";
            const isAssemblyLine = (ws.workstationType || "INDIVIDUAL_MACHINE") === "ASSEMBLY_LINE";

            return (
              <div key={ws._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="space-y-4">
                  
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isAssemblyLine ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                        {isAssemblyLine ? <Layers size={22} /> : <Cpu size={22} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white text-base">{ws.workstationName}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 font-mono">{ws.workstationCode}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAssemblyLine 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200' 
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200'
                          }`}>
                            {isAssemblyLine ? 'Assembly Line' : 'Single Machine'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      ws.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                      ws.status === 'Maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {ws.status || 'Active'}
                    </span>
                  </div>

                  {/* Location & Specs Info */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800/60">
                    {ws.location && (
                      <div className="flex items-center gap-1 font-medium">
                        <MapPin size={13} className="text-indigo-500" />
                        <span>{typeof ws.location === "object" ? (ws.location.locationName || ws.location.locationCode) : ws.location}</span>
                      </div>
                    )}
                    {catName && (
                      <div className="flex items-center gap-1 font-medium">
                        <span className="text-purple-600">Cat: {catName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 font-medium">
                      <Clock size={13} className="text-indigo-500" />
                      <span>{ws.capacityHoursPerDay || 8} Hrs/Day</span>
                    </div>
                    {Number(ws.hourlyRate || 0) > 0 && (
                      <div className="flex items-center gap-1 font-medium">
                        <span>₹{ws.hourlyRate}/Hr</span>
                      </div>
                    )}
                  </div>

                  {/* Grouped Machines Section */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Cpu size={13} className="text-indigo-500" />
                      {isAssemblyLine ? `Line Machines (${linkedMachines.length})` : 'Dedicated Machine'}
                    </label>
                    {linkedMachines.length === 0 ? (
                      <span className="text-xs text-gray-400 italic block">No machine linked</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedMachines.map((m: any, idx: number) => {
                          const mName = typeof m === "object" ? (m.machineName || m.machineCode) : m;
                          return (
                            <span key={idx} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                              {mName}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Assigned Processes Section */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Activity size={13} className="text-emerald-500" />
                      Assigned Processes ({linkedProcesses.length})
                    </label>
                    {linkedProcesses.length === 0 ? (
                      <span className="text-xs text-gray-400 italic block">No processes assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedProcesses.map((p: any, idx: number) => {
                          const pName = typeof p === "object" ? (p.processName || p.processCode) : p;
                          return (
                            <span key={idx} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                              {pName}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">
                    Updated {ws.updatedAt ? new Date(ws.updatedAt).toLocaleDateString() : 'recently'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(ws)}
                      className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                      title="Edit Workstation"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(ws._id, ws.workstationName)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete Workstation"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto border border-gray-100 dark:border-gray-800 max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Factory size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {editingWorkstation ? "Edit Workstation" : "Create Workstation"}
                  </h3>
                  <p className="text-xs text-gray-500">Configure single machine workstation or multi-machine assembly line</p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              <form id="workstation-modal-form" onSubmit={handleSubmit} className="space-y-5">
                
                {/* Workstation Type Selection Radio Cards */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Workstation Type *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setFormData(prev => ({ ...prev, workstationType: "INDIVIDUAL_MACHINE" }))}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                        formData.workstationType === "INDIVIDUAL_MACHINE"
                          ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${formData.workstationType === "INDIVIDUAL_MACHINE" ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Cpu size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-sm block">Single Machine Workstation</span>
                        <span className="text-[11px] text-gray-500 block">Dedicated workstation for 1 physical machine</span>
                      </div>
                    </div>

                    <div
                      onClick={() => setFormData(prev => ({ ...prev, workstationType: "ASSEMBLY_LINE" }))}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                        formData.workstationType === "ASSEMBLY_LINE"
                          ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${formData.workstationType === "ASSEMBLY_LINE" ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Layers size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-sm block">Assembly Line / Department Cell</span>
                        <span className="text-[11px] text-gray-500 block">Group multiple machines for continuous processing</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Workstation Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.workstationName}
                      onChange={(e) => setFormData(prev => ({ ...prev, workstationName: e.target.value }))}
                      placeholder={formData.workstationType === "INDIVIDUAL_MACHINE" ? "e.g. CNC Lathe 1 Workstation" : "e.g. Main Assembly Line A, Fabrication Dept"}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Workstation Code <span className="text-xs font-normal text-gray-500">(Auto-generated if empty)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.workstationCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, workstationCode: e.target.value }))}
                      placeholder="e.g. WS-IND-001 or WS-ASY-001"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((cat: any) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.categoryName || cat.categoryCode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Location / Bay</label>
                    <select
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                    >
                      <option value="">-- Select Location --</option>
                      {locations.map((loc: any) => (
                        <option key={loc._id} value={loc._id}>
                          {loc.locationName || loc.locationCode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Capacity (Hrs/Day)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.capacityHoursPerDay}
                      onChange={(e) => setFormData(prev => ({ ...prev, capacityHoursPerDay: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Hourly Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                    />
                  </div>
                </div>

                {/* Machine Selection Section */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Cpu size={14} className="text-indigo-500" />
                      {formData.workstationType === "INDIVIDUAL_MACHINE" 
                        ? "Select Dedicated Physical Machine (1 Machine)" 
                        : `Select Assembly Line Machines (${formData.machines.length} Selected)`}
                    </span>
                  </label>

                  {machines.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No physical machines available. Create machines first in Machine List tab.</p>
                  ) : formData.workstationType === "INDIVIDUAL_MACHINE" ? (
                    <select
                      value={formData.machines[0] || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, machines: e.target.value ? [e.target.value] : [] }))}
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white font-medium"
                    >
                      <option value="">-- Select Dedicated Machine --</option>
                      {machines.map((m: any) => (
                        <option key={m._id} value={m._id}>
                          {m.machineName} ({m.machineCode})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-44 overflow-y-auto p-3 bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/80 rounded-xl">
                      {machines.map((m: any) => {
                        const isChecked = formData.machines.includes(m._id);
                        return (
                          <div
                            key={m._id}
                            onClick={() => toggleMachineSelection(m._id)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-xs ${
                              isChecked
                                ? "bg-purple-50 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 font-semibold"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                              {isChecked && <Check size={12} />}
                            </div>
                            <div className="truncate">
                              <span className="block truncate">{m.machineName}</span>
                              <span className="text-[10px] text-gray-400 block font-mono">{m.machineCode}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Processes Selector */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Activity size={14} className="text-emerald-500" />
                      Select Manufacturing Processes Performed Here ({formData.processes.length} Selected)
                    </span>
                  </label>

                  {processes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No processes available. Create processes first in Process tab.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-44 overflow-y-auto p-3 bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/80 rounded-xl">
                      {processes.map((p: any) => {
                        const isChecked = formData.processes.includes(p._id);
                        return (
                          <div
                            key={p._id}
                            onClick={() => toggleProcessSelection(p._id)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-xs ${
                              isChecked
                                ? "bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-300"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                              {isChecked && <Check size={12} />}
                            </div>
                            <div className="truncate">
                              <span className="block truncate">{p.processName}</span>
                              <span className="text-[10px] text-gray-400 block font-mono">{p.processCode}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Description / Notes</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Workstation department details, shop floor notes..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white resize-none"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="workstation-modal-form"
                disabled={isCreating || isUpdating}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
              >
                {isCreating || isUpdating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Workstation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
