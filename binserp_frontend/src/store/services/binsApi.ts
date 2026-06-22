import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "@/src/utils/config";
import Swal from "sweetalert2";

const baseUrl = API_BASE_URL;

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

const baseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// Global Interceptor
const customBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && (result.error.status === 401 || result.error.status === 403)) {
    // Ignore 401/403 if it's a login request (let the component handle it)
    const isLoginRoute = typeof args === 'string' ? args.includes('/login') : args.url.includes('/login');
    
    if (!isLoginRoute) {
      const errorData: any = result.error.data;
      const isDeactivated = errorData?.message?.toLowerCase().includes("deactivated");
      
      if (typeof window !== "undefined") {
        // Clear local storage
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        
        // Show elegant alert
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

        // Force redirect
        window.location.href = '/login';
      }
    }
  }

  return result;
};

export const TAG_TYPES = [
  "Orders", "PpcOrders", "RouteCards", "Jobs",
  "Machines", "MachineCategories", "MachineLocations", "MachineMaintenance", "MachineAssignments", "MachinePlans",
  "Processes", "Shifts", "Manpower", "ManpowerMaster", "Skills", "Components",
  "ProcurementDashboard", "Allotments", "Boms",
  "StoreDc", "StoreInvoice", "StoreGrn", "StoreMaterialIssue", "StoreBom", "StoreInventory", "StoreMaterialRequest", "StoreMasters", "StorePo", "StoreQuotation",
  "Employees", "Attendance", "Auth",
];

export const binsApi = createApi({
  reducerPath: "binsApi",
  baseQuery: customBaseQuery,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});
