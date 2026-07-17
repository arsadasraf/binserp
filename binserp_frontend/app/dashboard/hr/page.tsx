"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import HRTabs from "./components/HRTabs";
import HRHomeTab from "./components/HRHomeTab";
import DepartmentMaster from "./components/masters/DepartmentMaster";
import DesignationMaster from "./components/masters/DesignationMaster";
import EmployeeMaster from "./components/masters/EmployeeMaster";
import EmployeeTypeMaster from "./components/masters/EmployeeTypeMaster";
import FaceDataMaster from "./components/masters/FaceDataMaster";
import HolidayMaster from "./components/masters/HolidayMaster";
import HRKioskTab from "./components/HRKioskTab";
import PresentTab from "./components/PresentTab";
import SalariesTab from "./components/SalariesTab";
import LoadingSpinner from "@/src/components/LoadingSpinner";

import { useHeader } from "@/src/context/HeaderContext";
import HRPrefixSettingsForm from "./components/forms/HRPrefixSettingsForm";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
// ... (other imports)

function HRPageContent() {
  const { setHeader } = useHeader();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as "home" | "master" | "attendance" | "present" | "salaries") || "home";

  // State for Master sub-tabs
  const [activeMasterTab, setActiveMasterTab] = useState<"employee" | "employee-type" | "department" | "designation" | "face-data" | "holiday" | "prefix">("employee");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    setHeader("HR Dashboard", "Manage employees, departments, and attendance");
  }, [setHeader]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-20 sm:pb-8">
      <div className="p-2 max-w-[1600px] mx-auto">

        {/* Alerts */}
        <div className="max-w-4xl mb-6">
          {error && <ErrorAlert message={error} onClose={() => setError("")} />}
          {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}
        </div>

        <HRTabs activeTab={activeTab} />

        <div className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "home" && <HRHomeTab />}

          {activeTab === "master" && (
            <div className="space-y-6">
              {/* Master Sub-tabs: Modern Pill Design */}
              <div className="flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit shadow-sm">
                <button
                  onClick={() => setActiveMasterTab("employee")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "employee"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Employee
                </button>
                <button
                  onClick={() => setActiveMasterTab("employee-type")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "employee-type"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Employee Type
                </button>
                <button
                  onClick={() => setActiveMasterTab("department")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "department"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Department
                </button>
                <button
                  onClick={() => setActiveMasterTab("designation")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "designation"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Designation
                </button>
                <button
                  onClick={() => setActiveMasterTab("face-data")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "face-data"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Face Data
                </button>
                <button
                  onClick={() => setActiveMasterTab("holiday")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "holiday"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Holidays
                </button>
                <button
                  onClick={() => setActiveMasterTab("prefix")}
                  className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${activeMasterTab === "prefix"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                >
                  Settings
                </button>
              </div>

              {/* Content Area with premium card styling */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                {activeMasterTab === "employee" && <EmployeeMaster />}
                {activeMasterTab === "employee-type" && <EmployeeTypeMaster />}
                {activeMasterTab === "department" && <DepartmentMaster />}
                {activeMasterTab === "designation" && <DesignationMaster />}
                {activeMasterTab === "face-data" && <FaceDataMaster />}
                {activeMasterTab === "holiday" && <HolidayMaster />}
                {activeMasterTab === "prefix" && (
                  <HRPrefixSettingsForm
                    token={token}
                    onSuccess={(msg) => setSuccess(msg)}
                    onError={(msg) => setError(msg)}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "attendance" && <HRKioskTab />}
          {activeTab === "present" && <PresentTab />}
          {activeTab === "salaries" && <SalariesTab />}
        </div>
      </div>
    </div>
  );
}

export default function HRPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HRPageContent />
    </Suspense>
  );
}
