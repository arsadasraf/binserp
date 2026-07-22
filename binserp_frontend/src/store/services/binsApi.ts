import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "@/src/utils/config";
import Swal from "sweetalert2";

const baseUrl = API_BASE_URL;

import { clearSession } from "@/src/lib/session";

const baseQuery = fetchBaseQuery({
  baseUrl,
  credentials: "include", // Send HttpOnly cookies automatically
});

// Mutex to prevent multiple simultaneous refresh calls
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

// Global Interceptor
const customBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const isLoginRoute = typeof args === 'string' ? args.includes('/login') : args.url.includes('/login');
    const isRefreshRoute = typeof args === 'string' ? args.includes('/refresh') : args.url.includes('/refresh');
    
    if (!isLoginRoute && !isRefreshRoute) {
      if (isRefreshing) {
        // Wait for the refresh to complete before retrying this request
        try {
          await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          // Retry the original query after successful refresh
          return await baseQuery(args, api, extraOptions);
        } catch (err) {
          return result; // Return original 401 error if refresh failed
        }
      }

      const errorData: any = result.error.data;
      const isDeactivated = errorData?.message?.toLowerCase().includes("deactivated");
      
      if (isDeactivated) {
        // Hard logout for deactivated accounts
        clearSession();
        if (typeof window !== "undefined") {
          await Swal.fire({
            icon: 'error',
            title: 'Account Deactivated',
            text: 'Your account has been deactivated. Please contact an administrator.',
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Go to Login',
            allowOutsideClick: false,
          });
          window.location.href = '/login';
        }
        return result;
      }

      isRefreshing = true;

      try {
        // Attempt to refresh token
        const refreshResult = await baseQuery({
          url: '/api/auth/refresh',
          method: 'POST',
        }, api, extraOptions);

        if (refreshResult.data) {
          const newToken = (refreshResult.data as any).token;
          if (newToken && typeof window !== "undefined") {
            localStorage.setItem("token", newToken);
            const isSecure = window.location.protocol === "https:";
            document.cookie = `accessToken=${encodeURIComponent(newToken)}; max-age=${60 * 60 * 8}; path=/; SameSite=Lax; ${isSecure ? "Secure" : ""}`;
          }
          // Success! Process queued requests and retry the original one
          isRefreshing = false;
          processQueue(null, "success");
          return await baseQuery(args, api, extraOptions);
        } else {
          // Refresh failed (e.g. refresh token expired)
          throw new Error("Refresh failed");
        }
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        
        clearSession();
        
        if (typeof window !== "undefined") {
          await Swal.fire({
            icon: 'error',
            title: 'Session Expired',
            text: 'Your session has expired. Please log in again.',
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Go to Login',
            allowOutsideClick: false,
          });
          window.location.href = '/login';
        }
      }
    }
  }

  return result;
};

export const TAG_TYPES = [
  "Orders", "PpcOrders", "ProductionOrders", "RouteCards", "Jobs", "MaterialPlans", "Backlog", "PPCProduct", "FGItem",
  "Machines", "MachineCategories", "MachineLocations", "MachineMaintenance", "MachineAssignments", "MachinePlans",
  "Processes", "Shifts", "Manpower", "ManpowerMaster", "Skills", "Components",
  "ProcurementDashboard", "Allotments", "Boms",
  "StoreDc", "StoreInvoice", "StoreGrn", "StoreMaterialIssue", "StoreBom", "StoreInventory", "StoreMaterialRequest", "StoreMasters", "StorePo", "StoreQuotation", "StoreOrder", "StorePriceList", "IncomingRFQ",
  "PurchaseRfq", "VendorQuotation", "PurchaseBill", "VendorPriceList", "PurchaseMRP",
  "Employees", "Attendance", "Auth",
];

export const binsApi = createApi({
  reducerPath: "binsApi",
  baseQuery: customBaseQuery,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});
