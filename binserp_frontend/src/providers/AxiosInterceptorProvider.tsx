"use client";

import { useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";

let isRefreshing = false;
let failedQueue: any[] = [];

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
            
            if (isRefreshing) {
              try {
                await new Promise((resolve, reject) => {
                  failedQueue.push({ resolve, reject });
                });
                return axios(originalRequest);
              } catch (err) {
                return Promise.reject(err);
              }
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
              // Note: We assume API_BASE_URL is handled appropriately by axios if it's relative
              // If not, we might need the full URL, but typically axios instances handle this or base tag handles it.
              const refreshUrl = originalRequest.baseURL ? `${originalRequest.baseURL}/api/auth/refresh` : '/api/auth/refresh';
              
              await axios.post(refreshUrl, {}, { withCredentials: true });
              
              isRefreshing = false;
              processQueue(null, "success");
              return axios(originalRequest);
            } catch (refreshError) {
              isRefreshing = false;
              processQueue(refreshError, null);
              
              const errorData = error.response.data;
              const isDeactivated = errorData?.message?.toLowerCase().includes("deactivated");

              // We'll also call clearSession if we can import it, but let's just do standard cleanup here
              localStorage.removeItem("userType");
              localStorage.removeItem("userInfo");
              
              // Clear cookies
              document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

              await Swal.fire({
                icon: 'error',
                title: isDeactivated ? 'Account Deactivated' : 'Session Expired',
                text: isDeactivated
                  ? 'Your account has been deactivated. Please contact an administrator.'
                  : 'Your session has expired or is invalid. Please log in again.',
                confirmButtonColor: '#4f46e5',
                confirmButtonText: 'Go to Login',
                allowOutsideClick: false,
                background: '#ffffff',
                customClass: {
                  title: 'text-xl font-bold text-gray-900',
                  popup: 'rounded-2xl shadow-2xl border border-gray-100',
                }
              });

              window.location.href = '/login';
              return Promise.reject(refreshError);
            }
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
