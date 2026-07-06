import { binsApi } from "./binsApi";

export const ppcService = binsApi.injectEndpoints({
  endpoints: (builder) => ({

    // ─── Orders ────────────────────────────────────────────────────────
    getOrders: builder.query<any[], void>({
      query: () => "/api/ppc/order",
      transformResponse: (response: any) => response.orders || [],
      providesTags: ["Orders"],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/api/ppc/order/${id}`,
      transformResponse: (response: any) => response.order || response,
      providesTags: (_r, _e, id) => [{ type: "Orders", id }],
    }),
    deleteOrder: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/order/${id}`, method: "DELETE" }),
      invalidatesTags: ["Orders", "PpcOrders"],
    }),
    getPpcOrders: builder.query<any[], void>({
      query: () => "/api/ppc/ppc-order",
      transformResponse: (response: any) => response.orders || [],
      providesTags: ["PpcOrders"],
    }),
    createOrder: builder.mutation<any, FormData>({
      query: (body) => ({ url: "/api/ppc/order", method: "POST", body }),
      invalidatesTags: ["Orders"],
    }),
    updateOrder: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/order/${id}`, method: "PUT", body }),
      invalidatesTags: ["Orders"],
    }),
    createPpcOrder: builder.mutation<any, FormData>({
      query: (body) => ({ url: "/api/ppc/ppc-order", method: "POST", body }),
      invalidatesTags: ["PpcOrders"],
    }),
    updatePpcOrder: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/ppc-order/${id}`, method: "PUT", body }),
      invalidatesTags: ["PpcOrders", "ProductionOrders"],
    }),

    // NEW PRODUCTION ORDERS API (Exclusive for PPC Tab)
    getProductionOrders: builder.query<any[], void>({
      query: () => "/api/ppc/production-order",
      transformResponse: (response: any) => response.orders || [],
      providesTags: ["ProductionOrders"],
    }),
    createProductionOrder: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/production-order", method: "POST", body }),
      invalidatesTags: ["ProductionOrders"],
    }),
    updatePpcOrderStatus: builder.mutation<any, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/api/ppc/ppc-order/${id}`,
        method: "PUT",
        body: { status },
      }),
      invalidatesTags: ["PpcOrders", "ProductionOrders"],
    }),
    confirmPpcOrder: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/ppc-order/${id}/confirm`, method: "POST" }),
      invalidatesTags: ["PpcOrders", "ProductionOrders", "MaterialPlans", "Jobs", "Backlog"],
    }),
    getDispatchQueue: builder.query<any[], void>({
      query: () => "/api/ppc/dispatch/queue",
      transformResponse: (response: any) => response.dispatchQueue || [],
      providesTags: ["PpcOrders"],
    }),
    confirmDispatch: builder.mutation<any, { orderId: string }>({
      query: (body) => ({ url: "/api/ppc/dispatch/confirm", method: "POST", body }),
      invalidatesTags: ["PpcOrders"],
    }),
    getMaterialPlan: builder.query<any, string>({
      query: (orderId) => `/api/ppc/ppc-order/${orderId}/material-plan`,
      providesTags: (_r, _e, id) => [{ type: "PpcOrders", id: `plan-${id}` }],
    }),
    updateMaterialRequirementStatus: builder.mutation<any, { planId: string; itemId: string; body: any }>({
      query: ({ planId, itemId, body }) => ({
        url: `/api/ppc/material-requirement/${planId}/item/${itemId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["PpcOrders"],
    }),
    getJobsByOrder: builder.query<any[], string>({
      query: (orderId) => `/api/ppc/ppc-order/${orderId}/jobs`,
      transformResponse: (response: any) => response.jobs || [],
      providesTags: (_r, _e, id) => [{ type: "PpcOrders", id: `jobs-${id}` }],
    }),
    getGlobalMRP: builder.query<any[], void>({
      query: () => "/api/ppc/mrp",
      transformResponse: (response: any) => response.items || [],
      providesTags: ["MaterialPlans"],
    }),
    updateMRPItem: builder.mutation<any, { itemId: string; prQuantity?: number; status?: string }>({
      query: ({ itemId, prQuantity, status }) => ({
        url: `/api/ppc/mrp/item/${itemId}`,
        method: "PUT",
        body: { prQuantity, status },
      }),
      invalidatesTags: ["MaterialPlans"],
    }),

    // ─── Jobs ─────────────────────────────────────────────────────────
    getJobs: builder.query<any[], string | void>({
      query: (search) => search ? `/api/ppc/job?search=${encodeURIComponent(search)}` : "/api/ppc/job",
      transformResponse: (response: any) => response.jobs || [],
      providesTags: ["Jobs"],
    }),
    updateJob: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/job/${id}`, method: "PUT", body }),
      invalidatesTags: ["Jobs"],
    }),
    startJobProcess: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/job/process/start", method: "POST", body }),
      invalidatesTags: ["Jobs"],
    }),
    completeJobProcess: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/job/process/complete", method: "POST", body }),
      invalidatesTags: ["Jobs"],
    }),

    // ─── Route Cards ──────────────────────────────────────────────────
    getRouteCards: builder.query<any[], void>({
      query: () => "/api/ppc/route-card",
      transformResponse: (response: any) => response.routeCards || [],
      providesTags: ["RouteCards"],
    }),
    createRouteCard: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/route-card", method: "POST", body }),
      invalidatesTags: ["RouteCards"],
    }),

    // ─── Machines ─────────────────────────────────────────────────────
    getMachines: builder.query<any[], void>({
      query: () => "/api/ppc/machine",
      transformResponse: (response: any) => response.machines || [],
      providesTags: ["Machines"],
    }),
    createMachine: builder.mutation<any, FormData>({
      query: (body) => ({ url: "/api/ppc/machine", method: "POST", body }),
      invalidatesTags: ["Machines"],
    }),
    updateMachine: builder.mutation<any, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `/api/ppc/machine/${id}`, method: "PUT", body }),
      invalidatesTags: ["Machines"],
    }),
    deleteMachine: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/machine/${id}`, method: "DELETE" }),
      invalidatesTags: ["Machines"],
    }),

    // ─── Machine Categories ───────────────────────────────────────────
    getMachineCategories: builder.query<any[], void>({
      query: () => "/api/ppc/machine-category",
      transformResponse: (response: any) => response.categories || [],
      providesTags: ["MachineCategories"],
    }),
    createMachineCategory: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/machine-category", method: "POST", body }),
      invalidatesTags: ["MachineCategories"],
    }),
    updateMachineCategory: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/machine-category/${id}`, method: "PUT", body }),
      invalidatesTags: ["MachineCategories"],
    }),
    deleteMachineCategory: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/machine-category/${id}`, method: "DELETE" }),
      invalidatesTags: ["MachineCategories"],
    }),

    // ─── Machine Locations ────────────────────────────────────────────
    getMachineLocations: builder.query<any[], void>({
      query: () => "/api/ppc/machine-location",
      transformResponse: (response: any) => response.locations || [],
      providesTags: ["MachineLocations"],
    }),
    createMachineLocation: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/machine-location", method: "POST", body }),
      invalidatesTags: ["MachineLocations"],
    }),
    updateMachineLocation: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/machine-location/${id}`, method: "PUT", body }),
      invalidatesTags: ["MachineLocations"],
    }),
    deleteMachineLocation: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/machine-location/${id}`, method: "DELETE" }),
      invalidatesTags: ["MachineLocations"],
    }),

    // ─── Machine Maintenance ─────────────────────────────────────────
    getMachineMaintenance: builder.query<any[], string>({
      query: (machineId) => `/api/ppc/machine-maintenance?machine=${machineId}`,
      transformResponse: (response: any) => response.records || [],
      providesTags: (_r, _e, machineId) => [{ type: "MachineMaintenance", id: machineId }],
    }),
    createMachineMaintenance: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/machine-maintenance", method: "POST", body }),
      invalidatesTags: (_r, _e, arg) => [{ type: "MachineMaintenance", id: arg.machine }],
    }),

    // ─── Machine Assignments ─────────────────────────────────────────
    getMachineAssignments: builder.query<any[], string>({
      query: (date) => `/api/ppc/machine-assignment?date=${date}`,
      transformResponse: (response: any) => response.assignments || [],
      providesTags: ["MachineAssignments"],
    }),
    createMachineAssignment: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/machine-assignment", method: "POST", body }),
      invalidatesTags: ["MachineAssignments"],
    }),
    updateMachineAssignment: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/machine-assignment/${id}`, method: "PUT", body }),
      invalidatesTags: ["MachineAssignments"],
    }),
    deleteMachineAssignment: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/machine-assignment/${id}`, method: "DELETE" }),
      invalidatesTags: ["MachineAssignments"],
    }),

    // ─── Machine Plans ────────────────────────────────────────────────
    getMachinePlans: builder.query<any[], { machineId: string; startDate: string; endDate: string }>({
      query: ({ machineId, startDate, endDate }) =>
        `/api/ppc/machine-plan?machine=${machineId}&startDate=${startDate}&endDate=${endDate}`,
      transformResponse: (response: any) => response.plans || [],
      providesTags: ["MachinePlans"],
    }),
    createMachinePlan: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/machine-plan", method: "POST", body }),
      invalidatesTags: ["MachinePlans"],
    }),
    updateMachinePlan: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/machine-plan/${id}`, method: "PUT", body }),
      invalidatesTags: ["MachinePlans"],
    }),

    // ─── Machine Schedule (Planning Timeline) ────────────────────────
    getMachineSchedule: builder.query<any, { machineId: string; start?: string; end?: string }>({
      query: ({ machineId, start, end }) => {
        let url = `/api/ppc/planning/machine-schedule?machineId=${machineId}`;
        if (start) url += `&start=${start}`;
        if (end) url += `&end=${end}`;
        return url;
      },
      providesTags: ["MachinePlans"],
    }),

    // ─── Processes ────────────────────────────────────────────────────
    getProcesses: builder.query<any[], void>({
      query: () => "/api/ppc/process",
      transformResponse: (response: any) => response.processes || [],
      providesTags: ["Processes"],
    }),
    createProcess: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/process", method: "POST", body }),
      invalidatesTags: ["Processes"],
    }),
    updateProcess: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/process/${id}`, method: "PUT", body }),
      invalidatesTags: ["Processes"],
    }),
    deleteProcess: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/process/${id}`, method: "DELETE" }),
      invalidatesTags: ["Processes"],
    }),

    // ─── Shifts ───────────────────────────────────────────────────────
    getShifts: builder.query<any[], void>({
      query: () => "/api/ppc/shift",
      transformResponse: (response: any) => response.shifts || [],
      providesTags: ["Shifts"],
    }),
    createShift: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/shift", method: "POST", body }),
      invalidatesTags: ["Shifts"],
    }),
    updateShift: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/shift/${id}`, method: "PUT", body }),
      invalidatesTags: ["Shifts"],
    }),
    deleteShift: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/shift/${id}`, method: "DELETE" }),
      invalidatesTags: ["Shifts"],
    }),

    // ─── Manpower ─────────────────────────────────────────────────────
    getManpower: builder.query<any[], void>({
      query: () => "/api/ppc/manpower",
      transformResponse: (response: any) => response.manpower || [],
      providesTags: ["Manpower"],
    }),
    getManpowerMaster: builder.query<any[], void>({
      query: () => "/api/ppc/manpower-master",
      transformResponse: (response: any) => response.manpowerList || [],
      providesTags: ["ManpowerMaster"],
    }),
    createManpower: builder.mutation<any, any>({
      query: (body) => ({ url: "/api/ppc/manpower", method: "POST", body }),
      invalidatesTags: ["Manpower", "ManpowerMaster"],
    }),
    updateManpower: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/manpower/${id}`, method: "PUT", body }),
      invalidatesTags: ["Manpower", "ManpowerMaster"],
    }),
    deleteManpower: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/manpower/${id}`, method: "DELETE" }),
      invalidatesTags: ["Manpower", "ManpowerMaster"],
    }),


    // ─── Components (Products) ────────────────────────────────────────
    getComponents: builder.query<any[], void>({
      query: () => "/api/ppc/component",
      transformResponse: (response: any) => response.components || [],
      providesTags: ["Components"],
    }),
    getPpcComponents: builder.query<any[], { isInventoryItem?: boolean; isMaster?: boolean }>({
      query: (params) => {
        let url = "/api/ppc/component";
        const queryParams = [];
        if (params?.isInventoryItem !== undefined) queryParams.push(`isInventoryItem=${params.isInventoryItem}`);
        if (params?.isMaster !== undefined) queryParams.push(`isMaster=${params.isMaster}`);
        if (queryParams.length > 0) url += `?${queryParams.join("&")}`;
        return url;
      },
      transformResponse: (response: any) => response.components || [],
      providesTags: ["Components"],
    }),
    getComponent: builder.query<any, string>({
      query: (id) => `/api/ppc/component/${id}`,
      transformResponse: (response: any) => response.component || response,
      providesTags: (_r, _e, id) => [{ type: "Components", id }],
    }),
    createComponent: builder.mutation<any, FormData>({
      query: (body) => ({ url: "/api/ppc/component", method: "POST", body }),
      invalidatesTags: ["Components"],
    }),
    updateComponent: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/api/ppc/component/${id}`, method: "PUT", body }),
      invalidatesTags: ["Components"],
    }),
    deleteComponent: builder.mutation<any, string>({
      query: (id) => ({ url: `/api/ppc/component/${id}`, method: "DELETE" }),
      invalidatesTags: ["Components"],
    }),

    // ─── Materials ───────────────────────────────────────────────────
    getMaterials: builder.query<any[], void>({
      query: () => "/api/store/material",
      transformResponse: (response: any) => response.materials || [],
      providesTags: ["StoreInventory"],
    }),
    getCustomers: builder.query<any[], void>({
      query: () => "/api/store/customer",
      transformResponse: (response: any) => response.customers || response.data || [],
      providesTags: ["StoreMasters"],
    }),

    // ─── Procurement ─────────────────────────────────────────────────
    getProcurementDashboard: builder.query<any, void>({
      query: () => "/api/ppc/procurement/dashboard",
      providesTags: ["ProcurementDashboard"],
    }),

    // ─── Allotments ──────────────────────────────────────────────────
    getAllotments: builder.query<any[], { startDate: string; endDate: string }>({
      query: ({ startDate, endDate }) =>
        `/api/ppc/allotment?startDate=${startDate}&endDate=${endDate}`,
      transformResponse: (response: any) => response.allotments || [],
      providesTags: ["Allotments"],
    }),

    // ─── BOM ─────────────────────────────────────────────────────────
    getBoms: builder.query<any[], void>({
      query: () => "/api/store/bom",
      transformResponse: (response: any) => response.boms || [],
      providesTags: ["Boms"],
    }),

    // ─── Auto Schedule ───────────────────────────────────────────────
    autoSchedule: builder.mutation<any, { orderId: string }>({
      query: ({ orderId }) => ({ url: `/api/ppc/auto-schedule/${orderId}`, method: "POST" }),
      invalidatesTags: ["Orders", "Jobs", "RouteCards", "PpcOrders"],
    }),
  }),
  overrideExisting: false,
});

export const {
  // Orders
  useGetOrdersQuery, useGetOrderQuery, useGetPpcOrdersQuery, 
  useCreateOrderMutation, useUpdateOrderMutation,
  useCreatePpcOrderMutation, useUpdatePpcOrderMutation, useConfirmPpcOrderMutation,
  useUpdatePpcOrderStatusMutation,
  useDeleteOrderMutation,
  useGetProductionOrdersQuery, useCreateProductionOrderMutation,
  useGetDispatchQueueQuery, useConfirmDispatchMutation,
  useGetGlobalMRPQuery, useUpdateMRPItemMutation,
  useGetMaterialPlanQuery, useUpdateMaterialRequirementStatusMutation, useGetJobsByOrderQuery,
  // Jobs
  useGetJobsQuery, useLazyGetJobsQuery, useUpdateJobMutation, useStartJobProcessMutation, useCompleteJobProcessMutation,
  // Route Cards
  useGetRouteCardsQuery, useCreateRouteCardMutation,
  // Machines
  useGetMachinesQuery, useCreateMachineMutation, useUpdateMachineMutation, useDeleteMachineMutation,
  // Machine Categories
  useGetMachineCategoriesQuery, useCreateMachineCategoryMutation, useUpdateMachineCategoryMutation, useDeleteMachineCategoryMutation,
  // Machine Locations
  useGetMachineLocationsQuery, useCreateMachineLocationMutation, useUpdateMachineLocationMutation, useDeleteMachineLocationMutation,
  // Machine Maintenance
  useGetMachineMaintenanceQuery, useCreateMachineMaintenanceMutation,
  // Machine Assignments
  useGetMachineAssignmentsQuery, useCreateMachineAssignmentMutation, useUpdateMachineAssignmentMutation, useDeleteMachineAssignmentMutation,
  // Machine Plans
  useGetMachinePlansQuery, useCreateMachinePlanMutation, useUpdateMachinePlanMutation,
  // Machine Schedule
  useGetMachineScheduleQuery,
  // Processes
  useGetProcessesQuery, useCreateProcessMutation, useUpdateProcessMutation, useDeleteProcessMutation,
  // Shifts
  useGetShiftsQuery, useCreateShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation,
  // Manpower
  useGetManpowerQuery, useGetManpowerMasterQuery, useCreateManpowerMutation, useUpdateManpowerMutation, useDeleteManpowerMutation,
  // Components
  // Components
  useGetComponentsQuery, useGetPpcComponentsQuery, useGetComponentQuery,
  useCreateComponentMutation, useUpdateComponentMutation, useDeleteComponentMutation,
  // Materials
  useGetMaterialsQuery, useGetCustomersQuery,
  // Procurement
  useGetProcurementDashboardQuery,
  // Auto Scheduling
  useAutoScheduleMutation,
  // Allotments
  useGetAllotmentsQuery,
  // BOM
  useGetBomsQuery,
} = ppcService;
