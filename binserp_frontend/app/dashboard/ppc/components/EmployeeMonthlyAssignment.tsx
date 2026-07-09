"use client";

import { useState, useMemo } from "react";
import { Clock, Cpu, Calendar as CalendarIcon, Save, Trash2, X, AlertCircle } from "lucide-react";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import {
  useGetMachinesQuery,
  useGetShiftsQuery,
  useGetManpowerAllotmentsQuery,
  useCreateManpowerAllotmentMutation,
  useDeleteManpowerAllotmentMutation
} from "@/src/store/services/ppcService";

export default function EmployeeMonthlyAssignment({ employee, baseDate }: { employee: any; baseDate: string }) {
  const [assigningDate, setAssigningDate] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    shift: "",
    startTime: "",
    endTime: "",
    machines: [],
    remarks: ""
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: machines = [] } = useGetMachinesQuery();
  const { data: shifts = [] } = useGetShiftsQuery();

  const currentYear = new Date(baseDate).getFullYear();
  const currentMonth = new Date(baseDate).getMonth();
  
  // Start and end of month strings for the API
  const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
  const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

  const { data: allotments = [], isLoading } = useGetManpowerAllotmentsQuery({
    startDate: monthStart,
    endDate: monthEnd
  });

  const [createAllotment, { isLoading: creating }] = useCreateManpowerAllotmentMutation();
  const [deleteAllotment] = useDeleteManpowerAllotmentMutation();

  const employeeAllotments = useMemo(() => {
    return allotments.filter((a: any) => a.employee?._id === (employee?.employeeId || employee?._id));
  }, [allotments, employee]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday, 6 = Saturday

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentYear, currentMonth, i + 1);
    const offset = d.getTimezoneOffset() * 60000;
    const localIso = new Date(d.getTime() - offset).toISOString().split('T')[0];
    return {
      dateStr: localIso,
      dayNumber: i + 1,
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    };
  });

  const emptyStartDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const handleSave = async () => {
    if (!assigningDate || !formData.shift) return;
    setSubmitError(null);
    try {
      const payload = {
        ...formData,
        employee: employee._id || employee.employeeId,
        date: assigningDate
      };
      
      // DEBUG: Throw error so it shows up in Next.js overlay
      if (!payload.employee || !payload.date || !payload.shift) {
         throw new Error("DEBUG PAYLOAD MISSING FIELD: " + JSON.stringify(payload));
      }

      await createAllotment(payload).unwrap();
      
      // Optionally reset form if you want, but keeping it open allows quick adjustments
      // setAssigningDate(null);
    } catch (error: any) {
      setSubmitError(`Payload: ${JSON.stringify({ employee: employee?._id || employee?.employeeId, shift: formData.shift, date: assigningDate })} | Error: ${error?.data?.message || error?.message || JSON.stringify(error)}`);
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

  const handleDateClick = (dateStr: string) => {
    setAssigningDate(dateStr);
    const existing = employeeAllotments.find((a: any) => a.date.startsWith(dateStr));
    
    if (existing) {
      setFormData({
        shift: existing.shift || "",
        startTime: existing.startTime || "",
        endTime: existing.endTime || "",
        machines: (existing.machines || []).map((m: any) => m._id),
        remarks: existing.remarks || ""
      });
    } else {
      setFormData({ shift: "", startTime: "", endTime: "", machines: [], remarks: "" });
    }
  };

  const removeAssignment = async (id: string) => {
    if (confirm("Are you sure you want to remove this assignment?")) {
      await deleteAllotment(id);
      // Reset form if the deleted one was being viewed
      setFormData({ shift: "", startTime: "", endTime: "", machines: [], remarks: "" });
    }
  };

  const getDayAllotments = (dateStr: string) => employeeAllotments.filter((a: any) => a.date.startsWith(dateStr));

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="text-indigo-600" />
            {new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
             <span className="font-semibold text-indigo-700 dark:text-indigo-400">{employee?.name}</span> 
             <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">ID: {employee?.empCode || employee?.employeeId}</span>
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        
        {/* LEFT: Calendar Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid Cells */}
              <div className="grid grid-cols-7 gap-2">
                {emptyStartDays.map(empty => (
                  <div key={`empty-${empty}`} className="min-h-[100px] bg-transparent rounded-xl" />
                ))}

                {calendarDays.map((day) => {
                  const dayAllotments = getDayAllotments(day.dateStr);
                  const isSelected = assigningDate === day.dateStr;
                  const hasAssignment = dayAllotments.length > 0;

                  return (
                    <div 
                      key={day.dateStr}
                      onClick={() => handleDateClick(day.dateStr)}
                      className={`
                        min-h-[100px] p-2 rounded-xl border-2 transition-all cursor-pointer relative group flex flex-col
                        ${isSelected ? 'border-indigo-500 shadow-md bg-indigo-50/30 dark:bg-indigo-900/20' : 'border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 shadow-sm'}
                        ${day.isWeekend && !isSelected ? 'bg-red-50/30 dark:bg-red-900/10' : ''}
                      `}
                    >
                      {/* Date Number */}
                      <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-2
                        ${day.isWeekend ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}
                        ${isSelected ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-100' : ''}
                      `}>
                        {day.dayNumber}
                      </div>

                      {/* Assignment Indicators */}
                      <div className="flex-1 flex flex-col gap-1">
                        {hasAssignment ? (
                          dayAllotments.map((a: any) => (
                            <div key={a._id} className="w-full flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded truncate">
                                <Clock size={10} className="shrink-0" /> {a.shift}
                              </span>
                              {a.machines && a.machines.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded border border-gray-200 truncate">
                                  <Cpu size={10} className="shrink-0" /> {a.machines.length} Machine(s)
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              Click to Assign
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Assignment Panel */}
        <div className="w-full lg:w-96 bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 overflow-y-auto shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 shrink-0">
          {!assigningDate ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <CalendarIcon size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium text-gray-500">Select a day from the calendar to assign or edit a shift.</p>
            </div>
          ) : (
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Planning Form</h3>
                  <p className="text-sm font-medium text-indigo-600">
                    {new Date(assigningDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setAssigningDate(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6">
                {/* Shift Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Select Shift <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={formData.shift} 
                    onChange={e => {
                      const s = shifts.find((sh: any) => sh.shiftName === e.target.value);
                      setFormData({ ...formData, shift: e.target.value, startTime: s?.startTime || "", endTime: s?.endTime || "" });
                    }}
                    className="w-full border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm p-3 transition-colors"
                  >
                    <option value="">-- Choose Shift --</option>
                    {shifts.map((s: any) => (
                      <option key={s._id} value={s.shiftName}>
                        {s.shiftName} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Machine Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Assign Machines (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {machines.map((m: any) => {
                      const isSelected = formData.machines.includes(m._id);
                      return (
                        <button
                          key={m._id}
                          onClick={() => toggleMachine(m._id)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                            isSelected 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Cpu size={12} className="shrink-0" /> 
                            <span className="truncate">{m.machineCode}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {machines.length === 0 && (
                     <div className="text-xs text-gray-400 italic p-2 bg-gray-50 rounded-lg border border-dashed">No machines available.</div>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Remarks (Optional)
                  </label>
                  <textarea 
                    value={formData.remarks} 
                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm p-3 transition-colors min-h-[80px]"
                    placeholder="E.g. overtime required, machine maintenance scheduled..."
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-mono break-all">
                    {submitError}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
                <button
                  onClick={handleSave}
                  disabled={!formData.shift || creating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? <LoadingSpinner size="sm" color="white" /> : <><Save size={18} /> Save Day Plan</>}
                </button>
                
                {getDayAllotments(assigningDate).length > 0 && (
                  <button
                    onClick={() => removeAssignment(getDayAllotments(assigningDate)[0]._id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-all"
                  >
                    <Trash2 size={18} /> Remove Existing Shift
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
