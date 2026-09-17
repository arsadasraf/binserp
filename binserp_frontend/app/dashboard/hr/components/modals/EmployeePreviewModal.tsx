"use client";

import React from "react";
import {
  X,
  User,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  IndianRupee,
  Clock,
  IdCard,
  Edit2,
  RefreshCw,
  Building,
  Heart,
  Award,
  BookOpen,
} from "lucide-react";
import { Employee } from "../../types/hr.types";
import { CompanyCardDetails } from "@/src/utils/generateEmployeeCardPDF";

interface EmployeePreviewModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onDownloadIDCard: (employee: Employee) => Promise<void>;
  downloadingCardId: string | null;
  companyInfo: CompanyCardDetails;
}

export default function EmployeePreviewModal({
  employee,
  isOpen,
  onClose,
  onEdit,
  onDownloadIDCard,
  downloadingCardId,
  companyInfo,
}: EmployeePreviewModalProps) {
  if (!isOpen || !employee) return null;

  const isDownloading = downloadingCardId === employee._id;

  const getEmployeePerDay = (emp: Employee) => {
    const basis = emp.salary?.perDayCalculationBasis || "Gross";
    const divisorBasis = emp.salary?.dailyDivisorBasis || "TotalMonthDays";
    let base = 0;
    if (basis === "Gross") base = emp.salary?.grossSalary || 0;
    else if (basis === "Net") base = emp.salary?.netSalary || 0;
    else base = emp.salary?.basic || 0;

    const divisor = divisorBasis === "ApplicableWorkingDays" ? 26 : 30;
    return divisor > 0 ? Math.round((base / divisor) * 100) / 100 : 0;
  };

  return (
    <div className="animate-in backdrop-blur-sm bg-black/60 duration-200 fade-in fixed flex inset-0 items-center justify-center p-4 z-[999]">
      <div className="bg-white dark:bg-slate-900 flex flex-col max-h-[92vh] max-w-4xl overflow-hidden rounded-2xl shadow-2xl w-full border border-gray-100 dark:border-slate-800">
        {/* Modal Top Header with Quick Actions */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative overflow-hidden flex-shrink-0">
          {/* Subtle Background Geometric Accents */}
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            {/* Employee Avatar & Core Info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 p-0.5 border-2 border-white/20 shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
                {employee.photo ? (
                  <img
                    src={employee.photo}
                    alt={employee.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-2xl font-black text-indigo-200">
                    {employee.name?.charAt(0).toUpperCase() || "E"}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-extrabold tracking-tight text-white">
                    {employee.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      employee.status === "Active"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        employee.status === "Active" ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    {employee.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-indigo-200/80 font-mono">
                  <span className="bg-white/10 px-2 py-0.5 rounded-md font-bold text-white">
                    {employee.employeeId}
                  </span>
                  <span>•</span>
                  <span>{employee.designation || "No Designation"}</span>
                  <span>•</span>
                  <span>{employee.department || "No Department"}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 sm:self-center">
              <button
                onClick={() => onDownloadIDCard(employee)}
                disabled={isDownloading}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
                title="Download standard CR80 printable ID card PDF"
              >
                {isDownloading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <IdCard size={15} />
                )}
                <span>Download ID Card</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onEdit(employee);
                }}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95"
                title="Open full edit form"
              >
                <Edit2 size={14} />
                <span>Edit</span>
              </button>

              <button
                onClick={onClose}
                className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900/50">
          {/* Company Brand Watermark Bar */}
          {companyInfo.companyName && (
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-2">
                <Building size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold">Company: {companyInfo.companyName}</span>
              </div>
              {companyInfo.city && (
                <span className="text-indigo-600/80 dark:text-indigo-400/80 text-[11px]">
                  {companyInfo.city} {companyInfo.state ? `, ${companyInfo.state}` : ""}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ── CARD 1: PERSONAL & CONTACT ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <User size={14} className="text-blue-500" /> Personal & Contact Details
              </h4>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Gender</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.gender || "-"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 font-medium block mb-0.5 flex items-center gap-1">
                    <Heart size={11} className="text-red-500" /> Blood Group
                  </span>
                  <span className="font-extrabold text-red-600 dark:text-red-400">
                    {employee.bloodGroup || "-"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Date of Birth</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.dob ? new Date(employee.dob).toLocaleDateString("en-GB") : "-"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">ID Type</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.idType || "-"}
                  </span>
                </div>

                <div className="col-span-2 pt-2 border-t border-gray-100 dark:border-slate-700/60">
                  <span className="text-gray-400 font-medium block mb-0.5 flex items-center gap-1">
                    <Phone size={11} /> Contact Phone
                  </span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-200">
                    {employee.contact || "-"}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-gray-400 font-medium block mb-0.5 flex items-center gap-1">
                    <Mail size={11} /> Email Address
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                    {employee.email || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── CARD 2: JOB & EMPLOYMENT ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Briefcase size={14} className="text-indigo-500" /> Employment & Role
              </h4>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Department</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {employee.department || "-"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Designation</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {employee.designation || "-"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Employee Type</span>
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 font-bold px-2 py-0.5 rounded text-[11px]">
                    {employee.employeeType || "Full-Time"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 font-medium block mb-0.5 flex items-center gap-1">
                    <Calendar size={11} /> Joining Date
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.joiningDate
                      ? new Date(employee.joiningDate).toLocaleDateString("en-GB")
                      : "-"}
                  </span>
                </div>

                <div className="col-span-2 pt-2 border-t border-gray-100 dark:border-slate-700/60">
                  <span className="text-gray-400 font-medium block mb-0.5 flex items-center gap-1">
                    <Award size={11} /> Prior Experience
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.experience || "None specified"}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-gray-400 font-medium block mb-0.5 flex items-center gap-1">
                    <BookOpen size={11} /> Highest Degree
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.degree || "None specified"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── CARD 3: LEAVES & DUTY POLICIES ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Clock size={14} className="text-amber-500" /> Leave Balances & Duty Hours
              </h4>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">
                    Casual Leave
                  </span>
                  <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                    {employee.leaves?.casualLeave || 0}
                  </span>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-purple-500 uppercase block mb-1">
                    Sick Leave
                  </span>
                  <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                    {employee.leaves?.sickLeave || 0}
                  </span>
                </div>

                <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-teal-500 uppercase block mb-1">
                    Comp Off
                  </span>
                  <span className="text-lg font-black text-teal-700 dark:text-teal-300">
                    {employee.compOffBalance || 0}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-gray-100 dark:border-slate-700/60">
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Standard Hours</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-200">
                    {employee.standardWorkingHours || 9} hrs/day
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Weekly Off</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {Array.isArray(employee.weeklyOff) && employee.weeklyOff.length > 0
                      ? employee.weeklyOff.join(", ")
                      : "Sunday"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── CARD 4: SALARY & PAYMENT ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <IndianRupee size={14} className="text-emerald-500" /> Salary & Bank Details
              </h4>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block mb-1">
                    Gross Salary
                  </span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">
                    ₹{(employee.salary?.grossSalary || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block mb-1">
                    Net Salary
                  </span>
                  <span className="text-sm font-black text-blue-700 dark:text-blue-300 font-mono">
                    ₹{(employee.salary?.netSalary || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block mb-1 flex items-center justify-between">
                    <span>Per Day</span>
                    <span className="text-[9px] font-normal text-indigo-500 lowercase">
                      {employee.salary?.perDayCalculationBasis || "Gross"}/{employee.salary?.dailyDivisorBasis === "ApplicableWorkingDays" ? "26d" : "30d"}
                    </span>
                  </span>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 font-mono">
                    ₹{getEmployeePerDay(employee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-700/60">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bank Name:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {employee.paymentDetails?.bankName || "Not configured"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Account No:</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                    {employee.paymentDetails?.accountNumber || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IFSC Code:</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                    {employee.paymentDetails?.ifscCode || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-400">
            Clicking &quot;Download ID Card&quot; generates a 2-page CR80 printable card PDF.
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onDownloadIDCard(employee)}
              disabled={isDownloading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isDownloading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <IdCard size={14} />
              )}
              <span>Download ID Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
