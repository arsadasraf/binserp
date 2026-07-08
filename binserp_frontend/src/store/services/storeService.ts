import { binsApi } from "./binsApi";

const storeEndpoints = [
  { key: "vendor", url: "/api/store/vendor", tag: "StoreMasters", dataKey: "vendors" },

  { key: "customer", url: "/api/store/customer", tag: "StoreMasters", dataKey: "customers" },
  { key: "location", url: "/api/store/location", tag: "StoreMasters", dataKey: "locations" },
  { key: "category", url: "/api/store/category", tag: "StoreMasters", dataKey: "categories" },
  { key: "rm-bo-item", url: "/api/store/rm-bo-item", tag: "StoreInventory", dataKey: "rmBoItems" },
  { key: "job-work-supplier", url: "/api/store/job-work-supplier", tag: "StoreMasters", dataKey: "jobWorkSuppliers" },
  { key: "process", url: "/api/store/process", tag: "StoreMasters", dataKey: "processes" },
  { key: "dc", url: "/api/store/dc", tag: "StoreDc", dataKey: "dcs" },
  { key: "invoice", url: "/api/store/invoice", tag: "StoreInvoice", dataKey: "invoices" },
  { key: "grn", url: "/api/store/grn", tag: "StoreGrn", dataKey: "grns" },
  { key: "material-issue", url: "/api/store/material-issue", tag: "StoreMaterialIssue", dataKey: "materialIssues" },
  { key: "bom", url: "/api/store/bom", tag: "StoreBom", dataKey: "boms" },
  { key: "inventory", url: "/api/store/inventory", tag: "StoreInventory", dataKey: "inventory" },
  { key: "material-request", url: "/api/store/material-request", tag: "StoreMaterialRequest", dataKey: "materialRequests" },
  { key: "po", url: "/api/store/po", tag: "StorePo", dataKey: "pos" },
  { key: "company-info", url: "/api/store/company-info", tag: "StoreMasters", dataKey: "companyInfo" },
  { key: "quotation", url: "/api/store/quotation", tag: "StoreQuotation", dataKey: "quotations" },
  { key: "fg-item", url: "/api/store/fg-item", tag: "StoreMasters", dataKey: "fgItems" },
  { key: "fg-grn", url: "/api/store/fg-grn", tag: "StoreGrn", dataKey: "grns" },
  { key: "order", url: "/api/store/order", tag: "StoreOrder", dataKey: "orders" },
];

export type StoreTab = (typeof storeEndpoints)[number]["key"];

export const storeService = binsApi.injectEndpoints({
  endpoints: (builder) => ({
    getStoreData: builder.query<any, StoreTab>({
      query: (tab) => storeEndpoints.find((endpoint) => endpoint.key === tab)?.url ?? "/api/store/dc",
      providesTags: (_result, _error, tab) => {
        const current = storeEndpoints.find((endpoint) => endpoint.key === tab);
        return current ? [current.tag as any] : [];
      },
      transformResponse: (response: any, _meta, tab) => {
        const current = storeEndpoints.find((endpoint) => endpoint.key === tab);
        if (!current) return [];
        return response[current.dataKey] || response.data || response;
      },
    }),
    createStoreRecord: builder.mutation<any, { tab: StoreTab; body: any; isFormData?: boolean }>({
      query: ({ tab, body, isFormData }) => {
        const endpoint = storeEndpoints.find((entry) => entry.key === tab);
        const isBodyFormData = isFormData ?? body instanceof FormData;
        const isCompanyInfo = tab === "company-info";
        return {
          url: isCompanyInfo ? endpoint?.url ?? "/api/store/company-info" : endpoint?.url ?? "/api/store/dc",
          method: isCompanyInfo ? "PUT" : "POST",
          body,
          headers: isBodyFormData ? undefined : { "Content-Type": "application/json" },
        };
      },
      invalidatesTags: (_result, _error, { tab }) => {
        const endpoint = storeEndpoints.find((entry) => entry.key === tab);
        const tags = endpoint ? [endpoint.tag as any] : [];
        if (tab === "material-issue") {
          tags.push("StoreInventory");
        }
        return tags;
      },
    }),
    updateStoreRecord: builder.mutation<any, { tab: StoreTab; id: string; body: any; isFormData?: boolean }>({
      query: ({ tab, id, body, isFormData }) => {
        const endpoint = storeEndpoints.find((entry) => entry.key === tab);
        const isBodyFormData = isFormData ?? body instanceof FormData;
        const isCompanyInfo = tab === "company-info";
        return {
          url: isCompanyInfo ? endpoint?.url ?? "/api/store/company-info" : `${endpoint?.url}/${id}`,
          method: "PUT",
          body,
          headers: isBodyFormData ? undefined : { "Content-Type": "application/json" },
        };
      },
      invalidatesTags: (_result, _error, { tab }) => {
        const endpoint = storeEndpoints.find((entry) => entry.key === tab);
        const tags = endpoint ? [endpoint.tag as any] : [];
        if (tab === "material-issue") {
          tags.push("StoreInventory");
        }
        return tags;
      },
    }),
    deleteStoreRecord: builder.mutation<any, { tab: StoreTab; id: string }>({
      query: ({ tab, id }) => {
        const endpoint = storeEndpoints.find((entry) => entry.key === tab);
        return {
          url: `${endpoint?.url}/${id}`,
          method: "DELETE",
        };
      },
      invalidatesTags: (_result, _error, { tab }) => {
        const endpoint = storeEndpoints.find((entry) => entry.key === tab);
        return endpoint ? [endpoint.tag as any] : [];
      },
    }),
    createStoreDispatch: builder.mutation<any, { orderId: string; body: any }>({
      query: ({ orderId, body }) => ({
        url: `/api/store/order/${orderId}/dispatch`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    getStoreDispatches: builder.query<any, string>({
      query: (orderId) => `/api/store/order/${orderId}/dispatches`,
      transformResponse: (res: any) => res.dispatches,
      providesTags: ["StoreOrder" as any],
    }),
    getStoreFulfillments: builder.query<any, void>({
      query: () => `/api/store/fulfillment`,
      transformResponse: (res: any) => res.data,
      providesTags: ["StoreOrder" as any, "StoreInventory" as any],
    }),
    reserveFulfillmentQuantity: builder.mutation<any, { id: string; quantity: number }>({
      query: ({ id, quantity }) => ({
        url: `/api/store/fulfillment/${id}/reserve`,
        method: "POST",
        body: { quantity },
      }),
      invalidatesTags: ["StoreOrder" as any, "StoreInventory" as any],
    }),
    moveFulfillmentToMRP: builder.mutation<any, { id: string; quantity: number }>({
      query: ({ id, quantity }) => ({
        url: `/api/store/fulfillment/${id}/move-to-mrp`,
        method: "POST",
        body: { quantity },
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    getStoreMRPs: builder.query<any, void>({
      query: () => `/api/store/mrp`,
      transformResponse: (res: any) => res.data,
      providesTags: ["StoreOrder" as any],
    }),
  }),
  overrideExisting: false,
});

export const { 
  useGetStoreDataQuery, 
  useLazyGetStoreDataQuery, 
  useCreateStoreRecordMutation,
  useUpdateStoreRecordMutation,
  useDeleteStoreRecordMutation,
  useCreateStoreDispatchMutation,
  useGetStoreDispatchesQuery,
  useGetStoreFulfillmentsQuery,
  useReserveFulfillmentQuantityMutation,
  useMoveFulfillmentToMRPMutation,
  useGetStoreMRPsQuery
} = storeService;


