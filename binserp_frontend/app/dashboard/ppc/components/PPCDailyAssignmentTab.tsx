"use client";

import { useState, useMemo } from "react";
// using native date instead of date-fns
import { Plus, Calendar, Clock, Cpu, Users, FileText, Trash2, CheckCircle, MapPin, Briefcase } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import Modal from "@/src/components/Modal";
import EmployeeMonthlyAssignment from "./EmployeeMonthlyAssignment";
import {
  useGetManpowerMasterQuery,
  useGetMachinesQuery,
  useGetShiftsQuery,
  useGetManpowerAllotmentsQuery,
  useCreateManpowerAllotmentMutation,
  useDeleteManpowerAllotmentMutation
} from "@/src/store/services/ppcService";

export default function PPCDailyAssignmentTab() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [showModal, setShowModal] = useState(false);
  const [selectedMonthEmployee, setSelectedMonthEmployee] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    employee: "",
    shift: "",
    startTime: "",
    endTime: "",
    machines: [],
    remarks: ""
  });

  const { data: employees = [], isLoading: loadingEmployees } = useGetManpowerMasterQuery();
  const { data: machines = [], isLoading: loadingMachines } = useGetMachinesQuery();
  const { data: shifts = [], isLoading: loadingShifts } = useGetShiftsQuery();
  
  const { data: allotments = [], isLoading: loadingAllotments } = useGetManpowerAllotmentsQuery({
    startDate: selectedDate,
    endDate: selectedDate
  });

  const [createAllotment, { isLoading: creating }] = useCreateManpowerAllotmentMutation();
  const [deleteAllotment] = useDeleteManpowerAllotmentMutation();

  const activeEmployees = employees.filter((e: any) => e.status !== "Inactive");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAllotment({
        ...formData,
        date: selectedDate
      }).unwrap();
      setShowModal(false);
      setFormData({
        employee: "",
        shift: "",
        startTime: "",
        endTime: "",
        machines: [],
        remarks: ""
      });
    } catch (error) {
      console.error("Failed to assign:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this assignment?")) {
      await deleteAllotment(id);
    }
  };

  const toggleMachine = (machineId: string) => {
    const current = formData.machines || [];
    if (current.includes(machineId)) {
      setFormData({ ...formData, machines: current.filter((id: string) => id !== machineId) });
    } else {
      setFormData({ ...formData, machines: [...current, machineId] });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-gray-900 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-indigo-600" /> Daily Employee Assignments
          </h2>
          <p className="text-sm text-gray-500 mt-1">Assign shifts, machines, and add daily remarks for employees.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={16} className="text-gray-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dark:bg-gray-900 dark:border-gray-800 flex-1">
        {loadingEmployees || loadingAllotments ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[25%]">Employee</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[20%]">Shift</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[25%]">Machines</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[20%]">Remarks</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[10%]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-900 dark:divide-gray-800">
                {activeEmployees.map((emp: any, index: number) => {
                  const empAllotments = allotments.filter((a: any) => a.employee?._id === (emp.employeeId || emp._id));
                  
                  return (
                    <tr key={emp.employeeId || emp._id || index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {emp.name?.substring(0, 2).toUpperCase() || 'EMP'}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {emp.name}
                            </div>
                            <div className="text-xs text-gray-500">ID: {emp.empCode || emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {empAllotments.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {empAllotments.map((allotment: any) => (
                              <div key={allotment._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100 w-fit">
                                <Clock size={12} />
                                {allotment.shift}
                                {(allotment.startTime || allotment.endTime) && (
                                  <span className="text-blue-500 opacity-70 ml-1">
                                    ({allotment.startTime || '-'} to {allotment.endTime || '-'})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No shift assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {empAllotments.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {empAllotments.map((allotment: any) => (
                              <div key={allotment._id} className="flex flex-wrap gap-1.5">
                                {allotment.machines && allotment.machines.length > 0 ? (
                                  allotment.machines.map((m: any) => (
                                    <span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                                      <Cpu size={10} />
                                      {m.machineCode}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400 italic">No machines</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {empAllotments.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {empAllotments.map((allotment: any) => (
                              <div key={allotment._id}>
                                {allotment.remarks ? (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2" title={allotment.remarks}>
                                    {allotment.remarks}
                                  </p>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">-</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-y-1">
                        <button
                          onClick={() => setSelectedMonthEmployee(emp)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors mb-1"
                        >
                          <Calendar size={14} /> View Month
                        </button>
                        <button
                          onClick={() => {
                            setFormData({ ...formData, employee: emp._id || emp.employeeId });
                            setShowModal(true);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Plus size={14} /> Assign Day
                        </button>
                        {empAllotments.map((allotment: any) => (
                          <button
                            key={allotment._id}
                            onClick={() => handleDelete(allotment._id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors mt-1"
                            title="Delete Assignment"
                          >
                            <Trash2 size={14} /> Remove ({allotment.shift})
                          </button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for creating assignments */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Daily Assignment" maxWidth="4xl">
        <form onSubmit={handleSubmit} className="p-1 max-w-4xl mx-auto space-y-6">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6 flex items-center gap-3">
            <Calendar className="text-blue-500" size={20} />
            <div>
              <p className="text-sm font-semibold text-blue-900">Planning Date</p>
              <p className="text-xs text-blue-700">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Employee & Shift */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={12} className="text-indigo-500"/> Employee
                </label>
                <div className="block w-full border border-gray-200 rounded-xl shadow-sm bg-gray-100 text-sm p-3 text-gray-700 font-medium">
                  {activeEmployees.find((e: any) => (e._id || e.employeeId) === formData.employee)?.name || 'Unknown'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={12} className="text-indigo-500"/> Shift Assignment <span className="text-red-500">*</span>
                </label>
                <select 
                  required 
                  value={formData.shift} 
                  onChange={(e) => {
                    const s = shifts.find((sh: any) => sh.shiftName === e.target.value);
                    setFormData({ 
                      ...formData, 
                      shift: e.target.value,
                      startTime: s?.startTime || "",
                      endTime: s?.endTime || ""
                    });
                  }}
                  className="block w-full border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm p-3 transition-colors"
                >
                  <option value="">-- Choose Shift --</option>
                  {shifts.map((s: any) => (
                    <option key={s._id} value={s.shiftName}>
                      {s.shiftName} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                  <option value="Custom">Custom Shift</option>
                </select>
              </div>

              {formData.shift === "Custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Start Time</label>
                    <input type="time" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="block w-full border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-sm p-3" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">End Time</label>
                    <input type="time" required value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="block w-full border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-sm p-3" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={12} className="text-indigo-500"/> PPC Remarks
                </label>
                <textarea 
                  rows={3} 
                  placeholder="Specific instructions for this day..."
                  value={formData.remarks} 
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="block w-full border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm p-3 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Right Column: Machines Selection */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col h-full max-h-[400px]">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Cpu size={12} className="text-indigo-500"/> Assign Machines (Optional)
              </label>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {machines.map((m: any) => {
                  const isSelected = formData.machines?.includes(m._id);
                  return (
                    <div 
                      key={m._id}
                      onClick={() => toggleMachine(m._id)}
                      className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                          : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
                      }`}>
                        {isSelected && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {m.machineCode}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{m.machineName}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 mt-4 border-t border-gray-100 gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-2.5 border border-gray-200 shadow-sm text-sm font-bold rounded-xl text-gray-600 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formData.employee || !formData.shift}
              className="inline-flex justify-center items-center px-6 py-2.5 shadow-sm text-sm font-bold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all min-w-[140px]"
            >
              {creating ? <LoadingSpinner size="sm" color="white" /> : 'Save Assignment'}
            </button>
          </div>
          </form>
        </Modal>

        {/* Monthly Assignment Modal */}
        <Modal isOpen={!!selectedMonthEmployee} onClose={() => setSelectedMonthEmployee(null)} maxWidth="full">
          <div className="h-[90vh] w-full bg-white dark:bg-gray-900 overflow-hidden">
            {selectedMonthEmployee && (
              <EmployeeMonthlyAssignment employee={selectedMonthEmployee} baseDate={selectedDate} />
            )}
          </div>
        </Modal>
      </div>
  );
}
