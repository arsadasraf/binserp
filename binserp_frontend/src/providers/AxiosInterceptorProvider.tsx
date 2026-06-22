"use client";

import { useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";

export default function AxiosInterceptorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          const config = error.config;
          const isLoginRoute = config.url && config.url.includes('/login');

          if (!isLoginRoute) {
            const errorData = error.response.data;
            const isDeactivated = errorData?.message?.toLowerCase().includes("deactivated");

            localStorage.removeItem("token");
            localStorage.removeItem("user");

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
