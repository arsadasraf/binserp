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
  FileSpreadsheet
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

  useEffect(() => {
    if (company) {
      setForm({
        companyName: company.companyName || "",
        companyType: company.companyType || "",
        service: company.service || "",
        contactNumber: company.contactNumber || "",
        state: company.state || "",
        city: company.city || "",
        pincode: company.pincode || "",
        billingAddress: company.billingAddress || "",
        shippingAddress: company.shippingAddress || ""
      });
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
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-500 animate-pulse">Loading profile details...</p>
      </div>
    );
  }

  if (isError || !company) {
    return (
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-2xl p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-950 dark:text-red-200 mb-2">Failed to Load Profile</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Could not load company details. Please check your network connection and try again.
          </p>
          <button 
            onClick={() => refetch()} 
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium shadow-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950/50 pb-24 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
        {/* Welcome Header Summary */}
        <div className="relative group overflow-hidden rounded-3xl bg-transparent p-1 shadow-lg shadow-indigo-500/5 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-80 blur-xl group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative bg-white/95 dark:bg-slate-900/90 backdrop-blur-3xl rounded-[1.4rem] p-6 sm:p-8 border border-white/50 dark:border-slate-800/50">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl font-extrabold shadow-inner shrink-0">
                {form.companyName ? form.companyName.charAt(0) : "C"}
              </div>
              <div className="text-center sm:text-left flex-1">
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 mb-1.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {company.companyName}
                  </h2>
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide border border-indigo-100/55 dark:border-indigo-800/40">
                    {company.companyType}
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Registered Email: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{company.email}</span>
                </p>
                
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  CompanyId: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{company.companyId}</span>
                </p>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Company Dtabase: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{company.dbName}</span>
                </p>
                
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="w-full gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-slate-850 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4.5 h-4.5 text-indigo-500" /> Edit Registration Details
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Update company type, contact numbers, and registered address information.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Company Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      value={form.companyName}
                      onChange={handleChange}
                      required
                      placeholder="Enter company name"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white shadow-inner"
                    />
                  </div>

                  {/* Company Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Company Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="companyType"
                      value={form.companyType}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white bg-no-repeat bg-right pr-10"
                    >
                      <option value="" disabled>Select Company Type</option>
                      {COMPANY_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Service Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Main Service <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="service"
                      value={form.service}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white bg-no-repeat bg-right pr-10"
                    >
                      <option value="" disabled>Select Service</option>
                      {SERVICES.map(srv => (
                        <option key={srv} value={srv}>{srv}</option>
                      ))}
                    </select>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-gray-400" /> Contact Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={form.contactNumber}
                      onChange={handleChange}
                      required
                      pattern="(\+?[0-9\s\-]{10,18})"
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white shadow-inner"
                    />
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Pincode
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      placeholder="Enter pincode"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white shadow-inner"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Map className="w-4 h-4 text-gray-400" /> State <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white bg-no-repeat bg-right pr-10"
                    >
                      <option value="" disabled>Select State</option>
                      {Object.keys(INDIA_LOCATIONS).map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" /> City <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      required
                      disabled={!form.state}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white disabled:bg-gray-50 disabled:dark:bg-slate-950 disabled:text-gray-400 disabled:cursor-not-allowed bg-no-repeat bg-right pr-10"
                    >
                      <option value="" disabled>Select City</option>
                      {form.state && INDIA_LOCATIONS[form.state]?.map(cty => (
                        <option key={cty} value={cty}>{cty}</option>
                      ))}
                    </select>
                  </div>

                  {/* Billing Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-gray-400" /> Billing Address
                    </label>
                    <textarea
                      name="billingAddress"
                      value={form.billingAddress}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Enter company billing address"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white shadow-inner resize-y"
                    />
                  </div>

                  {/* Shipping Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" /> Shipping Address
                    </label>
                    <textarea
                      name="shippingAddress"
                      value={form.shippingAddress}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Enter company shipping address"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm text-gray-900 dark:text-white shadow-inner resize-y"
                    />
                  </div>
                </div>

                {/* Save button and state */}
                <div className="pt-4 border-t border-gray-200 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-8 py-3.5 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {isUpdating ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Saving Settings...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
