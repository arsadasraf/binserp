"use client";

import { useState } from "react";
import { Search, Plus, XCircle, Trash2 } from "lucide-react";
import Modal from "@/src/components/Modal";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import {
  useGetManpowerMasterQuery,
  useGetProcessesQuery,
  useCreateManpowerMutation,
  useUpdateManpowerMutation,
  useDeleteManpowerMutation,
} from "@/src/store/services/ppcService";

interface ManpowerMasterItem {
  employeeId: string;
  empCode: string;
  name: string;
  designation: string;
  department: string;
  photo?: string;
  isShopfloorActive: boolean;
  manpowerId: string | null;
  skills: { name: string; level: number }[];
  currentLoad: number;
  availability: number;
  shopfloorStatus: string;
}

// Removed SubTab: skill-master is now unified with Processes

export default function PPCManpowerTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<ManpowerMasterItem | null>(null);
  const [skillForm, setSkillForm] = useState<{ name: string; level: number }[]>([]);

  // RTK Query hooks
  const { data: employees = [], isLoading: loading } = useGetManpowerMasterQuery();
  const { data: processes = [], isLoading: processLoading } = useGetProcessesQuery();
  const [createManpower] = useCreateManpowerMutation();
  const [updateManpower] = useUpdateManpowerMutation();
  const [deleteManpower] = useDeleteManpowerMutation();

  // --- Manpower Actions ---
  const handleToggleActive = async (employee: ManpowerMasterItem) => {
    if (!employee.isShopfloorActive) {
      const res = await createManpower({ employee: employee.employeeId, skills: [], status: "Available" });
      if ("error" in res) alert("Failed to activate employee for shopfloor.");
    } else {
      if (!employee.manpowerId) return;
      if (!confirm(`Are you sure you want to remove ${employee.name} from Shopfloor?`)) return;
      const res = await deleteManpower(employee.manpowerId);
      if ("error" in res) alert("Failed to deactivate employee.");
    }
  };

  const handleOpenSkillModal = (emp: ManpowerMasterItem) => {
    if (!emp.isShopfloorActive) { alert("Please activate the employee for shopfloor first."); return; }
    setSelectedEmployee(emp);
    setSkillForm(emp.skills || []);
    setShowSkillModal(true);
  };

  const handleSaveSkills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedEmployee.manpowerId) return;
    const res = await updateManpower({ id: selectedEmployee.manpowerId, body: { skills: skillForm } });
    if ("error" in res) { alert("Failed to save skills."); return; }
    setShowSkillModal(false);
  };

  const addSkillRow = () => setSkillForm([...skillForm, { name: "", level: 1 }]);
  const removeSkillRow = (index: number) => setSkillForm(skillForm.filter((_, i) => i !== index));
  const updateSkillRow = (index: number, field: "name" | "level", value: any) => {
    const newSkills = [...skillForm];
    newSkills[index] = { ...newSkills[index], [field]: value };
    setSkillForm(newSkills);
  };

  // --- Process/Skill Actions (Master removed as requested) ---

  const filteredEmployees = (employees as ManpowerMasterItem[]).filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.empCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartment === "All" || emp.department === filterDepartment;
    const matchesStatus = filterStatus === "All" || (filterStatus === "Active" ? emp.isShopfloorActive : !emp.isShopfloorActive);
    return matchesSearch && matchesDept && matchesStatus;
  });

  const departments = ["All", ...Array.from(new Set((employees as ManpowerMasterItem[]).map((e) => e.department))).filter(Boolean)];

  return (
    <div className="space-y-6">
      {/* Navigation simplified - Skill Master removed */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Employee List</h2>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="All">All Status</option>
            <option value="Active">Shopfloor Active</option>
            <option value="Inactive">Shopfloor Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">No employees found matching your filters.</div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shopfloor Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {emp.photo ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={emp.photo} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">{emp.name.charAt(0)}</div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                          <div className="text-xs text-gray-500">{emp.empCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{emp.designation}</div>
                      <div className="text-xs text-gray-500">{emp.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.isShopfloorActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {emp.isShopfloorActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {emp.skills && emp.skills.length > 0 ? (
                          emp.skills.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded border border-indigo-100">
                              {skill.name} <span className="text-indigo-400 text-[10px]">L{skill.level}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">No skills added</span>
                        )}
                        {emp.skills && emp.skills.length > 3 && <span className="text-xs text-gray-400">+{emp.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        {emp.isShopfloorActive && (
                          <button onClick={() => handleOpenSkillModal(emp)} className="text-indigo-600 hover:text-indigo-900">Details</button>
                        )}
                        <button onClick={() => handleToggleActive(emp)} className={emp.isShopfloorActive ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}>
                          {emp.isShopfloorActive ? "Remove" : "Add to Shopfloor"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skill Matrix Modal */}
      <Modal isOpen={showSkillModal} onClose={() => setShowSkillModal(false)} title={`Manage Skills: ${selectedEmployee?.name}`}>
        <form onSubmit={handleSaveSkills} className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Skill Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Proficiency (1-5)</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {skillForm.map((skillItem, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2">
                      <select required className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={skillItem.name} onChange={(e) => updateSkillRow(idx, "name", e.target.value)}>
                        <option value="">Select Process (Skill)</option>
                        {processes.map((p: any) => <option key={p._id} value={p.processName}>{p.processName}</option>)}
                        {!processes.some((p: any) => p.processName === skillItem.name) && skillItem.name && (
                          <option value={skillItem.name}>{skillItem.name}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={skillItem.level} onChange={(e) => updateSkillRow(idx, "level", parseInt(e.target.value))}>
                        {[1, 2, 3, 4, 5].map((lvl) => <option key={lvl} value={lvl}>Level {lvl}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => removeSkillRow(idx)} className="text-red-600 hover:text-red-900"><XCircle size={18} /></button>
                    </td>
                  </tr>
                ))}
                {skillForm.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">No skills assigned. Click "Add Skill" below.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addSkillRow} className="flex items-center text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            <Plus size={16} className="mr-1" /> Add Skill
          </button>
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowSkillModal(false)} className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Save Skills</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
