"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import { API_BASE_URL } from "@/src/utils/config";
import { persistSession } from "@/src/lib/session";
import {
  Building2,
  Factory,
  Cpu,
  Package,
  CheckCircle2,
  MapPin,
  Phone,
  Hash,
  ArrowRight,
  Check
} from "lucide-react";

const INDIA_LOCATIONS: Record<string, string[]> = {
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane", "Kolhapur", "Solapur"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Tumakuru"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Hosur"],
  "Delhi": ["New Delhi", "North Delhi", "South Delhi", "West Delhi", "East Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Sonipat", "Manesar"],
  "Uttar Pradesh": ["Noida", "Greater Noida", "Ghaziabad", "Lucknow", "Kanpur", "Agra"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Bhiwadi", "Kota", "Alwar"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Mohali", "Patiala"]
};

const COMPANY_TYPES = [
  {
    id: "Job Work / Contract Manufacturing",
    title: "Job Work",
    subtitle: "Contract manufacturing & machining",
    icon: Factory,
  },
  {
    id: "OEM (Own Product Manufacturer)",
    title: "OEM Manufacturer",
    subtitle: "Finished machinery & products",
    icon: Cpu,
  },
  {
    id: "Supplier / Component Supplier",
    title: "Component Supplier",
    subtitle: "Parts & raw materials supplier",
    icon: Package,
  },
];

const SERVICES_LIST = [
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

export default function RegisterStep1() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    companyType: "",
    service: [] as string[],
    email: "",
    contactNumber: "",
    state: "",
    city: "",
    pincode: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const googleEmail = searchParams.get("googleEmail");
      const googleName = searchParams.get("googleName");

      if (googleEmail) {
        setForm((f) => ({
          ...f,
          email: googleEmail,
          companyName: googleName ? decodeURIComponent(googleName) : f.companyName,
        }));
        setIsGoogleAuth(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "state") {
      setForm({ ...form, state: value, city: "" });
    } else if (name === "companyType") {
      setForm({ ...form, companyType: value, service: [] });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleCompanyTypeSelect = (typeId: string) => {
    setForm((prev) => ({
      ...prev,
      companyType: typeId,
      service: typeId === "OEM (Own Product Manufacturer)" ? [] : prev.service,
    }));
  };

  const handleServiceToggle = (serviceName: string) => {
    setForm((prev) => {
      const currentServices = prev.service || [];
      if (currentServices.includes(serviceName)) {
        return { ...prev, service: currentServices.filter((s) => s !== serviceName) };
      } else {
        return { ...prev, service: [...currentServices, serviceName] };
      }
    });
  };

  const handleGoogleAuthRedirect = () => {
    const baseUrl = API_BASE_URL || "http://localhost:8000";
    const origin = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
    window.location.href = `${baseUrl.replace(/\/api$/, "")}/api/auth/google?origin=${origin}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.companyType) {
      setError("Please select your Company Type to continue.");
      return;
    }

    if (form.companyType !== "OEM (Own Product Manufacturer)" && form.service.length === 0) {
      setError("Please select at least one manufacturing service/capability.");
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = API_BASE_URL;
      const response = await fetch(`${apiUrl}/api/company/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response. Please verify the backend service is running.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      if (data.token) {
        persistSession({
          token: data.token,
          userType: "company",
          user: data.company,
        });
      }

      setSuccess("Registration completed successfully! Launching your ERP dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-2xl bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/25 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-10 h-10 relative">
              <Image src="/icon.svg" alt="BinsErp Logo" fill sizes="40px" className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight cursor-pointer" onClick={() => router.push("/")}>
            BinsErp
          </h1>
          <p className="text-sm text-slate-500 mt-1">Register your manufacturing company details below</p>
        </div>

        {/* PRE-AUTH STATE: Google Authentication */}
        {!isGoogleAuth ? (
          <div className="space-y-6 text-center py-4">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 max-w-lg mx-auto">
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Company accounts are managed via Google Authentication. Sign in with your Google email to verify your domain and create your workspace.
              </p>

              <button
                type="button"
                onClick={handleGoogleAuthRedirect}
                className="w-full py-3.5 px-6 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight size={16} className="text-slate-400 ml-auto" />
              </button>
            </div>
          </div>
        ) : (
          /* POST-AUTH STATE: Clean Registration Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Verified Account Notification */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-emerald-900 block">Google Account Verified</span>
                  <span className="text-xs text-emerald-700 font-mono block">{form.email}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  name="companyName"
                  placeholder="Enter your company / plant name"
                  value={form.companyName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition"
                />
              </div>
            </div>

            {/* Company Type Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Company Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {COMPANY_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = form.companyType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleCompanyTypeSelect(type.id)}
                      className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-600 text-indigo-900 ring-1 ring-indigo-600"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div className={`p-1.5 rounded-lg ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                          <Icon size={15} />
                        </div>
                        {isSelected && <Check size={14} className="text-indigo-600 font-bold" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{type.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{type.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Services / Capabilities Chips */}
            {form.companyType && form.companyType !== "OEM (Own Product Manufacturer)" && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Services / Capabilities <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-indigo-600 font-medium">Select all that apply</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {SERVICES_LIST.map((service) => {
                    const isChecked = form.service.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => handleServiceToggle(service)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isChecked
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {isChecked && <Check size={12} className="stroke-[3]" />}
                        <span>{service}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contact & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Contact Phone <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="tel"
                    name="contactNumber"
                    placeholder="+91 98765 43210"
                    value={form.contactNumber}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  State <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <select
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 text-xs font-medium text-slate-900 outline-none bg-white"
                  >
                    <option value="" disabled>Select State</option>
                    {Object.keys(INDIA_LOCATIONS).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  City <span className="text-rose-500">*</span>
                </label>
                <select
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  disabled={!form.state}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 text-xs font-medium text-slate-900 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="" disabled>Select City</option>
                  {form.state && INDIA_LOCATIONS[form.state]?.map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Pincode
                </label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    name="pincode"
                    placeholder="Enter pincode"
                    value={form.pincode}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none"
                  />
                </div>
              </div>
            </div>

            {error && <ErrorAlert message={error} onClose={() => setError("")} />}
            {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Completing Registration...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration & Open ERP</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Sign-in Link */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold ml-1">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
