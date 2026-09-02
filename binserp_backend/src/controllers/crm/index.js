// Leads
export { createLead } from "./createLead.controller.js";
export { getLeads } from "./getLeads.controller.js";
export { updateLead } from "./updateLead.controller.js";
export { deleteLead } from "./deleteLead.controller.js";
export { convertLeadToCustomer } from "./convertLeadToCustomer.controller.js";

// Deals
export { getDeals, createDeal, updateDeal, deleteDeal } from "./deal.controller.js";

// Customers
export { createCustomer } from "./createCustomer.controller.js";
export { getCustomers, getCustomer360 } from "./getCustomers.controller.js";
export { updateCustomer } from "./updateCustomer.controller.js";
export { deleteCustomer } from "./deleteCustomer.controller.js";

// Activities
export { createActivity } from "./createActivity.controller.js";
export { getActivities, updateActivity, deleteActivity } from "./getActivities.controller.js";

// CRM Masters
export { getCRMMasters, createCRMMasterItem, updateCRMMasterItem, deleteCRMMasterItem } from "./crmMaster.controller.js";

// Excel Import / Export
export { downloadExcelTemplate, importLeadsFromExcel, importCustomersFromExcel, exportLeadsToExcel, exportCustomersToExcel } from "./crmExcel.controller.js";

// Integrations & Webhooks
export { getCRMIntegrations, saveCRMIntegrations, syncIndiaMartLeads, receiveWebhookLead, getSyncLogs } from "./crmIntegration.controller.js";

// Stats
export { getCRMStats } from "./getCRMStats.controller.js";
