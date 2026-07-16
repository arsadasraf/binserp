import { binsApi } from "./binsApi";

const storeEndpoints = [
  { key: "vendor", url: "/api/store/vendor", tag: "StoreMasters", dataKey: "vendors" },

  { key: "customer", url: "/api/store/customer", tag: "StoreMasters", dataKey: "customers" },
  { key: "location", url: "/api/store/location", tag: "StoreMasters", dataKey: "locations" },
  { key: "category", url: "/api/store/category", tag: "StoreMasters", dataKey: "categories" },
  { key: "rm-bo-item", url: "/api/store/rm-bo-item", tag: "StoreInventory", dataKey: "rmBoItems" },
  { key: "job-work-supplier", url: "/api/store/job-work-supplier", tag: "StoreMasters", dataKey: "jobWorkSuppliers" },
  { key: "process", url: "/api/store/process", tag: "StoreMasters", dataKey: "processes" },
  { key: "dc", url: "/api/sales/dc", tag: "StoreDc", dataKey: "dcs" },
  { key: "invoice", url: "/api/sales/invoice", tag: "StoreInvoice", dataKey: "invoices" },
  { key: "grn", url: "/api/store/grn", tag: "StoreGrn", dataKey: "grns" },
  { key: "material-issue", url: "/api/store/material-issue", tag: "StoreMaterialIssue", dataKey: "materialIssues" },
  { key: "bom", url: "/api/store/bom", tag: "StoreBom", dataKey: "boms" },
  { key: "inventory", url: "/api/store/inventory", tag: "StoreInventory", dataKey: "inventory" },
  { key: "material-request", url: "/api/store/material-request", tag: "StoreMaterialRequest", dataKey: "materialRequests" },
  { key: "po", url: "/api/purchase/po", tag: "StorePo", dataKey: "pos" },
  { key: "company-info", url: "/api/store/company-info", tag: "StoreMasters", dataKey: "companyInfo" },
  { key: "quotation", url: "/api/sales/quotation", tag: "StoreQuotation", dataKey: "quotations" },
  { key: "fg-item", url: "/api/store/fg-item", tag: "StoreMasters", dataKey: "fgItems" },
  { key: "fg-grn", url: "/api/store/fg-grn", tag: "StoreGrn", dataKey: "grns" },
  { key: "order", url: "/api/sales/order", tag: "StoreOrder", dataKey: "orders" },
  { key: "incoming-rfq", url: "/api/sales/incoming-rfq", tag: "IncomingRFQ", dataKey: "rfqs" },
  { key: "purchase-rfq", url: "/api/purchase/rfq", tag: "PurchaseRfq", dataKey: "data" },
  { key: "vendor-quotation", url: "/api/purchase/quotation", tag: "VendorQuotation", dataKey: "data" },
  { key: "purchase-bill", url: "/api/purchase/bill", tag: "PurchaseBill", dataKey: "data" },
  { key: "vendor-price-list", url: "/api/purchase/price-list", tag: "VendorPriceList", dataKey: "data" },
  { key: "mrp", url: "/api/purchase/mrp", tag: "PurchaseMRP", dataKey: "mrps" },
  { key: "incoming-po", url: "/api/sales/incoming-po", tag: "StorePo", dataKey: "pos" },
  { key: "price-list", url: "/api/sales/price-list", tag: "StorePriceList", dataKey: "priceLists" },
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
        url: `/api/sales/order/${orderId}/dispatch`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    getStoreDispatches: builder.query<any, string>({
      query: (orderId) => `/api/sales/order/${orderId}/dispatches`,
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
      query: () => `/api/purchase/mrp`,
      transformResponse: (res: any) => res.mrps,
      providesTags: ["PurchaseMRP" as any],
    }),
    planRMRequirement: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/store/mrp/${id}/plan-rm`,
        method: "POST"
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    planSingleRMRequirement: builder.mutation<any, { id: string; itemId: string; requiredQuantity: number }>({
      query: ({ id, itemId, requiredQuantity }) => ({
        url: `/api/store/mrp/${id}/plan-single-rm`,
        method: "POST",
        body: { itemId, requiredQuantity }
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    planProductionRequirement: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/store/mrp/${id}/plan-production`,
        method: "POST"
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    getRMPlans: builder.query<any, void>({
      query: () => `/api/store/rm-plan`,
      transformResponse: (res: any) => res.data,
      providesTags: ["StoreOrder" as any],
    }),
    updateRMPlanPO: builder.mutation<any, { id: string; vendor?: string; poQuantity?: number; poReference?: string }>({
      query: ({ id, ...body }) => ({
        url: `/api/store/rm-plan/${id}/po`,
        method: "PUT",
        body
      }),
      invalidatesTags: ["StoreOrder" as any],
    }),
    generateSalesOrderFromPO: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/sales/incoming-po/${id}/generate-order`,
        method: "POST"
      }),
      invalidatesTags: ["StorePo" as any, "StoreOrder" as any],
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
  useGetStoreMRPsQuery,
  usePlanRMRequirementMutation,
  usePlanSingleRMRequirementMutation,
  usePlanProductionRequirementMutation,
  useGetRMPlansQuery,
  useUpdateRMPlanPOMutation,
  useGenerateSalesOrderFromPOMutation
} = storeService;



