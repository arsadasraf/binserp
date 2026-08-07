// Central Registry of Actual System Modules, Real Tabs, and URL Sub-Routes for RBAC
export const SYSTEM_PERMISSIONS = [
  {
    module: "Admin",
    label: "Admin & User Management",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/admin/overview" },
      { id: "users", label: "User Management", route: "/dashboard/admin" },
      { id: "roles", label: "Role Management", route: "/dashboard/admin/roles" }
    ]
  },
  {
    module: "Store",
    label: "Store & Inventory",
    tabs: [
      { id: "home", label: "Inventory Overview", route: "/dashboard/store?tab=home" },
      { id: "material-issue", label: "Material Issue", route: "/dashboard/store?tab=material-issue" },
      { id: "job-work", label: "Job Work", route: "/dashboard/store?tab=job-work" },
      { id: "dc", label: "Bills / DC", route: "/dashboard/store?tab=dc" },
      { id: "masters/materials", label: "Materials Master", route: "/dashboard/store/masters/materials" },
      { id: "masters/vendors", label: "Vendors Master", route: "/dashboard/store/masters/vendors" },
      { id: "masters/customers", label: "Customers Master", route: "/dashboard/store/masters/customers" },
      { id: "masters/categories", label: "Categories Master", route: "/dashboard/store/masters/categories" },
      { id: "masters/locations", label: "Locations Master", route: "/dashboard/store/masters/locations" },
      { id: "masters/finished-goods", label: "Finished Goods Master", route: "/dashboard/store/masters/finished-goods" }
    ]
  },
  {
    module: "HR",
    label: "Human Resources",
    tabs: [
      { id: "home", label: "Overview", route: "/dashboard/hr?tab=home" },
      { id: "attendance", label: "Attendance Kiosk", route: "/dashboard/hr?tab=attendance" },
      { id: "present", label: "Present Log", route: "/dashboard/hr?tab=present" },
      { id: "salaries", label: "Salaries & Payroll", route: "/dashboard/hr?tab=salaries" },
      { id: "master", label: "HR Masters", route: "/dashboard/hr?tab=master" }
    ]
  },
  {
    module: "PPC",
    label: "PPC (Production Planning)",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/ppc?tab=overview" },
      { id: "orders", label: "Orders List", route: "/dashboard/ppc?tab=orders" },
      { id: "planning", label: "Planning", route: "/dashboard/ppc?tab=planning" },
      { id: "master", label: "PPC Masters", route: "/dashboard/ppc?tab=master" }
    ]
  },
  {
    module: "Security",
    label: "Gate Security & Entry",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/gate-entry?tab=overview" },
      { id: "kiosk", label: "Kiosk Mode", route: "/dashboard/gate-entry?tab=kiosk" },
      { id: "visitor", label: "Visitor Log", route: "/dashboard/gate-entry?tab=visitor" },
      { id: "vehicle", label: "Vehicle Log", route: "/dashboard/gate-entry?tab=vehicle" }
    ]
  },
  {
    module: "CRM",
    label: "CRM & Sales",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/crm" }
    ]
  },
  {
    module: "Accounts",
    label: "Accounts & Finance",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/accounts" }
    ]
  },
  {
    module: "Maintenance",
    label: "Maintenance",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/maintenance" }
    ]
  },
  {
    module: "Quality",
    label: "Quality Control",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/quality" }
    ]
  },
  {
    module: "Reports",
    label: "Reports & Analytics",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/reports" }
    ]
  }
];
