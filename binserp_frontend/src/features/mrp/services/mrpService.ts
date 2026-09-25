import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from "@/src/lib/api";
import { MRPPlan } from "../types/mrp.types";

/**
 * MRP API Service Layer
 * Supports both clean /api/mrp and legacy /api/purchase/mrp endpoints
 */
export const mrpService = {
  // Fetch all MRP plans
  getPlans: async (token: string): Promise<{ success?: boolean; plans?: MRPPlan[]; mrps?: MRPPlan[] }> => {
    return apiGet("/api/purchase/mrp/plans", token);
  },

  // Fetch single MRP plan by ID
  getPlanById: async (id: string, token: string): Promise<{ success: boolean; plan: MRPPlan }> => {
    return apiGet(`/api/purchase/mrp/plan/${id}`, token);
  },

  // Create new MRP plan
  createPlan: async (payload: Partial<MRPPlan>, token: string): Promise<any> => {
    return apiPost("/api/purchase/mrp/plan", payload, token);
  },

  // Update existing MRP plan
  updatePlan: async (id: string, payload: Partial<MRPPlan>, token: string): Promise<any> => {
    return apiPut(`/api/purchase/mrp/plan/${id}`, payload, token);
  },

  // Delete MRP plan (if permitted within 24h & no transactions)
  deletePlan: async (id: string, token: string): Promise<any> => {
    return apiDelete(`/api/purchase/mrp/plan/${id}`, token);
  },

  // Fetch Procurement Workbench data
  getWorkbench: async (token: string, mrpId?: string): Promise<any> => {
    const url = mrpId 
      ? `/api/purchase/mrp/procurement-workbench?mrpId=${mrpId}`
      : "/api/purchase/mrp/procurement-workbench";
    return apiGet(url, token);
  },

  // Bulk generate Purchase Orders from MRP Shortages
  bulkGeneratePO: async (payload: any, token: string): Promise<any> => {
    return apiPost("/api/purchase/mrp/bulk-generate-po", payload, token);
  },

  // Send selected items to PPC
  sendToPPC: async (payload: any, token: string): Promise<any> => {
    return apiPost("/api/purchase/mrp/send-to-ppc", payload, token);
  },

  // Get 360 WIP Tracker for plan
  get360Wip: async (id: string, token: string): Promise<any> => {
    return apiGet(`/api/purchase/mrp/wip-360/${id}`, token);
  },

  // Update item status in plan
  updateItemStatus: async (planId: string, payload: any, token: string): Promise<any> => {
    return apiPatch(`/api/purchase/mrp/plan/${planId}/item-status`, payload, token);
  }
};
