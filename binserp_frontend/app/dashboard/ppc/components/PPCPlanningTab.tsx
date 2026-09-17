import React, { useState } from 'react';
import { ClipboardList, Calendar, Cpu, Users } from 'lucide-react';
import MachineAssignmentBoard from './MachineAssignmentBoard';
import PlanningBoard from './PlanningBoard';
import PPCDailyAssignmentTab from './PPCDailyAssignmentTab';

type PlanningSubTab = "assignments" | "board";

export default function PPCPlanningTab() {
  const [subTab, setSubTab] = useState<PlanningSubTab>("assignments");
  const [assignmentType, setAssignmentType] = useState<"machines" | "employees">("machines");

  const tabs = [
    { id: "assignments" as PlanningSubTab, label: "Assignments", icon: ClipboardList },
    { id: "board" as PlanningSubTab, label: "Planning Board", icon: Calendar },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tab strip */}
      <div className="flex gap-2 flex-wrap items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
              subTab === id
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">

        {/* ASSIGNMENTS TAB */}
        {subTab === "assignments" && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setAssignmentType("machines")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  assignmentType === "machines"
                    ? "bg-white text-indigo-600 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Cpu size={16} />
                Machine Jobs
              </button>
              <button
                onClick={() => setAssignmentType("employees")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  assignmentType === "employees"
                    ? "bg-white text-indigo-600 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Users size={16} />
                Employee Shifts
              </button>
            </div>

            {assignmentType === "machines" ? <MachineAssignmentBoard /> : <PPCDailyAssignmentTab />}
          </div>
        )}

        {/* PLANNING BOARD TAB */}
        {subTab === "board" && (
          <div className="min-h-[600px]">
            <PlanningBoard />
          </div>
        )}
      </div>
    </div>
  );
}
