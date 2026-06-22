export const ROLE_PERMISSIONS = {
  SAAS_OWNER: ["all", "view_all_companies", "manage_all_users", "view_analytics", "system_admin"],
  CEO: ["view_dashboard", "manage_users", "view_reports", "all"],
  MD: ["view_dashboard", "manage_users", "view_reports", "all"],
  Manager: ["view_dashboard", "manage_users", "view_reports", "all"],
  Admin: ["manage_users", "create_user"],
  Store: ["store"],
  PPC: ["ppc"],
  HR: ["hr"],
  Accounts: ["accounts"],
  Quality: ["quality"],
  Maintenance: ["maintenance"],
  CRM: ["crm"],
  Security: ["gate_entry"],
  // Employee: ["employee_dashboard"]
};
