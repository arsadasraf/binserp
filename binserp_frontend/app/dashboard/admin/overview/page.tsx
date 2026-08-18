"use client";

import { useState, useEffect } from "react";
import { useHeader } from "@/src/context/HeaderContext";
import { 
  useGetCompanyProfileQuery, 
  useUpdateCompanySettingsMutation 
} from "@/src/store/services/companyService";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import Swal from "sweetalert2";
import { 
  Building2, 
  Lock, 
  Database, 
  Mail, 
  Phone, 
  MapPin, 
  Save, 
  ShieldAlert,
  Map,
  FileSpreadsheet,
  CheckCircle2,
  Globe,
  Briefcase,
  Layers,
  Truck,
  Hash,
  RotateCcw,
  Sparkles,
  Copy
} from "lucide-react";

const INDIA_LOCATIONS: Record<string, string[]> = {
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
  "Delhi": ["New Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat"],
  "Uttar Pradesh": ["Noida", "Ghaziabad", "Lucknow", "Kanpur"]
};

const COMPANY_TYPES = [
  "Job Work / Contract Manufacturing",
  "OEM (Own Product Manufacturer)",
  "Supplier / Component Supplier"
];

const SERVICES = [
  "Sheet Metal Fabrication",
  "CNC Machining",
  "Foundry / Casting",
  "Forging",
  "Plastic Injection Molding",
  "Rubber Molding",
  "Electrical & Electronics Manufacturing",
  "Packaging Manufacturing",
  "Textile & Garment Manufacturing",
  "Surface Treatment & Coating"
];

