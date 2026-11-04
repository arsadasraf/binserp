"use client";

import { useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_BASE_URL } from "@/src/utils/config";
import { clearSession, updateRefreshedTokens } from "@/src/lib/session";

let isRefreshing = false;
let failedQueue: any[] = [];
let isSessionAlertActive = false;

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export default function AxiosInterceptorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ensure all axios requests send HttpOnly cookies
    axios.defaults.withCredentials = true;

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          const isLoginRoute = originalRequest.url && originalRequest.url.includes('/login');
          const isRefreshRoute = originalRequest.url && originalRequest.url.includes('/refresh');

          if (!isLoginRoute && !isRefreshRoute) {
            const initialErrorData = error.response?.data;
            const initialMsg = String(initialErrorData?.message || "");
            const isAnotherDeviceImmediate = initialMsg.toLowerCase().includes("another device");
            const isForceTerminated = initialMsg.toLowerCase().includes("terminated or logged out");
            const isDeactivatedImmediate = initialMsg.toLowerCase().includes("deactivated") || initialMsg.toLowerCase().includes("inactive");

            // If already kicked out by another device, force-logged out, or deactivated, do not attempt refresh
            if (!isAnotherDeviceImmediate && !isForceTerminated && !isDeactivatedImmediate) {
              if (isRefreshing) {
                try {
                  const newTok = await new Promise<string | null>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                  });
                  if (newTok && originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newTok}`;
                  }
                  return axios(originalRequest);
                } catch (err) {
                  return Promise.reject(err);
                }
              }

              originalRequest._retry = true;
              isRefreshing = true;

              try {
                const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
                const storedRefreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;

                const refreshRes = await axios.post(
                  refreshUrl,
                  storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
                  { withCredentials: true }
                );

                const newToken = refreshRes.data?.token;
                const newRefreshToken = refreshRes.data?.refreshToken;
                const accessMode = refreshRes.data?.accessMode;

                if (newToken) {
                  updateRefreshedTokens(newToken, newRefreshToken, accessMode);
                  if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  }
                }

                isRefreshing = false;
                processQueue(null, newToken || "success");
                return axios(originalRequest);
              } catch (refreshError: any) {
                isRefreshing = false;
                processQueue(refreshError, null);
              }
            }

            const errorData = error.response?.data;
            const rawMsg = String(errorData?.message || "");
            const isDeactivated = rawMsg.toLowerCase().includes("deactivated") || rawMsg.toLowerCase().includes("inactive");
            const isAnotherDevice = rawMsg.toLowerCase().includes("another device");

            // Clear client session and cookies
            await clearSession();

            if (!isSessionAlertActive) {
              isSessionAlertActive = true;

              let alertTitle = 'Session Expired';
              let alertText = rawMsg || 'Your session has expired or is invalid. Please log in again.';

              if (isDeactivated) {
                alertTitle = 'Account Deactivated';
                alertText = rawMsg || 'Your account has been deactivated. Please contact an administrator.';
              } else if (isAnotherDevice) {
                alertTitle = 'Logged in from another device';
                alertText = rawMsg || 'You have been logged out because your account was logged into from another device.';
              }

              await Swal.fire({
                icon: 'error',
                title: alertTitle,
                text: alertText,
                confirmButtonColor: '#4f46e5',
                confirmButtonText: 'Go to Login',
                allowOutsideClick: false,
                background: '#ffffff',
                customClass: {
                  title: 'text-xl font-bold text-gray-900',
                  popup: 'rounded-2xl shadow-2xl border border-gray-100',
                }
              });

              isSessionAlertActive = false;
              window.location.href = '/login?logout=1';
            }
            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return <>{children}</>;
}
