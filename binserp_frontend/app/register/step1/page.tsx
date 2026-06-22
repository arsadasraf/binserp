"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/src/components/Navbar";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import { API_BASE_URL } from "@/src/utils/config";
import { persistSession } from "@/src/lib/session";

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

export default function RegisterStep1() {
    const router = useRouter();
    const [form, setForm] = useState({
        companyName: "",
        companyType: "", // Default empty
        service: "", // Default empty
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
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            const googleEmail = searchParams.get('googleEmail');
            const googleName = searchParams.get('googleName');

            if (googleEmail) {
                setForm(f => ({
                    ...f,
                    email: googleEmail,
                    companyName: googleName ? decodeURIComponent(googleName) : f.companyName
                }));
                setIsGoogleAuth(true);
                // Clean up URL visually
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "state") {
            setForm({ ...form, state: value, city: "" });
        } else {
            setForm({ ...form, [name]: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
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

            // Check if response is JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server returned an invalid response. Please make sure the backend server is running.");
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

            setSuccess("Registration completed successfully! Redirecting...");
            setTimeout(() => {
                router.push(`/dashboard`);
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* <Navbar /> */}
            <main className="flex items-center justify-center py-12 px-6">
                <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-2xl border border-gray-100">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
                            <svg
                                className="w-8 h-8 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            Register Your Company
                        </h2>
                        <p className="text-gray-600">Enter your details below to create an account.</p>
                    </div>

                    {!isGoogleAuth ? (
                        <div className="mb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    const baseUrl = API_BASE_URL || 'http://localhost:8000';
                                    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
                                    window.location.href = `${baseUrl.replace(/\/api$/, '')}/api/auth/google?origin=${origin}`;
                                }}
                                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none transition-colors"
                            >
                                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>
                        </div>
                    ) : (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start">
                            <svg className="w-6 h-6 text-indigo-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <p className="text-sm text-indigo-800">
                                <strong>Google Account Verified!</strong><br />
                                Please complete your company details below to finish registration.
                            </p>
                        </div>
                    )}

                    {isGoogleAuth && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Company Name *
                                </label>
                                <input
                                    type="text"
                                    name="companyName"
                                    placeholder="Enter company name"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                                    value={form.companyName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>


                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Company Type *
                                </label>
                                <select
                                    name="companyType"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white text-sm md:text-base"
                                    value={form.companyType}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="" disabled>Select Company Type</option>
                                    <option className="text-xs md:text-sm" value="Job Work / Contract Manufacturing">Job Work / Contract Manufacturing</option>
                                    <option className="text-xs md:text-sm" value="OEM (Own Product Manufacturer)">OEM (Own Product Manufacturer)</option>
                                    <option className="text-xs md:text-sm" value="Supplier / Component Supplier">Supplier / Component Supplier</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Service *
                                </label>
                                <select
                                    name="service"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white text-sm md:text-base"
                                    value={form.service}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="" disabled>Select Service</option>
                                    <option className="text-xs md:text-sm" value="Sheet Metal Fabrication">Sheet Metal Fabrication</option>
                                    <option className="text-xs md:text-sm" value="CNC Machining">CNC Machining</option>
                                    <option className="text-xs md:text-sm" value="Foundry / Casting">Foundry / Casting</option>
                                    <option className="text-xs md:text-sm" value="Forging">Forging</option>
                                    <option className="text-xs md:text-sm" value="Plastic Injection Molding">Plastic Injection Molding</option>
                                    <option className="text-xs md:text-sm" value="Rubber Molding">Rubber Molding</option>
                                    <option className="text-xs md:text-sm" value="Electrical & Electronics Manufacturing">Electrical & Electronics Manufacturing</option>
                                    <option className="text-xs md:text-sm" value="Packaging Manufacturing">Packaging Manufacturing</option>
                                    <option className="text-xs md:text-sm" value="Textile & Garment Manufacturing">Textile & Garment Manufacturing</option>
                                    <option className="text-xs md:text-sm" value="Surface Treatment & Coating">Surface Treatment & Coating</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter email address"
                                    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition ${isGoogleAuth ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    readOnly={isGoogleAuth}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Contact Number *
                                </label>
                                <input
                                    type="tel"
                                    name="contactNumber"
                                    placeholder="e.g. +91 98765 43210"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                                    value={form.contactNumber}
                                    onChange={handleChange}
                                    required
                                    pattern="(\+?[0-9\s\-]{10,18})"
                                    title="Enter a valid contact number (must be unique)"
                                />
                                <p className="text-xs text-gray-500 mt-1">This number must be unique across all company accounts.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    State *
                                </label>
                                <select
                                    name="state"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white text-sm md:text-base"
                                    value={form.state}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="" disabled>Select State</option>
                                    {Object.keys(INDIA_LOCATIONS).map((state) => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    City *
                                </label>
                                <select
                                    name="city"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white text-sm md:text-base"
                                    value={form.city}
                                    onChange={handleChange}
                                    required
                                    disabled={!form.state}
                                >
                                    <option value="" disabled>Select City</option>
                                    {form.state && INDIA_LOCATIONS[form.state]?.map((city) => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pincode
                                </label>
                                <input
                                    type="text"
                                    name="pincode"
                                    placeholder="Enter pincode"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                                    value={form.pincode}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {error && <ErrorAlert message={error} onClose={() => setError("")} />}
                        {success && (
                            <SuccessAlert
                                message={success}
                                onClose={() => setSuccess("")}
                            />
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <LoadingSpinner size="sm" />
                                    <span className="ml-2">Completing Registration...</span>
                                </>
                            ) : (
                                "Complete Registration"
                            )}
                        </button>
                    </form>
                    )}

                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="text-indigo-600 hover:text-indigo-700 font-semibold"
                            >
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