export default function CompanyOverview() {
  const { setHeader } = useHeader();
  const { data: company, isLoading, isError, refetch } = useGetCompanyProfileQuery();
  const [updateCompanySettings, { isLoading: isUpdating }] = useUpdateCompanySettingsMutation();

  const [form, setForm] = useState({
    companyName: "",
    companyType: "",
    service: "",
    contactNumber: "",
    state: "",
    city: "",
    pincode: "",
    billingAddress: "",
    shippingAddress: ""
  });

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setHeader("Company Profile", "View and update your company registration details.");
  }, [setHeader]);

  const populateForm = (data: any) => {
    if (!data) return;
    setForm({
      companyName: data.companyName || "",
      companyType: data.companyType || "",
      service: data.service || "",
      contactNumber: data.contactNumber || "",
      state: data.state || "",
      city: data.city || "",
      pincode: data.pincode || "",
      billingAddress: data.billingAddress || "",
      shippingAddress: data.shippingAddress || ""
    });
  };

  useEffect(() => {
    if (company) {
      populateForm(company);
    }
  }, [company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "state") {
      setForm(prev => ({ ...prev, state: value, city: "" }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCopyBillingToShipping = () => {
    setForm(prev => ({ ...prev, shippingAddress: prev.billingAddress }));
  };

  const handleReset = () => {
    if (company) {
      populateForm(company);
      setErrorMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Validation
    if (!form.companyName || !form.companyType || !form.service || !form.contactNumber || !form.state || !form.city) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      await updateCompanySettings(form).unwrap();
      
      Swal.fire({
        icon: "success",
        title: "Profile Updated",
        text: "Company details have been updated successfully!",
        confirmButtonColor: "#4f46e5",
        customClass: {
          popup: "rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 dark:bg-slate-900",
          title: "text-xl font-bold text-gray-950 dark:text-white",
          htmlContainer: "text-gray-600 dark:text-gray-300"
        }
      });
      refetch();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || "Failed to update profile. Please try again.";
      setErrorMessage(errMsg);
      
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: errMsg,
        confirmButtonColor: "#ef4444"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4 w-full">
        <LoadingSpinner size="lg" />
        <p className="text-gray-500 font-medium animate-pulse">Loading company profile details...</p>
      </div>
    );
  }

  if (isError || !company) {
    return (
      <div className="w-full p-6 sm:p-10">
        <div className="max-w-3xl mx-auto bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-2xl p-8 text-center shadow-sm">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-950 dark:text-red-200 mb-2">Failed to Load Profile</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            Could not load company details. Please check your network connection and try again.
          </p>
          <button 
            onClick={() => refetch()} 
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full pb-20 px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
      
      {/* ─── Hero Overview Banner (Full Width Responsive) ──────────────── */}
      <div className="w-full relative group overflow-hidden rounded-3xl p-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-md">
        <div className="relative bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-[1.4rem] p-5 sm:p-7 border border-white/60 dark:border-slate-800/60 transition-all duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Company Identity */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg shadow-indigo-500/25 shrink-0 ring-4 ring-indigo-50 dark:ring-indigo-950/50">
                {form.companyName ? form.companyName.charAt(0).toUpperCase() : "C"}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {company.companyName || form.companyName || "Organization Profile"}
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Active Account
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5 flex-wrap">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>{form.companyType || company.companyType || "Company"}</span>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{form.service || company.service || "Manufacturing"}</span>
                </p>
              </div>
            </div>

            {/* Quick Metadata Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto shrink-0">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60">
                <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Email</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate block max-w-[160px]" title={company.email}>
                    {company.email || "N/A"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60">
                <Hash className="w-4 h-4 text-purple-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Company ID</span>
                  <span className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 truncate block">
                    {company.companyId || "N/A"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60">
                <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Database</span>
                  <span className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 truncate block">
                    {company.dbName || "N/A"}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Metric Cards Strip (Full Width) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Entity Structure</span>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={form.companyType}>
              {form.companyType || "Unassigned"}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Manufacturing Sector</span>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={form.service}>
              {form.service || "Unassigned"}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Official Contact</span>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={form.contactNumber}>
              {form.contactNumber || "Not Provided"}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Location Hub</span>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={`${form.city || ''}, ${form.state || ''}`}>
              {form.city && form.state ? `${form.city}, ${form.state}` : (form.state || "Not configured")}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Form Section (Fully Scalable Multi-Column Grid) ─────────── */}
      <form onSubmit={handleSubmit} className="w-full space-y-6">
        
        {errorMessage && (
          <div className="w-full p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-start gap-3 animate-in fade-in">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
          </div>
        )}

        {/* 2-Column Responsive Grid on Desktop */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* Card 1: Core Company Profile */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-7 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Business Information</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Basic enterprise identification and industry classification</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mt-5">
                {/* Company Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Registered Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={form.companyName}
                    onChange={handleChange}
                    required
                    placeholder="Enter official company name"
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
                  />
                </div>

                {/* Company Type */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Company Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="companyType"
                    value={form.companyType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
                  >
                    <option value="" disabled>Select Type</option>
                    {COMPANY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Service Domain */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Main Service / Sector <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="service"
                    value={form.service}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
                  >
                    <option value="" disabled>Select Service Sector</option>
                    {SERVICES.map(srv => (
                      <option key={srv} value={srv}>{srv}</option>
                    ))}
                  </select>
                </div>

                {/* Contact Phone */}
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" /> Official Contact Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={form.contactNumber}
                    onChange={handleChange}
                    required
                    pattern="(\+?[0-9\s\-]{10,18})"
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Geographical & Regional Details */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-7 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Regional Location</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Territory jurisdiction, state, and pincode configuration</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mt-5">
                {/* State */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Map className="w-3.5 h-3.5 text-gray-400" /> State <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
                  >
                    <option value="" disabled>Select State</option>
                    {Object.keys(INDIA_LOCATIONS).map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" /> City / District <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                    disabled={!form.state}
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>{form.state ? "Select City" : "Select State First"}</option>
                    {form.state && INDIA_LOCATIONS[form.state]?.map(cty => (
                      <option key={cty} value={cty}>{cty}</option>
                    ))}
                  </select>
                </div>

                {/* Pincode */}
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-gray-400" /> Postal PIN Code
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={form.pincode}
                    onChange={handleChange}
                    placeholder="Enter 6-digit postal PIN code"
                    className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Card 3: Billing & Shipping Address (Side by Side on Wide Screens) */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-7 border border-gray-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Registered Addresses</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Official taxation, invoicing, and material shipment addresses</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyBillingToShipping}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition cursor-pointer self-start sm:self-auto"
              title="Copy Billing Address to Shipping Address"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Billing to Shipping</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Billing Address */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Billing Address (Invoicing)
              </label>
              <textarea
                name="billingAddress"
                value={form.billingAddress}
                onChange={handleChange}
                rows={4}
                placeholder="Enter complete legal billing address with building no, street, and landmark"
                className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none resize-y font-normal"
              />
            </div>

            {/* Shipping Address */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-sky-500" /> Shipping Address (Factory / Warehouse)
              </label>
              <textarea
                name="shippingAddress"
                value={form.shippingAddress}
                onChange={handleChange}
                rows={4}
                placeholder="Enter physical factory / warehouse delivery address for dispatch and goods receipts"
                className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white dark:focus:bg-slate-900 text-sm text-gray-900 dark:text-white transition shadow-sm outline-none resize-y font-normal"
              />
            </div>
          </div>
        </div>

        {/* ─── Bottom Actions Bar (Full Width Responsive) ─────────────── */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={isUpdating}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Discard Changes</span>
          </button>

          <button
            type="submit"
            disabled={isUpdating}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 text-sm"
          >
            {isUpdating ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Settings</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}

