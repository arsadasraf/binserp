// Leads
export { createLead } from "./createLead.controller.js";
export { getLeads } from "./getLeads.controller.js";
export { updateLead } from "./updateLead.controller.js";
export { deleteLead } from "./deleteLead.controller.js";
export { convertLeadToCustomer } from "./convertLeadToCustomer.controller.js";
export { addLeadFollowUp, getLeadFollowUps, deleteLeadFollowUp } from "./leadFollowUp.controller.js";

// Deals
export { getDeals, createDeal, updateDeal, deleteDeal } from "./deal.controller.js";

// Customers
export { createCustomer } from "./createCustomer.controller.js";
export { getCustomers, getCustomer360 } from "./getCustomers.controller.js";
export { updateCustomer } from "./updateCustomer.controller.js";
export { deleteCustomer } from "./deleteCustomer.controller.js";
export {
    addCustomerNote,
    getCustomerNotes,
    deleteCustomerNote,
    addCustomerTravelLog,
    getCustomerTravelLogs,
    deleteCustomerTravelLog
} from "./customerNotesAndTravel.controller.js";

// Activities
export { createActivity } from "./createActivity.controller.js";
export { getActivities, updateActivity, deleteActivity } from "./getActivities.controller.js";

// CRM Masters
export { getCRMMasters, createCRMMasterItem, updateCRMMasterItem, deleteCRMMasterItem } from "./crmMaster.controller.js";

// Excel Import / Export
export { downloadExcelTemplate, importLeadsFromExcel, importCustomersFromExcel, exportLeadsToExcel, exportCustomersToExcel } from "./crmExcel.controller.js";

// Integrations & Webhooks
export { getCRMIntegrations, saveCRMIntegrations, syncIndiaMartLeads, receiveWebhookLead, getSyncLogs } from "./crmIntegration.controller.js";

// Proposals & Quotations
export { 
    getProposals, 
    createProposal, 
    updateProposal, 
    deleteProposal,
    createProposalRevision,
    convertProposalToPI 
} from "./crmProposal.controller.js";

// Proforma Invoices
export {
    getProformaInvoices,
    createProformaInvoice,
    updateProformaInvoice,
    createPIRevision,
    convertPIToInvoice,
    deleteProformaInvoice
} from "./crmProformaInvoice.controller.js";

// Payments & Receipts
export { getPayments, createPayment, updatePayment, deletePayment, getReceivablesAging } from "./crmPayment.controller.js";

// After-Sales Service (Installed Base, Service Tickets, Installations & Commissioning)
export { 
    getInstalledBase, createInstalledBase, updateInstalledBase, deleteInstalledBase, 
    getServiceTickets, createServiceTicket, updateServiceTicket, deleteServiceTicket,
    getInstallations, createInstallation, updateInstallation, deleteInstallation
} from "./afterSalesService.controller.js";

// Team Access
export { getCRMTeamAccess } from "./crmTeamAccess.controller.js";

// Stats
export { getCRMStats } from "./getCRMStats.controller.js";
