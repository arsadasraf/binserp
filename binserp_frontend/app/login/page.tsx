"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image"
import Link from "next/link";
import { useLoginMutation } from "@/src/store/services/authService";
import { persistSession } from "@/src/lib/session";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { API_BASE_URL } from "@/src/utils/config";

export default function LoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<"company" | "user">("company");
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const errorParam = searchParams.get('error');
      if (errorParam) {
        if (errorParam === 'EmailNotFound') {
          setError("No company found with this Google email. Please register your company or use your Company ID/Admin User ID to log in.");
        } else {
          setError(decodeURIComponent(errorParam).replace(/_/g, " "));
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      let locationData = {};

      // Attempt to get location for user login
      if (loginType === "user") {
        try {
          const pos: any = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          locationData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
        } catch (locErr: any) {
          console.warn("Location access denied or failed:", locErr);
          if (locErr.code === 1) { // PERMISSION_DENIED
             setError("Location access denied. Please allow location access in your browser if your account has location restrictions.");
          }
          // Continue without location - backend will enforce strictly if configured
        }
      }

      const response = await login({
        type: loginType,
        credentials: { companyId, userId, password, ...locationData },
      }).unwrap();

      if (response.token) {
        setSuccess(loginType === "company" ? "Company login successful!" : "User login successful!");
        const realUserType = (response.user && response.user.type === 'employee') ? 'employee' : loginType;

        persistSession({
          token: response.token,
          userType: realUserType,
          user: loginType === "user" ? response.user : response.company,
        });

        const redirect = () => {
          // Check for Employee Type first (priority)
          if (response.user && response.user.type === 'employee') {
            router.push("/dashboard/employee");
            return;
          }

          if (loginType === "user" && response.user) {
            const department = response.user.department;
            if (department.includes("HR")) {
              router.push("/dashboard/hr");
            } else if (department.includes("Store")) {
              router.push("/dashboard/store");
            } else if (department.includes("PPC")) {
              router.push("/dashboard/ppc");
            } else if (department === "Accounts") {
              router.push("/dashboard/accounts");
            } else if (department === "MD") {
              router.push("/dashboard/reports");
            } else {
              router.push("/dashboard"); // Default for user with department
            }
          } else {
            router.push("/dashboard"); // Default for company login or other cases
          }
        };

        setTimeout(redirect, 800);
      }
    } catch (err: any) {
      console.error("Login error raw:", err);
      let errorMessage = "Login failed. Please check your credentials.";
      
      if (err?.data?.message) {
        errorMessage = err.data.message;
      } else if (err?.error) {
        errorMessage = err.error;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }
      
      console.error("Parsed error message:", errorMessage);
      setError(errorMessage);
    }
  };

  return (
    <div className=" min-h-screen   flex items-center justify-center p-4 lg:p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl lg:rounded-4xl shadow-2xl p-8 lg:p-5 border border-gray-100 ">
          {/* Logo/Header */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
              <div className="w-10 h-10 relative cursor-pointer" onClick={() => router.push("/")}>
                <Image
                  src="/icon.svg"
                  alt="BinsErp Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900  mb-2 cursor-pointer" onClick={() => router.push("/")}>BinsErp</h1>
            
          </div>

          {/* Login Type Toggle */}
          <div className="mb-2">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setLoginType("company")}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${loginType === "company"
                  ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                Company Login
              </button>
              <button
                type="button"
                onClick={() => setLoginType("user")}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${loginType === "user"
                  ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                User Login
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              {loginType === "company"
                ? "Login as company admin to manage users"
                : "Login with your user credentials"}
            </p>
          </div>

          {error && <ErrorAlert message={error} onClose={() => setError("")} />}
          {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}

          {/* Login Form */}
          {loginType === "user" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Company ID
                </label>
                <input
                  type="text"
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Enter Company ID (e.g. BINS-1234)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Enter your user ID"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-12"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-indigo-600 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center dark:shadow-indigo-900/40"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Logging in...</span>
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Company Administrators log in using their verified Google account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const baseUrl = API_BASE_URL || 'http://localhost:8000';
                  const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
                  window.location.href = `${baseUrl.replace(/\/api$/, '')}/api/auth/google?origin=${origin}`;
                }}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 ">
              Don't have an account?{" "}
              <Link href="/register" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
                Register Company
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-500 mt-6">
          Secure login • Role-based access • Shop floor management
        </p>
      </div>
    </div>
  );
}
